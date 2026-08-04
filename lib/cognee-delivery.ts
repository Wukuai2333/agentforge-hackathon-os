type CogneeRuntime = { DB: D1Database; COGNEE_API_KEY?: string; COGNEE_API_URL?: string; COGNEE_LEARNING_DATASET?: string };

const safeNode = (value: unknown) => String(value || "unknown").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100);

export async function syncPendingMemory(runtime: CogneeRuntime, limit = 25) {
  if (!runtime.COGNEE_API_KEY) return { synced: 0, skipped: "Cognee is not configured." };
  const pending = await runtime.DB.prepare("SELECT id,source_type AS sourceType,payload_json AS payloadJson FROM cognee_sync_outbox WHERE status IN ('pending','error') AND attempts<5 ORDER BY created_at LIMIT ?").bind(limit).all();
  if (!pending.results.length) return { synced: 0 };
  const ids = pending.results.map((row) => String(row.id)), slots = ids.map(() => "?").join(",");
  await runtime.DB.prepare(`UPDATE cognee_sync_outbox SET status='syncing',attempts=attempts+1 WHERE id IN (${slots})`).bind(...ids).run();
  const base = (runtime.COGNEE_API_URL || "https://api.cognee.ai").replace(/\/$/, "");
  const dataset = runtime.COGNEE_LEARNING_DATASET || "agentforge_learning_signals";
  try {
    for (const row of pending.results) {
      let payload: Record<string, unknown> = {};
      try { payload = JSON.parse(String(row.payloadJson)); } catch { payload = { raw_record: String(row.payloadJson) }; }
      const form = new FormData();
      form.set("datasetName", dataset);
      form.append("data", new File([JSON.stringify(payload)], `agentforge-${safeNode(row.sourceType)}-${safeNode(row.id)}.json`, { type: "application/json" }));
      form.append("node_set", `source_${safeNode(row.sourceType)}`);
      if (payload.hackathon_event_id || payload.event_id) form.append("node_set", `event_${safeNode(payload.hackathon_event_id || payload.event_id)}`);
      if (payload.team_id) form.append("node_set", `team_${safeNode(payload.team_id)}`);
      if (payload.participant_id) form.append("node_set", `participant_${safeNode(payload.participant_id)}`);
      const response = await fetch(`${base}/api/v1/add`, { method: "POST", headers: { "X-Api-Key": runtime.COGNEE_API_KEY }, body: form });
      if (!response.ok) throw new Error(`Cognee add failed: ${response.status} ${(await response.text()).slice(0, 400)}`);
    }
    const cognify = await fetch(`${base}/api/v1/cognify`, { method: "POST", headers: { "X-Api-Key": runtime.COGNEE_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ datasets: [dataset], run_in_background: true }) });
    if (!cognify.ok) throw new Error(`Cognee cognify failed: ${cognify.status} ${(await cognify.text()).slice(0, 400)}`);
    await runtime.DB.prepare(`UPDATE cognee_sync_outbox SET status='synced',synced_at=?,last_error=NULL WHERE id IN (${slots})`).bind(Date.now(), ...ids).run();
    return { synced: ids.length, dataset };
  } catch (problem) {
    const message = problem instanceof Error ? problem.message : "Cognee delivery failed.";
    await runtime.DB.prepare(`UPDATE cognee_sync_outbox SET status='error',last_error=? WHERE id IN (${slots})`).bind(message.slice(0, 1000), ...ids).run();
    return { synced: 0, error: message };
  }
}
