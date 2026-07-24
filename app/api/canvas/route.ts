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

  const projectPayload = JSON.stringify({
    schema_version: "agentforge.memory.v2", event_type: "agent_project",
    project_id: id, participant_id: input.anonymousParticipantId, title,
    problem: answers[0], current_workflow: answers[1], data_boundaries: answers[2],
    success_criteria: answers[3], memory_requirements: answers[4],
    evidence_type: "participant_reported_fact", occurred_at: new Date(now).toISOString(),
  });
  const modelEntries = [
    ["problem_goal", answers[0]], ["current_workflow", answers[1]], ["data_boundaries", answers[2]],
    ["success_criteria", answers[3]], ["memory_requirements", answers[4]],
  ].map(([category, statement]) => ({ id: crypto.randomUUID(), category, statement }));
  await env.DB.batch([env.DB.prepare(
    `INSERT INTO agent_projects
      (id, anonymous_participant_id, title, problem, current_workflow, data_boundaries,
       success_criteria, memory_requirements, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'building', ?, ?)`,
  ).bind(id, input.anonymousParticipantId, title, answers[0], answers[1], answers[2], answers[3], answers[4], now, now),
  ...modelEntries.flatMap((entry) => [
    env.DB.prepare(`INSERT INTO participant_model_entries
      (id,anonymous_participant_id,entry_kind,category,statement,source_type,source_id,confirmed_by_participant,observed_at,created_at)
      VALUES (?,?,'fact',?,?, 'dynamic_survey',?,1,?,?)`)
      .bind(entry.id, input.anonymousParticipantId, entry.category, entry.statement, id, now, now),
    env.DB.prepare(`INSERT INTO cognee_sync_outbox
      (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at)
      VALUES (?,'participant_model',?,'agentforge_learning_signals',?,'pending',0,?)`)
      .bind(crypto.randomUUID(), entry.id, JSON.stringify({
        schema_version: "agentforge.memory.v2", event_type: "participant_model_fact",
        participant_id: input.anonymousParticipantId, category: entry.category,
        statement: entry.statement, source_type: "dynamic_survey", source_id: id,
        evidence_type: "participant_reported_fact", occurred_at: new Date(now).toISOString(),
      }), now),
  ]),
  env.DB.prepare(`INSERT INTO cognee_sync_outbox
    (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at)
    VALUES (?,'agent_project',?,'agentforge_learning_signals',?,'pending',0,?)`)
    .bind(crypto.randomUUID(), id, projectPayload, now)]);

  return Response.json({ id, title, status: "building", savedAt: now });
}
