import { env, waitUntil } from "cloudflare:workers";
import { requireCurrentAccount } from "../../../lib/account";
import { syncPendingMemory } from "../../../lib/cognee-delivery";

type NoteInput = {
  teamId?: string;
  authorId?: string;
  authorName?: string;
  content?: string;
  sourceType?: "manual" | "assistant";
  sourcePromptEventId?: string;
  noteId?: string;
  attributionJson?: string;
  expectedUpdatedAt?: number | null;
};

export async function GET(request: Request) {
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const teamId = auth.account!.teamId;
  if (!teamId) return Response.json({ notes: [], teamRequired: true });
  const result = await env.DB.prepare(
    `SELECT id, team_id AS teamId, author_id AS authorId, author_name AS authorName,
            content, source_type AS sourceType, source_prompt_event_id AS sourcePromptEventId,
            attribution_json AS attributionJson, updated_by_id AS updatedById,
            updated_by_name AS updatedByName, created_at AS createdAt, updated_at AS updatedAt, revision
       FROM shared_notes WHERE team_id = ? ORDER BY created_at DESC LIMIT 100`,
  ).bind(teamId).all();
  return Response.json({ notes: result.results });
}

export async function POST(request: Request) {
  const input = (await request.json()) as NoteInput;
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const teamId = auth.account!.teamId;
  if (!teamId) return Response.json({ error: "Join or create a team before adding shared notes." }, { status: 409 });
  const authorId = auth.account!.participantId;
  const authorName = auth.account!.displayName;
  const content = input.content?.trim().slice(0, 8000) || "";
  if (!content) return Response.json({ error: "Note content is required." }, { status: 400 });

  const note = {
    id: crypto.randomUUID(), teamId, authorId, authorName, content,
    sourceType: input.sourceType === "assistant" ? "assistant" : "manual",
    sourcePromptEventId: input.sourcePromptEventId?.trim() || null,
    createdAt: Date.now(), revision: 1,
    attributionJson: JSON.stringify([{ text: content, editorName: authorName, color: "violet" }]),
  };
  await env.DB.batch([env.DB.prepare(
    `INSERT INTO shared_notes
      (id, team_id, author_id, author_name, content, source_type, source_prompt_event_id, attribution_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(note.id, note.teamId, note.authorId, note.authorName, note.content, note.sourceType, note.sourcePromptEventId, note.attributionJson, note.createdAt),
  env.DB.prepare(`INSERT INTO cognee_sync_outbox
    (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at)
    VALUES (?,'shared_note',?,'agentforge_learning_signals',?,'pending',0,?)`)
    .bind(crypto.randomUUID(), note.id, JSON.stringify({
      schema_version: "agentforge.memory.v2", event_type: "team_shared_note",
      note_id: note.id, hackathon_event_id: auth.account!.eventId, team_id: note.teamId, participant_id: note.authorId,
      author_name: note.authorName, content: note.content, source_type: note.sourceType,
      source_prompt_event_id: note.sourcePromptEventId, occurred_at: new Date(note.createdAt).toISOString(),
      evidence_type: "team_authored_fact",
    }), note.createdAt)]);
  waitUntil(syncPendingMemory(env, 20));
  return Response.json({ note }, { status: 201 });
}

export async function PATCH(request: Request) {
  const input = (await request.json()) as NoteInput;
  const noteId = input.noteId?.trim();
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const teamId = auth.account!.teamId;
  if (!teamId) return Response.json({ error: "Join or create a team before editing shared notes." }, { status: 409 });
  const editorId = auth.account!.participantId;
  const editorName = auth.account!.displayName;
  const content = input.content?.trim().slice(0, 8000) || "";
  if (!noteId || !content) return Response.json({ error: "Note and content are required." }, { status: 400 });
  const existing = await env.DB.prepare("SELECT content,updated_at AS updatedAt,revision FROM shared_notes WHERE id=? AND team_id=?").bind(noteId, teamId).first<{ content: string; updatedAt: number | null; revision: number }>();
  if (!existing) return Response.json({ error: "Shared note not found for this team." }, { status: 404 });
  if ((input.expectedUpdatedAt ?? null) !== (existing.updatedAt ?? null)) {
    const current = await env.DB.prepare(`SELECT id,author_name AS authorName,content,source_type AS sourceType,attribution_json AS attributionJson,updated_by_name AS updatedByName,created_at AS createdAt,updated_at AS updatedAt,revision FROM shared_notes WHERE id=?`).bind(noteId).first();
    return Response.json({ error: "A teammate edited this note while you were working. Review the latest version before saving again.", conflict: true, current }, { status: 409 });
  }
  let attributionJson = input.attributionJson || "[]";
  try { const parsed = JSON.parse(attributionJson); if (!Array.isArray(parsed)) throw new Error(); }
  catch { attributionJson = JSON.stringify([{ text: content, editorName, color: "violet" }]); }
  const updatedAt = Date.now();
  const revisionId = crypto.randomUUID();
  await env.DB.batch([
    env.DB.prepare(`UPDATE shared_notes SET content=?,attribution_json=?,updated_by_id=?,updated_by_name=?,updated_at=?,revision=revision+1 WHERE id=? AND team_id=?`)
      .bind(content, attributionJson, editorId, editorName, updatedAt, noteId, teamId),
    env.DB.prepare(`INSERT INTO shared_note_revisions (id,note_id,team_id,editor_id,editor_name,previous_content,next_content,attribution_json,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`).bind(revisionId, noteId, teamId, editorId, editorName, existing.content, content, attributionJson, updatedAt),
    env.DB.prepare(`INSERT INTO cognee_sync_outbox
      (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at)
      VALUES (?,'shared_note',?,'agentforge_learning_signals',?,'pending',0,?)`)
      .bind(crypto.randomUUID(), revisionId, JSON.stringify({
        schema_version: "agentforge.memory.v2", event_type: "team_shared_note_revision",
        note_id: noteId, revision_id: revisionId, hackathon_event_id: auth.account!.eventId, team_id: teamId, participant_id: editorId,
        editor_name: editorName, previous_content: existing.content, content,
        occurred_at: new Date(updatedAt).toISOString(), evidence_type: "team_authored_fact",
      }), updatedAt),
  ]);
  waitUntil(syncPendingMemory(env, 20));
  return Response.json({ note: { id: noteId, teamId, content, attributionJson, updatedById: editorId, updatedByName: editorName, updatedAt, revision: existing.revision + 1 } });
}
