import { env, waitUntil } from "cloudflare:workers";
import { requireCurrentAccount } from "../../../lib/account";
import { syncPendingMemory } from "../../../lib/cognee-delivery";

type BlueprintAnswer = { selections?: unknown; detail?: unknown; customOther?: unknown };
type BlueprintAnswers = Record<string, BlueprintAnswer>;
type CanvasInput = {
  answers?: BlueprintAnswers;
  currentStep?: number;
  eventType?: string;
  questionId?: string;
  selectedUseCaseId?: string;
  scaffoldAction?: string;
  supportLevel?: string;
  feviStage?: string;
};

const BLUEPRINT_VERSION = "agentforge-agent-blueprint-v1";
const questionIds = ["context", "problem", "trigger", "inputs", "responsibilities", "checkpoints", "evidence", "memory"] as const;
const requiredQuestionIds = questionIds.filter((id) => id !== "memory");
const labels: Record<(typeof questionIds)[number], string> = {
  context: "User and context", problem: "Problem", trigger: "Trigger", inputs: "Inputs and boundaries",
  responsibilities: "Agent responsibilities", checkpoints: "Human checkpoints", evidence: "Success and failure test", memory: "Memory and reporting",
};
const allowedEvents = new Set(["draft_autosave", "answer_saved", "example_opened", "answer_revisited", "blueprint_completed", "blueprint_revised"]);

function cleanText(value: unknown, max = 1800) { return String(value || "").trim().replace(/\s+/g, " ").slice(0, max); }

function cleanAnswers(input: BlueprintAnswers | undefined) {
  return Object.fromEntries(questionIds.map((id) => {
    const answer = input?.[id] || {};
    const selections = Array.isArray(answer.selections)
      ? [...new Set(answer.selections.map((item) => cleanText(item, 120)).filter(Boolean))].slice(0, 8)
      : [];
    const customOther = Array.isArray(answer.customOther)
      ? answer.customOther.map((item) => cleanText(item, 180)).filter(Boolean).slice(0, 3)
      : [];
    return [id, { selections, detail: cleanText(answer.detail), customOther }];
  })) as Record<(typeof questionIds)[number], { selections: string[]; detail: string; customOther: string[] }>;
}

function answerStatement(answer: { selections: string[]; detail: string; customOther: string[] }) {
  return [
    ...answer.selections.filter((item) => item !== "Other"),
    ...answer.customOther.map((item) => `Other: ${item}`),
    answer.detail,
  ].filter(Boolean).join(" · ");
}
function parseAnswers(value: unknown) { try { return cleanAnswers(JSON.parse(String(value || "{}")) as BlueprintAnswers); } catch { return cleanAnswers(undefined); } }
function selectedUseCaseFromAnswers(value: unknown) {
  try { return cleanText((JSON.parse(String(value || "{}")) as { _meta?: { selectedUseCaseId?: unknown } })._meta?.selectedUseCaseId, 80) || null; }
  catch { return null; }
}
function serializeAnswers(answers: ReturnType<typeof cleanAnswers>, selectedUseCaseId: unknown) {
  return JSON.stringify({ ...answers, _meta: { selectedUseCaseId: cleanText(selectedUseCaseId, 80) || null } });
}

