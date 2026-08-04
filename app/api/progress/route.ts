import { env } from "cloudflare:workers";
import { requireCurrentAccount } from "../../../lib/account";

export async function GET(request: Request) {
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const result = await env.DB.prepare(`SELECT id,milestone,status,source,occurred_at AS occurredAt FROM event_progress_events
    WHERE event_participant_id=? ORDER BY occurred_at`).bind(auth.account!.participantId).all();
  return Response.json({ events: result.results });
}

export async function POST(request: Request) {
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const input = await request.json() as { milestone?: string; status?: string };
  const milestone = input.milestone?.trim().slice(0, 120) || "";
  const status = input.status === "started" || input.status === "verified" ? input.status : "completed";
  if (!milestone) return Response.json({ error: "Milestone is required." }, { status: 400 });
  const id = crypto.randomUUID(), now = Date.now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO event_progress_events (id,event_participant_id,team_id,milestone,status,source,occurred_at) VALUES (?,?,?,?,?,'manual',?)").bind(id, auth.account!.participantId, auth.account!.teamId, milestone, status, now),
    env.DB.prepare(`INSERT INTO cognee_sync_outbox (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at)
      VALUES (?,'progress_event',?,'agentforge_learning_signals',?,'pending',0,?)`).bind(crypto.randomUUID(), id, JSON.stringify({ schema_version: "agentforge.memory.v2", event_type: "progress_event", participant_id: auth.account!.participantId, team_id: auth.account!.teamId, milestone, status, source: "manual", occurred_at: new Date(now).toISOString(), evidence_type: "observed_fact" }), now),
  ]);
  return Response.json({ event: { id, milestone, status, source: "manual", occurredAt: now } });
}
