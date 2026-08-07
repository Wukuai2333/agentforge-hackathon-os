import { env } from "cloudflare:workers";
import { currentAccount, identityFromRequest } from "../../../lib/account";

type Runtime = { DB: D1Database; ORGANIZER_ACCESS_CODE?: string; COGNEE_API_KEY?: string; COGNEE_API_URL?: string; COGNEE_LEARNING_DATASET?: string };
const allowed = async (request: Request, runtime: Runtime) => {
  if (runtime.ORGANIZER_ACCESS_CODE && request.headers.get("x-organizer-code") === runtime.ORGANIZER_ACCESS_CODE) return true;
  const identity = await identityFromRequest(request);
  return identity ? (await currentAccount(runtime.DB, identity))?.role === "organizer" : false;
};
const base = (runtime: Runtime) => (runtime.COGNEE_API_URL || "https://api.cognee.ai").replace(/\/$/, "");
// Cognee Cloud tenant endpoints authenticate with X-Api-Key only. Sending a
// self-hosted Bearer header alongside it causes the tenant gateway to reject
// the otherwise valid request as an invalid header.
const headers = (runtime: Runtime, json = false) => ({ "X-Api-Key": runtime.COGNEE_API_KEY || "", ...(json ? { "Content-Type": "application/json" } : {}) });
const failure = async (response: Response) => `${response.status} ${(await response.text()).slice(0, 500)}`;

export async function GET(request: Request) {
  const runtime = env as unknown as Runtime;
  if (!await allowed(request, runtime)) return Response.json({ error: "Organizer access required." }, { status: 401 });
  const [sync, failures, model, signals] = await Promise.all([
    runtime.DB.prepare("SELECT status, COUNT(*) AS count FROM cognee_sync_outbox GROUP BY status").all(),
    runtime.DB.prepare(`SELECT source_type AS sourceType, source_id AS sourceId, attempts, last_error AS lastError,
      created_at AS createdAt FROM cognee_sync_outbox WHERE status='error' ORDER BY created_at DESC LIMIT 10`).all(),
    runtime.DB.prepare("SELECT entry_kind AS entryKind, COUNT(*) AS count FROM participant_model_entries GROUP BY entry_kind").all(),
    runtime.DB.prepare(`SELECT id, page, tutorial_step AS tutorialStep, window_started_at AS windowStartedAt,
      window_ended_at AS windowEndedAt, prompt_count AS promptCount, participant_count AS participantCount,
      error_count AS errorCount, negative_feedback_count AS negativeFeedbackCount, detection_rule AS detectionRule,
      cognee_summary AS cogneeSummary, suggested_action AS suggestedAction, review_status AS reviewStatus,
      created_at AS createdAt FROM learning_signals ORDER BY created_at DESC LIMIT 20`).all(),
  ]);
  return Response.json({ connected: Boolean(runtime.COGNEE_API_KEY), dataset: runtime.COGNEE_LEARNING_DATASET || "agentforge_learning_signals", sync: sync.results, failures: failures.results, participantModel: model.results, signals: signals.results });
}

