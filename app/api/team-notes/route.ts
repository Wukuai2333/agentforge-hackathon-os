import { env } from "cloudflare:workers";

type NoteInput = {
  teamId?: string;
  authorId?: string;
  authorName?: string;
  content?: string;
  sourceType?: "manual" | "assistant";
  sourcePromptEventId?: string;
};

export async function GET(request: Request) {
  const teamId = new URL(request.url).searchParams.get("teamId")?.slice(0, 100) || "team-synapse-demo";
  const result = await env.DB.prepare(
    `SELECT id, team_id AS teamId, author_id AS authorId, author_name AS authorName,
            content, source_type AS sourceType, source_prompt_event_id AS sourcePromptEventId,
            created_at AS createdAt
       FROM shared_notes WHERE team_id = ? ORDER BY created_at DESC LIMIT 100`,
  ).bind(teamId).all();
  return Response.json({ notes: result.results });
}

export async function POST(request: Request) {
  const input = (await request.json()) as NoteInput;
  const teamId = input.teamId?.trim().slice(0, 100) || "team-synapse-demo";
  const authorId = input.authorId?.trim().slice(0, 100) || "anonymous";
  const authorName = input.authorName?.trim().slice(0, 80) || "Hackathon participant";
  const content = input.content?.trim().slice(0, 8000) || "";
  if (!content) return Response.json({ error: "Note content is required." }, { status: 400 });

  const note = {
    id: crypto.randomUUID(), teamId, authorId, authorName, content,
    sourceType: input.sourceType === "assistant" ? "assistant" : "manual",
    sourcePromptEventId: input.sourcePromptEventId?.trim() || null,
    createdAt: Date.now(),
  };
  await env.DB.prepare(
    `INSERT INTO shared_notes
      (id, team_id, author_id, author_name, content, source_type, source_prompt_event_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(note.id, note.teamId, note.authorId, note.authorName, note.content, note.sourceType, note.sourcePromptEventId, note.createdAt).run();
  return Response.json({ note }, { status: 201 });
}
