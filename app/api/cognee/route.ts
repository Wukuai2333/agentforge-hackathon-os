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
  const input = await request.json() as { action?: "detect" | "sync" | "analyze"; signalId?: string };

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

  if (input.action === "sync") {
    const pending = await runtime.DB.prepare("SELECT id, payload_json AS payloadJson FROM cognee_sync_outbox WHERE status IN ('pending','error') AND attempts<5 ORDER BY created_at LIMIT 50").all();
    if (!pending.results.length) return Response.json({ synced: 0, message: "No pending records." });
    const ids = pending.results.map((row) => String(row.id)), slots = ids.map(() => "?").join(",");
    await runtime.DB.prepare(`UPDATE cognee_sync_outbox SET status='syncing',attempts=attempts+1 WHERE id IN (${slots})`).bind(...ids).run();
    try {
      const form = new FormData();
      const jsonl = pending.results.map((row) => String(row.payloadJson)).join("\n");
      form.set("datasetName", dataset);
      form.append("data", new Blob([jsonl], { type: "application/x-ndjson" }), `agentforge-events-${Date.now()}.jsonl`);
      form.append("node_set", "hackathon_prompt_events");
      const added = await fetch(`${base(runtime)}/api/v1/add`, { method: "POST", headers: headers(runtime), body: form });
      if (!added.ok) throw new Error(`Cognee add failed: ${await failure(added)}`);
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