export async function POST(request: Request) {
  const runtime = env as unknown as Runtime;
  if (!await allowed(request, runtime)) return Response.json({ error: "Organizer access required." }, { status: 401 });
  const input = await request.json() as { action?: "detect" | "sync" | "analyze" | "retry_failed" | "seed_tutorials" | "backfill_all" | "grade_prompts"; signalId?: string };

  if (input.action === "retry_failed") {
    const result = await runtime.DB.prepare("UPDATE cognee_sync_outbox SET status='pending',attempts=0,last_error=NULL WHERE status='error' AND attempts>=5").run();
    return Response.json({ reset: result.meta.changes || 0 });
  }

  if (input.action === "detect") {
    const end = Date.now(), start = end - 3600000;
    const groups = await runtime.DB.prepare(`SELECT page, tutorial_step AS tutorialStep,
      CASE
        WHEN error_code LIKE '%auth%' OR lower(user_prompt) LIKE '%api key%' OR lower(user_prompt) LIKE '%login%' THEN 'authentication'
        WHEN lower(user_prompt) LIKE '%cognify%' OR lower(user_prompt) LIKE '%processing%' OR lower(user_prompt) LIKE '%finished%' OR lower(user_prompt) LIKE '%status%' THEN 'processing_status'
        WHEN lower(user_prompt) LIKE '%dataset%' OR lower(user_prompt) LIKE '%memory%' OR lower(user_prompt) LIKE '%recall%' THEN 'memory_retrieval'
        WHEN lower(user_prompt) LIKE '%clawmax%' OR lower(user_prompt) LIKE '%agent%' THEN 'agent_building'
        WHEN status='error' THEN 'runtime_error'
        ELSE 'general_question' END AS category,
      CASE WHEN (SELECT COUNT(*) FROM prompt_events history WHERE history.anonymous_participant_id=prompt_events.anonymous_participant_id AND history.created_at<=?) <= 3 THEN 'new'
           WHEN (SELECT COUNT(*) FROM prompt_events history WHERE history.anonymous_participant_id=prompt_events.anonymous_participant_id AND history.created_at<=?) <= 12 THEN 'active'
           ELSE 'experienced' END AS participantLevel,
      COUNT(*) AS promptCount,
      COUNT(DISTINCT anonymous_participant_id) AS participantCount, SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) AS errorCount,
      SUM(CASE WHEN user_feedback='not_helpful' THEN 1 ELSE 0 END) AS negativeFeedbackCount,
      json_group_array(substr(user_prompt,1,240)) AS examplesJson
      FROM prompt_events WHERE created_at BETWEEN ? AND ? GROUP BY page, tutorial_step, category, participantLevel`).bind(end, end, start, end).all();
    let created = 0, clustersCreated = 0;
    for (const row of groups.results) {
      const prompts = Number(row.promptCount || 0), participants = Number(row.participantCount || 0);
      const errors = Number(row.errorCount || 0), negative = Number(row.negativeFeedbackCount || 0);
      if (prompts >= 2) {
        await runtime.DB.prepare(`INSERT INTO prompt_clusters
          (id,page,tutorial_step,category,label,participant_level,prompt_count,participant_count,error_count,examples_json,window_started_at,window_ended_at,created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), String(row.page), row.tutorialStep || null, String(row.category), String(row.category).replaceAll("_", " "), String(row.participantLevel), prompts, participants, errors, String(row.examplesJson || "[]"), start, end, end).run();
        clustersCreated++;
      }
      if (!((prompts >= 15 && participants >= 5) || (prompts >= 5 && errors / prompts >= .2) || (prompts >= 5 && negative / prompts >= .25))) continue;
      const duplicate = await runtime.DB.prepare(`SELECT id FROM learning_signals WHERE page=? AND tutorial_step IS ? AND window_ended_at>? LIMIT 1`)
        .bind(String(row.page), row.tutorialStep || null, end - 1800000).first();
      if (duplicate) continue;
      const signalId = crypto.randomUUID();
      await runtime.DB.prepare(`INSERT INTO learning_signals
        (id,page,tutorial_step,window_started_at,window_ended_at,prompt_count,participant_count,error_count,negative_feedback_count,detection_rule,review_status,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,'detected',?)`).bind(signalId, String(row.page), row.tutorialStep || null, start, end, prompts, participants, errors, negative, `threshold-v2:${String(row.category)}`, end).run();
      const evidence = await runtime.DB.prepare(`SELECT id FROM prompt_events WHERE page=? AND tutorial_step IS ? AND created_at BETWEEN ? AND ? ORDER BY (status='error') DESC,(user_feedback='not_helpful') DESC,created_at DESC LIMIT 5`).bind(String(row.page), row.tutorialStep || null, start, end).all();
      if (evidence.results.length) await runtime.DB.batch(evidence.results.map((item) => runtime.DB.prepare("INSERT OR IGNORE INTO learning_signal_evidence (id,signal_id,prompt_event_id,created_at) VALUES (?,?,?,?)").bind(crypto.randomUUID(), signalId, String(item.id), end)));
      created++;
    }
    return Response.json({ created, clustersCreated, evaluatedGroups: groups.results.length });
  }

  if (!runtime.COGNEE_API_KEY) return Response.json({ error: "COGNEE_API_KEY is not configured." }, { status: 503 });
  const dataset = runtime.COGNEE_LEARNING_DATASET || "agentforge_learning_signals";

  if (input.action === "seed_tutorials") {
    const now = Date.now();
    const tutorials = [
      { id: "tutorial-clawmax-v1", tool: "ClawMax", content: "Hackathon tutorial placeholder. Build one useful agent first, define its tools and data boundaries, test one repeatable task, then connect memory and evaluation. Official sponsor tutorial content is waiting for review with the ClawMax tutor team." },
      { id: "tutorial-cognee-v1", tool: "Cognee", content: "Hackathon memory loop: Add or remember data, Cognify to build memory, Search or recall relevant context, collect feedback, then improve the agent and its memory. Verify ingestion, processing status, retrieval evidence, and evaluation cases." },
    ];
    const results = await runtime.DB.batch(tutorials.map((item) => runtime.DB.prepare(`INSERT INTO cognee_sync_outbox
      (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at)
      VALUES (?,'tutorial_content',?,?,?,'pending',0,?) ON CONFLICT(source_type,source_id) DO NOTHING`)
      .bind(crypto.randomUUID(), item.id, dataset, JSON.stringify({
        schema_version: "agentforge.memory.v2", event_type: "tutorial_content",
        tutorial_id: item.id, tool: item.tool, content: item.content, version: "v1",
        evidence_type: "organizer_authored_fact", occurred_at: new Date(now).toISOString(),
      }), now)));
    const queued = results.reduce((total, result) => total + Number(result.meta.changes || 0), 0);
    return Response.json({ queued, skipped: tutorials.length - queued, examined: tutorials.length, nextStep: queued ? "Sync pending memory to send these tutorial records to Cognee." : "Both tutorial records were already queued or synced." });
  }

  if (input.action === "backfill_all") {
    const [prompts, projects, notes, feedbacks] = await Promise.all([
      runtime.DB.prepare(`SELECT id,anonymous_participant_id AS participantId,anonymous_team_id AS teamId,page,
        tutorial_step AS tutorialStep,user_prompt AS userPrompt,system_prompt_version AS systemPromptVersion,
        context_type AS contextType,context_reference AS contextReference,agent_name AS agentName,
        model_name AS modelName,response_text AS responseText,latency_ms AS latencyMs,input_tokens AS inputTokens,
        output_tokens AS outputTokens,status,error_code AS errorCode,user_feedback AS userFeedback,created_at AS createdAt
        FROM prompt_events ORDER BY created_at LIMIT 2000`).all(),
      runtime.DB.prepare(`SELECT id,anonymous_participant_id AS participantId,team_id AS teamId,title,problem,
        current_workflow AS currentWorkflow,data_boundaries AS dataBoundaries,success_criteria AS successCriteria,
        memory_requirements AS memoryRequirements,status,created_at AS createdAt FROM agent_projects ORDER BY created_at LIMIT 1000`).all(),
      runtime.DB.prepare(`SELECT id,team_id AS teamId,author_id AS authorId,author_name AS authorName,content,
        source_type AS sourceType,source_prompt_event_id AS sourcePromptEventId,created_at AS createdAt,
        updated_at AS updatedAt FROM shared_notes ORDER BY created_at LIMIT 2000`).all(),
      runtime.DB.prepare(`SELECT id,prompt_event_id AS promptEventId,anonymous_participant_id AS participantId,
        anonymous_team_id AS teamId,participant_display_name AS participantDisplayName,feedback,created_at AS createdAt
        FROM assistant_feedback_events ORDER BY created_at LIMIT 2000`).all(),
    ]);
    const rows = [
      ...prompts.results.map((row) => ({ sourceType: "prompt_event", sourceId: String(row.id), row: { schema_version: "agentforge.memory.v2", event_type: "assistant_prompt", ...row, evidence_type: "observed_fact" } })),
      ...projects.results.map((row) => ({ sourceType: "agent_project", sourceId: String(row.id), row: { schema_version: "agentforge.memory.v2", event_type: "agent_project", ...row, evidence_type: "participant_reported_fact" } })),
      ...notes.results.map((row) => ({ sourceType: "shared_note", sourceId: String(row.id), row: { schema_version: "agentforge.memory.v2", event_type: "team_shared_note", ...row, evidence_type: "team_authored_fact" } })),
      ...feedbacks.results.map((row) => ({ sourceType: "feedback_event", sourceId: String(row.id), row: { schema_version: "agentforge.memory.v2", event_type: "assistant_feedback", ...row, evidence_type: "participant_reported_fact" } })),
    ];
    const now = Date.now();
    let queued = 0;
    for (let offset = 0; offset < rows.length; offset += 100) {
      const results = await runtime.DB.batch(rows.slice(offset, offset + 100).map((item) => runtime.DB.prepare(`INSERT INTO cognee_sync_outbox
        (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at)
        VALUES (?,?,?,?,?,'pending',0,?) ON CONFLICT(source_type,source_id) DO NOTHING`)
        .bind(crypto.randomUUID(), item.sourceType, item.sourceId, dataset, JSON.stringify(item.row), now)));
      queued += results.reduce((total, result) => total + Number(result.meta.changes || 0), 0);
    }
    return Response.json({ examined: rows.length, queued, skipped: rows.length - queued, prompts: prompts.results.length, projects: projects.results.length, notes: notes.results.length, feedbacks: feedbacks.results.length, nextStep: queued ? "Sync pending memory to send the newly queued records to Cognee." : "Every examined record was already queued or synced." });
  }

  if (input.action === "sync") {
    const pending = await runtime.DB.prepare("SELECT id, source_type AS sourceType, payload_json AS payloadJson FROM cognee_sync_outbox WHERE status IN ('pending','error') AND attempts<5 ORDER BY created_at LIMIT 100").all();
    if (!pending.results.length) return Response.json({ synced: 0, message: "No pending records." });
    const ids = pending.results.map((row) => String(row.id)), slots = ids.map(() => "?").join(",");
    await runtime.DB.prepare(`UPDATE cognee_sync_outbox SET status='syncing',attempts=attempts+1 WHERE id IN (${slots})`).bind(...ids).run();
    try {
      const groups = new Map<string, typeof pending.results>();
      for (const row of pending.results) {
        const key = String(row.sourceType || "memory_event");
        groups.set(key, [...(groups.get(key) || []), row]);
      }
      for (const [sourceType, rows] of groups) {
        const form = new FormData();
        form.set("datasetName", dataset);
        form.append("data", new File([rows.map((row) => String(row.payloadJson)).join("\n")], `agentforge-${sourceType}-${Date.now()}.jsonl`, { type: "application/x-ndjson" }));
        form.append("node_set", `hackathon_${sourceType}s`);
        const added = await fetch(`${base(runtime)}/api/v1/add`, { method: "POST", headers: headers(runtime), body: form });
        if (!added.ok) throw new Error(`Cognee add failed for ${sourceType}: ${await failure(added)}`);
      }
      const cognified = await fetch(`${base(runtime)}/api/v1/cognify`, { method: "POST", headers: headers(runtime, true), body: JSON.stringify({ datasets: [dataset], run_in_background: true }) });
      if (!cognified.ok) throw new Error(`Cognee cognify failed: ${await failure(cognified)}`);
      await runtime.DB.prepare(`UPDATE cognee_sync_outbox SET status='synced',synced_at=?,last_error=NULL WHERE id IN (${slots})`).bind(Date.now(), ...ids).run();
      return Response.json({ synced: ids.length, dataset });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Cognee synchronization failed.";
      await runtime.DB.prepare(`UPDATE cognee_sync_outbox SET status='error',last_error=? WHERE id IN (${slots})`).bind(message.slice(0, 1000), ...ids).run();
      return Response.json({ error: message }, { status: 502 });
    }
  }

  if (input.action === "grade_prompts") {
    const rubricVersion = "agentforge-prompt-coaching-v3";
    const prompts = await runtime.DB.prepare(`SELECT pe.id,pe.anonymous_participant_id AS participantId,
      pe.anonymous_team_id AS teamId,pe.page,pe.tutorial_step AS tutorialStep,pe.user_prompt AS userPrompt,
      pe.task_reference AS taskReference,pe.context_reference AS contextReference,pe.response_text AS responseText,
      pe.user_feedback AS userFeedback,pe.outcome_status AS outcomeStatus,pe.outcome_evidence AS outcomeEvidence,
      pe.parent_prompt_event_id AS parentPromptEventId,parent.user_prompt AS parentPrompt,parent.response_text AS parentResponse,
      (SELECT ap.title FROM agent_projects ap WHERE ap.anonymous_participant_id=pe.anonymous_participant_id ORDER BY ap.updated_at DESC LIMIT 1) AS projectGoal,
      (SELECT ap.success_criteria FROM agent_projects ap WHERE ap.anonymous_participant_id=pe.anonymous_participant_id ORDER BY ap.updated_at DESC LIMIT 1) AS projectSuccessCriteria
      FROM prompt_events pe LEFT JOIN prompt_evaluations ev ON ev.prompt_event_id=pe.id AND ev.rubric_version=?
      LEFT JOIN prompt_events parent ON parent.id=pe.parent_prompt_event_id
      WHERE pe.status='success' AND ev.id IS NULL ORDER BY pe.created_at DESC LIMIT 1`).bind(rubricVersion).all();
    let graded = 0;
    for (const row of prompts.results) {
      const targetPrompt = String(row.userPrompt || "").trim();
      const hasLanguage = /\p{L}/u.test(targetPrompt);
      const obviousNonPrompt = !hasLanguage || /^\d+$/u.test(targetPrompt) || /^(.)(\1){2,}$/u.test(targetPrompt)
        || /^(hi|hello|hey|test|testing|ok|okay|thanks|thank you)[.!?]*$/iu.test(targetPrompt) || targetPrompt.length < 3;
      if (obviousNonPrompt) {
        const ruleResult = {
          scores: { goal_clarity: 0, relevant_context: 0, constraints: 0, decomposition: 0, verification: 0, iteration: 0, efficiency: 0, learning_agency: 0, outcome: null },
          total_score: 0, max_score: 32, coaching_status: "insufficient_evidence",
          strengths: [],
          weaknesses: ["The text does not contain an interpretable task, question, or learning goal."],
          improved_prompt: "State what you are trying to learn or build, the context that matters, the help you want, and how you will verify the result.",
          evaluation_basis: "deterministic_non_prompt_gate",
          evidence_used: [{ type: "raw_prompt", value: targetPrompt }], evidence_missing: ["learning goal", "task context", "success evidence"],
          inference_notice: "No learning intent or outcome was inferred. This is coaching feedback, not a participant grade.",
        };
        const evaluationId = crypto.randomUUID(), createdAt = Date.now();
        await runtime.DB.batch([runtime.DB.prepare(`INSERT INTO prompt_evaluations
          (id,prompt_event_id,rubric_version,evaluator,evaluation_json,total_score,created_at)
          VALUES (?,?,?,?,?,?,?) ON CONFLICT(prompt_event_id,rubric_version) DO NOTHING`)
          .bind(evaluationId, String(row.id), rubricVersion, "agentforge-rule-gate", JSON.stringify(ruleResult), 0, createdAt),
        runtime.DB.prepare(`INSERT INTO cognee_sync_outbox (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at)
          VALUES (?,'coaching_action',?,'agentforge_learning_signals',?,'pending',0,?) ON CONFLICT(source_type,source_id) DO NOTHING`)
          .bind(crypto.randomUUID(), evaluationId, JSON.stringify({ schema_version: "agentforge.prompt-coaching.v3", event_type: "prompt_coaching_evaluation", evaluation_id: evaluationId, prompt_event_id: row.id, participant_id: row.participantId, evaluator: "deterministic_non_prompt_gate", ...ruleResult, occurred_at: new Date(createdAt).toISOString(), evidence_type: "rule_based_inference" }), createdAt)]);
        graded++;
        continue;
      }
      const evaluationInput = {
        raw_prompt: targetPrompt,
        participant_id: row.participantId,
        team_id: row.teamId,
        task: { page: row.page, tutorial_step: row.tutorialStep, task_reference: row.taskReference, project_goal: row.projectGoal, project_success_criteria: row.projectSuccessCriteria },
        iteration: { parent_prompt_event_id: row.parentPromptEventId, parent_prompt: row.parentPrompt, parent_response: row.parentResponse },
        tutorial_step: row.tutorialStep,
        selected_or_page_context: row.contextReference,
        assistant_response: row.responseText,
        participant_feedback: row.userFeedback,
        participant_reported_outcome: { status: row.outcomeStatus, evidence: row.outcomeEvidence },
      };
      const query = `Coach the participant using RAW_PROMPT and the linked evidence below. Do not evaluate this instruction text.

RUBRIC ${rubricVersion}
- goal_clarity: Is the learning or build goal understandable, scoped, and testable?
- relevant_context: Does the Prompt include only the context necessary for this task?
- constraints: Does it state useful requirements, boundaries, or output expectations?
- decomposition: Does it break a complex task into learnable or executable parts when decomposition is needed?
- verification: Does it ask for a check, test, evidence, or way to detect failure?
- iteration: Does it use prior feedback or create a concrete next improvement loop?
- efficiency: Is it concise relative to the task, without missing essential information or causing avoidable repeated calls?
- learning_agency: Does it support understanding, reasoning, decision-making, or self-explanation instead of merely outsourcing the final work?
- outcome: Did linked evidence show a useful result? Score null when no participant-reported or system-observed outcome exists.

GLOBAL SCALE: 0=absent or counterproductive; 1=weak; 2=partial; 3=effective; 4=strong and supported by linked evidence.
Score each available dimension 0–4. Do not penalize a simple task for appropriately omitting unnecessary constraints or decomposition. Outcome anchors: 0=failed, 1=mostly failed, 2=partial result, 3=successful with minor gaps, 4=verified against the stated success criteria. Outcome must be null unless linked outcome evidence exists. max_score is 32 when outcome is null and 36 otherwise.

Critical rules:
1. Do not reward length, formality, or jargon. A short Prompt can be excellent when context is already available.
2. Separate raw facts, participant-reported evidence, and AI inference. Never invent success or learning.
3. Evaluate the Prompt in its real task context, but do not silently fill missing Prompt information from memory.
4. learning_agency is coaching inference, not a judgment of motivation or ability.
5. total_score is the sum of non-null scores. Use coaching_status: insufficient_evidence, emerging, developing, or effective. Never use letter grades.
6. Return one JSON object only with: scores, total_score, max_score, coaching_status, strengths, weaknesses, improved_prompt, evidence_used, evidence_missing, inference_notice.

RAW_PROMPT:
<raw_prompt>${targetPrompt}</raw_prompt>

LINKED_EVIDENCE:
${JSON.stringify(evaluationInput)}`;
      const response = await fetch(`${base(runtime)}/api/v1/search`, { method: "POST", headers: headers(runtime, true), body: JSON.stringify({
        search_type: "GRAPH_COMPLETION", datasets: [dataset], query, top_k: 8,
        system_prompt: "You are an evidence-grounded Prompt coach. Evaluate RAW_PROMPT in its linked learning context using rubric v3. Do not reward verbosity, do not invent outcomes, and return one JSON object only.",
      }) });
      if (!response.ok) continue;
      const result = await response.json();
      const raw = JSON.stringify(result).slice(0, 20000);
      const totalMatch = raw.match(/total_score[^0-9]{0,24}(\d+)/);
      const evaluationId = crypto.randomUUID(), createdAt = Date.now();
      await runtime.DB.batch([runtime.DB.prepare(`INSERT INTO prompt_evaluations
        (id,prompt_event_id,rubric_version,evaluator,evaluation_json,total_score,created_at)
        VALUES (?,?,?,?,?,?,?) ON CONFLICT(prompt_event_id,rubric_version) DO NOTHING`)
        .bind(evaluationId, String(row.id), rubricVersion, "cognee-graph-completion", raw, totalMatch ? Number(totalMatch[1]) : null, createdAt),
      runtime.DB.prepare(`INSERT INTO cognee_sync_outbox (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at)
        VALUES (?,'coaching_action',?,'agentforge_learning_signals',?,'pending',0,?) ON CONFLICT(source_type,source_id) DO NOTHING`)
        .bind(crypto.randomUUID(), evaluationId, JSON.stringify({ schema_version: "agentforge.prompt-coaching.v3", event_type: "prompt_coaching_evaluation", evaluation_id: evaluationId, prompt_event_id: row.id, participant_id: row.participantId, evaluator: "cognee-graph-completion", evaluation_json: raw, occurred_at: new Date(createdAt).toISOString(), evidence_type: "ai_inference" }), createdAt)]);
      graded++;
    }
    return Response.json({ graded, evaluated: prompts.results.length, rubricVersion });
  }

  if (input.action === "analyze" && input.signalId) {
    const signal = await runtime.DB.prepare("SELECT * FROM learning_signals WHERE id=?").bind(input.signalId).first<Record<string, unknown>>();
    if (!signal) return Response.json({ error: "Learning signal not found." }, { status: 404 });
    const query = `Analyze the learning difficulty for page ${signal.page}, step ${signal.tutorial_step || "general"}. Verified SQL metrics: ${signal.prompt_count} prompts, ${signal.participant_count} participants, ${signal.error_count} errors, ${signal.negative_feedback_count} negative feedback. Separate evidence from inference, cite representative sources, suggest one human-reviewable tutorial improvement, and never invent counts.`;
    const response = await fetch(`${base(runtime)}/api/v1/search`, { method: "POST", headers: headers(runtime, true), body: JSON.stringify({ search_type: "GRAPH_COMPLETION", datasets: [dataset], query, top_k: 10, include_references: true }) });
    if (!response.ok) return Response.json({ error: `Cognee search failed: ${await failure(response)}` }, { status: 502 });
    const result = await response.json();
    await runtime.DB.prepare("UPDATE learning_signals SET cognee_summary=?,review_status='reviewing' WHERE id=?").bind(JSON.stringify(result).slice(0, 12000), input.signalId).run();
    return Response.json({ signal, result });
  }
  return Response.json({ error: "Unknown action." }, { status: 400 });
}
