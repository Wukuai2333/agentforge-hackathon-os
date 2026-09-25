import { env } from "cloudflare:workers";
import { requireCurrentAccount } from "../../../lib/account";

type LearningNoteInput = {
  noteId?: string;
  content?: string;
  selectedText?: string;
  sourceType?: "manual" | "selection" | "assistant";
  sourcePage?: string;
  sourcePromptEventId?: string;
};

const clean = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : "";

export async function GET(request: Request) {
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const participantId = auth.account!.participantId;
  const [notes, prompts] = await Promise.all([
    env.DB.prepare(`SELECT id,content,selected_text AS selectedText,source_type AS sourceType,
      source_page AS sourcePage,source_prompt_event_id AS sourcePromptEventId,
      created_at AS createdAt,updated_at AS updatedAt
      FROM learner_notes WHERE event_participant_id=? ORDER BY updated_at DESC LIMIT 200`).bind(participantId).all(),
    env.DB.prepare(`SELECT id,page,tutorial_step AS tutorialStep,user_prompt AS userPrompt,
      response_text AS responseText,status,user_feedback AS userFeedback,created_at AS createdAt
      FROM prompt_events WHERE anonymous_participant_id=? ORDER BY created_at DESC LIMIT 200`).bind(participantId).all(),
  ]);
  return Response.json({ notes: notes.results, prompts: prompts.results }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const input = await request.json() as LearningNoteInput;
  const content = clean(input.content, 8000);
  const selectedText = clean(input.selectedText, 4000);
  const sourcePage = clean(input.sourcePage, 160);
  const sourcePromptEventId = clean(input.sourcePromptEventId, 120);
  const sourceType = input.sourceType === "selection" || input.sourceType === "assistant" ? input.sourceType : "manual";
  if (!content && !selectedText) return Response.json({ error: "Write a note or select text first." }, { status: 400 });
  if (sourceType === "assistant" && sourcePromptEventId) {
    const owned = await env.DB.prepare("SELECT id FROM prompt_events WHERE id=? AND anonymous_participant_id=?").bind(sourcePromptEventId, auth.account!.participantId).first();
    if (!owned) return Response.json({ error: "The linked Ask AI response was not found." }, { status: 404 });
  }
  const now = Date.now();
  const note = {
    id: crypto.randomUUID(), content: content || selectedText, selectedText: selectedText || null,
    sourceType, sourcePage: sourcePage || null, sourcePromptEventId: sourcePromptEventId || null,
    createdAt: now, updatedAt: now,
  };
  await env.DB.prepare(`INSERT INTO learner_notes
    (id,event_participant_id,event_id,content,selected_text,source_type,source_page,source_prompt_event_id,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(note.id, auth.account!.participantId, auth.account!.eventId, note.content,
      note.selectedText, note.sourceType, note.sourcePage, note.sourcePromptEventId, now, now).run();
  return Response.json({ note }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const input = await request.json() as LearningNoteInput;
  const noteId = clean(input.noteId, 120);
  const content = clean(input.content, 8000);
  if (!noteId || !content) return Response.json({ error: "Note and content are required." }, { status: 400 });
  const updatedAt = Date.now();
  const result = await env.DB.prepare(`UPDATE learner_notes SET content=?,updated_at=?
    WHERE id=? AND event_participant_id=?`).bind(content, updatedAt, noteId, auth.account!.participantId).run();
  if (!result.meta.changes) return Response.json({ error: "Note not found." }, { status: 404 });
  return Response.json({ note: { id: noteId, content, updatedAt } });
}
