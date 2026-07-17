import { env } from "cloudflare:workers";

type CanvasInput = {
  anonymousParticipantId?: string;
  answers?: string[];
};

export async function POST(request: Request) {
  const input = (await request.json()) as CanvasInput;
  const answers = input.answers ?? [];

  if (!input.anonymousParticipantId || answers.length < 5 || answers.some((item) => !item.trim())) {
    return Response.json({ error: "Canvas answers are incomplete." }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const now = Date.now();
  const title = "Personal knowledge continuity agent";

  await env.DB.prepare(
    `INSERT INTO agent_projects
      (id, anonymous_participant_id, title, problem, current_workflow, data_boundaries,
       success_criteria, memory_requirements, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'building', ?, ?)`,
  ).bind(id, input.anonymousParticipantId, title, answers[0], answers[1], answers[2], answers[3], answers[4], now, now).run();

  return Response.json({ id, title, status: "building", savedAt: now });
}