async function recordDesignEvent(account: { participantId: string; eventId: string; teamId: string | null }, eventType: string, questionId: string, payload: unknown, now: number) {
  if (!allowedEvents.has(eventType)) return;
  await env.DB.prepare(`INSERT INTO agent_design_events
    (id,event_participant_id,event_id,team_id,event_type,question_id,payload_json,occurred_at)
    VALUES (?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), account.participantId, account.eventId, account.teamId, eventType, cleanText(questionId, 80) || null, JSON.stringify(payload), now).run();
}

export async function GET(request: Request) {
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const row = await env.DB.prepare(`SELECT blueprint_version AS blueprintVersion,answers_json AS answersJson,current_step AS currentStep,
    status,project_id AS projectId,created_at AS createdAt,updated_at AS updatedAt,completed_at AS completedAt
    FROM agent_design_blueprints WHERE event_participant_id=?`).bind(auth.account!.participantId).first();
  return Response.json({ blueprint: row ? { ...row, answers: parseAnswers(row.answersJson), selectedUseCaseId: selectedUseCaseFromAnswers(row.answersJson), answersJson: undefined } : {
    blueprintVersion: BLUEPRINT_VERSION, answers: cleanAnswers(undefined), currentStep: 0, status: "draft", projectId: null, selectedUseCaseId: null,
  } }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const input = await request.json() as CanvasInput;
  const answers = cleanAnswers(input.answers);
  const currentStep = Math.max(0, Math.min(questionIds.length, Number(input.currentStep) || 0));
  const now = Date.now();
  const existing = await env.DB.prepare("SELECT created_at AS createdAt,project_id AS projectId,status FROM agent_design_blueprints WHERE event_participant_id=?")
    .bind(auth.account!.participantId).first<{ createdAt: number; projectId: string | null; status: "draft" | "completed" }>();
  const requestedEvent = cleanText(input.eventType, 40);
  const scaffoldOpened = requestedEvent === "scaffold_opened";
  const eventType = scaffoldOpened ? "answer_revisited" : allowedEvents.has(requestedEvent) ? requestedEvent : "draft_autosave";
  const nextStatus = eventType === "draft_autosave" || eventType === "answer_saved" ? "draft" : existing?.status || "draft";
  await env.DB.prepare(`INSERT INTO agent_design_blueprints
    (event_participant_id,event_id,team_id,blueprint_version,answers_json,current_step,status,project_id,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(event_participant_id) DO UPDATE SET team_id=excluded.team_id,blueprint_version=excluded.blueprint_version,
      answers_json=excluded.answers_json,current_step=excluded.current_step,status=excluded.status,updated_at=excluded.updated_at`)
    .bind(auth.account!.participantId, auth.account!.eventId, auth.account!.teamId, BLUEPRINT_VERSION, serializeAnswers(answers, input.selectedUseCaseId), currentStep, nextStatus, existing?.projectId || null, existing?.createdAt || now, now).run();
  const questionId = cleanText(input.questionId, 80);
  const eventQuestionId = questionIds.find((id) => id === questionId);
  await recordDesignEvent(auth.account!, eventType, questionId, {
    currentStep,
    answeredQuestionIds: questionIds.filter((id) => answerStatement(answers[id])),
    answer: eventQuestionId ? answers[eventQuestionId] : null,
    interactionType: scaffoldOpened ? "ai_scaffold_opened" : undefined,
    scaffoldAction: scaffoldOpened ? cleanText(input.scaffoldAction, 30) : undefined,
    supportLevel: scaffoldOpened ? cleanText(input.supportLevel, 30) : undefined,
    feviStage: scaffoldOpened ? cleanText(input.feviStage, 30) : undefined,
    selectedUseCaseId: cleanText(input.selectedUseCaseId, 80) || null,
  }, now);
  return Response.json({ saved: true, currentStep, updatedAt: now });
}

export async function POST(request: Request) {
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const input = await request.json() as CanvasInput;
  const answers = cleanAnswers(input.answers);
  const missing = requiredQuestionIds.filter((id) => !answerStatement(answers[id]));
  if (missing.length) return Response.json({ error: `Complete these Blueprint sections first: ${missing.map((id) => labels[id]).join(", ")}.` }, { status: 400 });

  const existing = await env.DB.prepare(`SELECT project_id AS projectId,status,created_at AS createdAt
    FROM agent_design_blueprints WHERE event_participant_id=?`).bind(auth.account!.participantId).first<{ projectId: string | null; status: string; createdAt: number }>();
  const projectId = existing?.projectId || crypto.randomUUID();
  const now = Date.now();
  const problem = answerStatement(answers.problem);
  const title = `${problem.slice(0, 72)}${problem.length > 72 ? "…" : ""}`;
  const currentWorkflow = [answerStatement(answers.context), answerStatement(answers.trigger), answerStatement(answers.responsibilities)].filter(Boolean).join(" | ");
  const dataBoundaries = answerStatement(answers.inputs);
  const successCriteria = answerStatement(answers.evidence);
  const memoryRequirements = answerStatement(answers.memory);
  const eventType = existing?.status === "completed" ? "blueprint_revised" : "blueprint_completed";
  const modelFacts = questionIds.map((category) => ({ id: crypto.randomUUID(), category, statement: `${labels[category]}: ${answerStatement(answers[category]) || "Not specified"}` }));
  const payload = { schema_version: "agentforge.memory.v2", event_type: "agent_project", blueprint_version: BLUEPRINT_VERSION,
    project_id: projectId, hackathon_event_id: auth.account!.eventId, participant_id: auth.account!.participantId,
    team_id: auth.account!.teamId, title, answers, evidence_type: "participant_reported_fact", occurred_at: new Date(now).toISOString() };
  const statements = [
    env.DB.prepare(`INSERT INTO agent_design_blueprints
      (event_participant_id,event_id,team_id,blueprint_version,answers_json,current_step,status,project_id,created_at,updated_at,completed_at)
      VALUES (?,?,?,?,?,?,'completed',?,?,?,?)
      ON CONFLICT(event_participant_id) DO UPDATE SET team_id=excluded.team_id,blueprint_version=excluded.blueprint_version,
        answers_json=excluded.answers_json,current_step=excluded.current_step,status='completed',project_id=excluded.project_id,
        updated_at=excluded.updated_at,completed_at=excluded.completed_at`)
      .bind(auth.account!.participantId, auth.account!.eventId, auth.account!.teamId, BLUEPRINT_VERSION, serializeAnswers(answers, input.selectedUseCaseId), questionIds.length, projectId, existing?.createdAt || now, now, now),
    env.DB.prepare(`INSERT INTO agent_projects
      (id,anonymous_participant_id,team_id,title,problem,current_workflow,data_boundaries,success_criteria,memory_requirements,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,'building',?,?)
      ON CONFLICT(id) DO UPDATE SET team_id=excluded.team_id,title=excluded.title,problem=excluded.problem,current_workflow=excluded.current_workflow,
        data_boundaries=excluded.data_boundaries,success_criteria=excluded.success_criteria,memory_requirements=excluded.memory_requirements,updated_at=excluded.updated_at`)
      .bind(projectId, auth.account!.participantId, auth.account!.teamId, title, problem, currentWorkflow, dataBoundaries, successCriteria, memoryRequirements, existing?.createdAt || now, now),
    ...modelFacts.flatMap((fact) => [
      env.DB.prepare(`UPDATE participant_model_entries SET superseded_by_id=? WHERE anonymous_participant_id=? AND entry_kind='fact'
        AND source_type='agent_blueprint' AND source_id=? AND category=? AND superseded_by_id IS NULL`).bind(fact.id, auth.account!.participantId, projectId, fact.category),
      env.DB.prepare(`INSERT INTO participant_model_entries
        (id,anonymous_participant_id,anonymous_team_id,entry_kind,category,statement,source_type,source_id,confirmed_by_participant,observed_at,created_at)
        VALUES (?,?,?,'fact',?,?,'agent_blueprint',?,1,?,?)`).bind(fact.id, auth.account!.participantId, auth.account!.teamId, fact.category, fact.statement, projectId, now, now),
      env.DB.prepare(`INSERT INTO cognee_sync_outbox
        (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at)
        VALUES (?,'participant_model',?,'agentforge_learning_signals',?,'pending',0,?)`).bind(crypto.randomUUID(), fact.id, JSON.stringify({
          schema_version: "agentforge.memory.v2", event_type: "participant_model_fact", hackathon_event_id: auth.account!.eventId,
          participant_id: auth.account!.participantId, team_id: auth.account!.teamId, category: fact.category, statement: fact.statement,
          source_type: "agent_blueprint", source_id: projectId, evidence_type: "participant_reported_fact", occurred_at: new Date(now).toISOString(),
        }), now),
    ]),
    env.DB.prepare(`INSERT INTO cognee_sync_outbox
      (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at)
      VALUES (?,'agent_project',?,'agentforge_learning_signals',?,'pending',0,?)`).bind(crypto.randomUUID(), projectId, JSON.stringify(payload), now),
  ];
  await env.DB.batch(statements);
  await recordDesignEvent(auth.account!, eventType, "review", { projectId, answers, completedQuestionIds: questionIds.filter((id) => answerStatement(answers[id])) }, now);
  waitUntil(syncPendingMemory(env, 25));
  return Response.json({ id: projectId, title, status: "building", savedAt: now });
}
