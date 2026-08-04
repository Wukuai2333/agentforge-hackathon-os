import { env, waitUntil } from "cloudflare:workers";
import { requireCurrentAccount } from "../../../lib/account";
import { syncPendingMemory } from "../../../lib/cognee-delivery";

export async function GET(request: Request) {
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const account = auth.account!;
  const [entries, reviews] = await Promise.all([
    env.DB.prepare(`SELECT m.id,m.entry_kind AS entryKind,m.category,m.statement,m.source_type AS sourceType,m.source_id AS sourceId,
      m.confidence_percent AS confidencePercent,m.confirmed_by_participant AS confirmedByParticipant,m.superseded_by_id AS supersededById,
      m.observed_at AS observedAt,m.created_at AS createdAt,c.status AS memoryStatus,c.dataset_name AS datasetName,c.synced_at AS memorySyncedAt,
      CASE WHEN m.source_type='assistant_prompt' THEN (SELECT user_prompt FROM prompt_events WHERE id=m.source_id)
           WHEN m.source_type='dynamic_survey' THEN (SELECT title FROM agent_projects WHERE id=m.source_id)
           ELSE NULL END AS evidencePreview
      FROM participant_model_entries m LEFT JOIN cognee_sync_outbox c ON c.source_type='participant_model' AND c.source_id=m.id
      WHERE m.anonymous_participant_id=? ORDER BY m.observed_at DESC`).bind(account.participantId).all(),
    env.DB.prepare(`SELECT r.id,r.entry_id AS entryId,r.action,r.replacement_entry_id AS replacementEntryId,r.note,r.created_at AS createdAt
      FROM participant_model_reviews r WHERE r.event_participant_id=? ORDER BY r.created_at DESC`).bind(account.participantId).all(),
  ]);
  return Response.json({ account, entries: entries.results, reviews: reviews.results }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const account = auth.account!;
  const input = await request.json() as { action?: "confirm" | "dispute" | "correct"; entryId?: string; note?: string; correction?: string };
  const entryId = input.entryId?.trim() || "";
  const entry = await env.DB.prepare("SELECT id,entry_kind AS entryKind,category,statement,superseded_by_id AS supersededById FROM participant_model_entries WHERE id=? AND anonymous_participant_id=?").bind(entryId, account.participantId).first<{ id: string; entryKind: string; category: string; statement: string; supersededById: string | null }>();
  if (!entry) return Response.json({ error: "Learning-model entry not found." }, { status: 404 });
  if (entry.supersededById) return Response.json({ error: "This entry has already been replaced by newer information." }, { status: 409 });
  const now = Date.now(), reviewId = crypto.randomUUID();
  if (input.action === "confirm") {
    const confirmationId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare("UPDATE participant_model_entries SET confirmed_by_participant=1 WHERE id=?").bind(entryId),
      env.DB.prepare(`INSERT INTO participant_model_entries (id,anonymous_participant_id,anonymous_team_id,entry_kind,category,statement,source_type,source_id,confidence_percent,confirmed_by_participant,observed_at,created_at)
        VALUES (?,?,?,'confirmation',?,?, 'participant_review',?,100,1,?,?)`).bind(confirmationId, account.participantId, account.teamId, entry.category, `Participant confirmed: ${entry.statement}`, entryId, now, now),
      env.DB.prepare("INSERT INTO participant_model_reviews (id,event_participant_id,entry_id,action,replacement_entry_id,note,created_at) VALUES (?,?,?,'confirmed',?,?,?)").bind(reviewId, account.participantId, entryId, confirmationId, input.note?.trim().slice(0, 1000) || null, now),
      env.DB.prepare(`INSERT INTO cognee_sync_outbox (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at) VALUES (?,'participant_model',?,'agentforge_learning_signals',?,'pending',0,?)`).bind(crypto.randomUUID(), confirmationId, JSON.stringify({ schema_version: "agentforge.memory.v2", event_type: "participant_model_confirmation", hackathon_event_id: account.eventId, participant_id: account.participantId, team_id: account.teamId, original_entry_id: entryId, category: entry.category, statement: entry.statement, action: "confirmed", confidence_percent: 100, evidence_type: "participant_confirmed_fact", memory_scope: "participant", occurred_at: new Date(now).toISOString() }), now),
    ]);
  } else if (input.action === "correct") {
    const correction = input.correction?.trim().slice(0, 2000) || "";
    if (!correction) return Response.json({ error: "Enter the corrected statement." }, { status: 400 });
    const replacementId = crypto.randomUUID();
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO participant_model_entries (id,anonymous_participant_id,anonymous_team_id,entry_kind,category,statement,source_type,source_id,confidence_percent,confirmed_by_participant,observed_at,created_at)
        VALUES (?,?,?,'fact',?,?, 'participant_correction',?,100,1,?,?)`).bind(replacementId, account.participantId, account.teamId, entry.category, correction, entryId, now, now),
      env.DB.prepare("UPDATE participant_model_entries SET superseded_by_id=? WHERE id=?").bind(replacementId, entryId),
      env.DB.prepare("INSERT INTO participant_model_reviews (id,event_participant_id,entry_id,action,replacement_entry_id,note,created_at) VALUES (?,?,?,'corrected',?,?,?)").bind(reviewId, account.participantId, entryId, replacementId, input.note?.trim().slice(0, 1000) || null, now),
      env.DB.prepare(`INSERT INTO cognee_sync_outbox (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at) VALUES (?,'participant_model',?,'agentforge_learning_signals',?,'pending',0,?)`).bind(crypto.randomUUID(), replacementId, JSON.stringify({ schema_version: "agentforge.memory.v2", event_type: "participant_model_fact", hackathon_event_id: account.eventId, participant_id: account.participantId, team_id: account.teamId, category: entry.category, statement: correction, source_type: "participant_correction", supersedes_entry_id: entryId, confidence_percent: 100, evidence_type: "participant_confirmed_fact", memory_scope: "participant", occurred_at: new Date(now).toISOString() }), now),
    ]);
  } else if (input.action === "dispute") {
    await env.DB.prepare("INSERT INTO participant_model_reviews (id,event_participant_id,entry_id,action,note,created_at) VALUES (?,?,?,'disputed',?,?)").bind(reviewId, account.participantId, entryId, input.note?.trim().slice(0, 1000) || "Participant disputed this interpretation.", now).run();
  } else return Response.json({ error: "Choose confirm, correct, or dispute." }, { status: 400 });
  waitUntil(syncPendingMemory(env, 20));
  return Response.json({ saved: true, action: input.action, reviewId });
}
