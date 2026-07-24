import { env } from "cloudflare:workers";

type Runtime = { DB: D1Database; ORGANIZER_ACCESS_CODE?: string; COGNEE_API_KEY?: string; COGNEE_API_URL?: string; COGNEE_LEARNING_DATASET?: string };
const allowed = (request: Request, runtime: Runtime) => Boolean(runtime.ORGANIZER_ACCESS_CODE && request.headers.get("x-organizer-code") === runtime.ORGANIZER_ACCESS_CODE);
const base = (runtime: Runtime) => (runtime.COGNEE_API_URL || "https://api.cognee.ai").replace(/\/$/, "");
// Cognee Cloud tenant endpoints authenticate with X-Api-Key only. Sending a
// self-hosted Bearer header alongside it causes the tenant gateway to reject
// the otherwise valid request as an invalid header.
const headers = (runtime: Runtime, json = false) => ({ "X-Api-Key": runtime.COGNEE_API_KEY || "", ...(json ? { "Content-Type": "application/json" } : {}) });
const failure = async (response: Response) => `${response.status} ${(await response.text()).slice(0, 500)}`;

export async function GET(request: Request) {
  const runtime = env as unknown as Runtime;
  if (!allowed(request, runtime)) return Response.json({ error: "Organizer access required." }, { status: 401 });
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
  if (!allowed(request, runtime)) return Response.json({ error: "Organizer access required." }, { status: 401 });
  const input = await request.json() as { action?: "detect" | "sync" | "analyze" | "retry_failed" | "seed_tutorials" | "backfill_all" | "grade_prompts"; signalId?: string };

  if (input.action === "retry_failed") {
    const result = await runtime.DB.prepare("UPDATE cognee_sync_outbox SET status='pending',attempts=0,last_error=NULL WHERE status='error' AND attempts>=5").run();
    return Response.json({ reset: result.meta.changes || 0 });
  }

  if (input.action === "detect") {
    const end = Date.now(), start = end - 3600000;
    const groups = await runtime.DB.prepare(`SELECT page, tutorial_step AS tutorialStep, COUNT(*) AS promptCount,
      COUNT(DISTINCT anonymous_participant_id) AS participantCount, SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) AS errorCount,
      SUM(CASE WHEN user_feedback='not_helpful' THEN 1 ELSE 0 END) AS negativeFeedbackCount
      FROM prompt_events WHERE created_at BETWEEN ? AND ? GROUP BY page, tutorial_step`).bind(start, end).all();
    let created = 0;
    for (const row of groups.results) {
      const prompts = Number(row.promptCount || 0), participants = Number(row.participantCount || 0);
      const errors = Number(row.errorCount || 0), negative = Number(row.negativeFeedbackCount || 0);
      if (!((prompts >= 15 && participants >= 5) || (prompts >= 5 && errors / prompts >= .2) || (prompts >= 5 && negative / prompts >= .25))) continue;
      const duplicate = await runtime.DB.prepare(`SELECT id FROM learning_signals WHERE page=? AND tutorial_step IS ? AND window_ended_at>? LIMIT 1`)
        .bind(String(row.page), row.tutorialStep || null, end - 1800000).first();
      if (duplicate) continue;
      await runtime.DB.prepare(`INSERT INTO learning_signals
        (id,page,tutorial_step,window_started_at,window_ended_at,prompt_count,participant_count,error_count,negative_feedback_count,detection_rule,review_status,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,'detected',?)`).bind(crypto.randomUUID(), String(row.page), row.tutorialStep || null, start, end, prompts, participants, errors, negative, "threshold-v1", end).run();
      created++;
    }
    return Response.json({ created, evaluatedGroups: groups.results.length });
  }

  if (!runtime.COGNEE_API_KEY) return Response.json({ error: "COGNEE_API_KEY is not configured." }, { status: 503 });
  const dataset = runtime.COGNEE_LEARNING_DATASET || "agentforge_learning_signals";

  if (input.action === "seed_tutorials") {
    const now = Date.now();
    const tutorials = [
      { id: "tutorial-clawmax-v1", tool: "ClawMax", content: "Hackathon tutorial placeholder. Build one useful agent first, define its tools and data boundaries, test one repeatable task, then connect memory and evaluation. Official sponsor tutorial content is waiting for review with the ClawMax tutor team." },
      { id: "tutorial-cognee-v1", tool: "Cognee", content: "Hackathon memory loop: Add or remember data, Cognify to build memory, Search or recall relevant context, collect feedback, then improve the agent and its memory. Verify ingestion, processing status, retrieval evidence, and evaluation cases." },
    ];
    await runtime.DB.batch(tutorials.map((item) => runtime.DB.prepare(`INSERT INTO cognee_sync_outbox
      (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at)
      VALUES (?,'tutorial_content',?,?,?,'pending',0,?) ON CONFLICT(source_type,source_id) DO NOTHING`)
      .bind(crypto.randomUUID(), item.id, dataset, JSON.stringify({
        schema_version: "agentforge.memory.v2", event_type: "tutorial_content",
        tutorial_id: item.id, tool: item.tool, content: item.content, version: "v1",
        evidence_type: "organizer_authored_fact", occurred_at: new Date(now).toISOString(),
      }), now)));
    return Response.json({ queued: tutorials.length });
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
    for (let offset = 0; offset < rows.length; offset += 100) {
      await runtime.DB.batch(rows.slice(offset, offset + 100).map((item) => runtime.DB.prepare(`INSERT INTO cognee_sync_outbox
        (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at)
        VALUES (?,?,?,?,?,'pending',0,?) ON CONFLICT(source_type,source_id) DO NOTHING`)
        .bind(crypto.randomUUID(), item.sourceType, item.sourceId, dataset, JSON.stringify(item.row), now)));
    }
    return Response.json({ examined: rows.length, prompts: prompts.results.length, projects: projects.results.length, notes: notes.results.length, feedbacks: feedbacks.results.length });
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
    const rubricVersion = "agentforge-prompt-quality-v1";
    const prompts = await runtime.DB.prepare(`SELECT pe.id,pe.anonymous_participant_id AS participantId,
      pe.anonymous_team_id AS teamId,pe.page,pe.tutorial_step AS tutorialStep,pe.user_prompt AS userPrompt,
      pe.context_reference AS contextReference,pe.response_text AS responseText,pe.user_feedback AS userFeedback
      FROM prompt_events pe LEFT JOIN prompt_evaluations ev ON ev.prompt_event_id=pe.id AND ev.rubric_version=?
      WHERE pe.status='success' AND ev.id IS NULL ORDER BY pe.created_at DESC LIMIT 20`).bind(rubricVersion).all();
    let graded = 0;
    for (const row of prompts.results) {
      const query = `Evaluate this hackathon participant prompt using rubric ${rubricVersion}.
Return JSON only with integer scores 0-4 for clarity, specificity, relevant_context, actionability, iteration_readiness, and safety; total_score 0-24; grade A/B/C/D; strengths; weaknesses; and one improved_prompt.
Use Cognee memory about the participant and project when relevant. Do not reward verbosity. Do not invent facts.
Prompt event: ${JSON.stringify(row)}`;
      const response = await fetch(`${base(runtime)}/api/v1/search`, { method: "POST", headers: headers(runtime, true), body: JSON.stringify({
        search_type: "AGENTIC_COMPLETION", datasets: [dataset], query, top_k: 10,
        system_prompt: "You are a prompt-quality evaluator. Distinguish observed evidence from inference and return JSON only.", max_iter: 4,
      }) });
      if (!response.ok) continue;
      const result = await response.json();
      const raw = JSON.stringify(result).slice(0, 20000);
      const totalMatch = raw.match(/"total_score"\s*:\s*(\d+)/);
      await runtime.DB.prepare(`INSERT INTO prompt_evaluations
        (id,prompt_event_id,rubric_version,evaluator,evaluation_json,total_score,created_at)
        VALUES (?,?,?,?,?,?,?) ON CONFLICT(prompt_event_id,rubric_version) DO NOTHING`)
        .bind(crypto.randomUUID(), String(row.id), rubricVersion, "cognee-agentic-completion", raw, totalMatch ? Number(totalMatch[1]) : null, Date.now()).run();
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
