import { requireCurrentAccount } from "../../../lib/account";
import { syncPendingMemory } from "../../../lib/cognee-delivery";

type Runtime = { DB: D1Database; COGNEE_API_KEY?: string; COGNEE_API_URL?: string; COGNEE_LEARNING_DATASET?: string };
const RUBRIC_VERSION = "agentforge-prompt-coaching-v3";

function sanitize(value: string) {
  return value.replace(/sk-[A-Za-z0-9_-]{12,}/g, "[REDACTED API KEY]")
    .replace(/(password|api[_ -]?key|secret)\s*[:=]\s*\S+/gi, "$1=[REDACTED]");
}

export async function GET(request: Request) {
  const runtime = env as unknown as Runtime;
  const auth = await requireCurrentAccount(request, runtime.DB);
  if (auth.error) return auth.error;
  const participantId = auth.account!.participantId;
  const [items, actions] = await Promise.all([
    runtime.DB.prepare(`SELECT pe.id,pe.parent_prompt_event_id AS parentPromptEventId,pe.conversation_id AS conversationId,
      pe.page,pe.tutorial_step AS tutorialStep,pe.task_reference AS taskReference,pe.user_prompt AS userPrompt,
      pe.response_text AS responseText,pe.user_feedback AS userFeedback,pe.outcome_status AS outcomeStatus,
      pe.outcome_evidence AS outcomeEvidence,pe.created_at AS createdAt,parent.user_prompt AS parentPrompt,
      ev.id AS evaluationId,ev.rubric_version AS rubricVersion,ev.evaluator,ev.evaluation_json AS evaluationJson,
      ev.total_score AS totalScore,ev.created_at AS evaluatedAt
      FROM prompt_events pe LEFT JOIN prompt_events parent ON parent.id=pe.parent_prompt_event_id
      LEFT JOIN prompt_evaluations ev ON ev.prompt_event_id=pe.id AND ev.rubric_version=?
      WHERE pe.anonymous_participant_id=? AND pe.status='success' ORDER BY pe.created_at DESC LIMIT 100`)
      .bind(RUBRIC_VERSION, participantId).all(),
    runtime.DB.prepare(`SELECT id,prompt_event_id AS promptEventId,evaluation_id AS evaluationId,action,note,created_at AS createdAt
      FROM prompt_coaching_actions WHERE participant_id=? ORDER BY created_at DESC LIMIT 200`).bind(participantId).all(),
  ]);
  return Response.json({ rubricVersion: RUBRIC_VERSION, items: items.results, actions: actions.results }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const runtime = env as unknown as Runtime;
  const auth = await requireCurrentAccount(request, runtime.DB);
  if (auth.error) return auth.error;
  const input = await request.json() as { promptEventId?: string; evaluationId?: string; action?: string; outcomeStatus?: string; note?: string };
  const promptEventId = input.promptEventId?.trim().slice(0, 100) || "";
  const participantId = auth.account!.participantId;
  const prompt = await runtime.DB.prepare("SELECT id,anonymous_team_id AS teamId FROM prompt_events WHERE id=? AND anonymous_participant_id=?")
    .bind(promptEventId, participantId).first<{ id: string; teamId: string | null }>();
  if (!prompt) return Response.json({ error: "Prompt not found for this participant." }, { status: 404 });

  const actionMap: Record<string, "copied_revision" | "adopted_revision" | "dismissed_coaching" | "recorded_outcome"> = {
    copied_revision: "copied_revision", adopted_revision: "adopted_revision",
    dismissed_coaching: "dismissed_coaching", record_outcome: "recorded_outcome",
  };
  const action = input.action ? actionMap[input.action] : null;
  if (!action) return Response.json({ error: "Valid coaching action required." }, { status: 400 });
  const evaluationId = input.evaluationId?.trim().slice(0, 100) || null;
  if (evaluationId) {
    const evaluation = await runtime.DB.prepare("SELECT id FROM prompt_evaluations WHERE id=? AND prompt_event_id=?").bind(evaluationId, promptEventId).first();
    if (!evaluation) return Response.json({ error: "Evaluation does not belong to this Prompt." }, { status: 400 });
  }

  const now = Date.now(), actionId = crypto.randomUUID();
  const note = sanitize(input.note?.trim().slice(0, 2000) || "");
  const statements = [] as D1PreparedStatement[];
  if (action === "recorded_outcome") {
    const outcomeStatus = input.outcomeStatus === "worked" || input.outcomeStatus === "partial" || input.outcomeStatus === "not_worked" ? input.outcomeStatus : null;
    if (!outcomeStatus) return Response.json({ error: "Choose worked, partial, or not worked." }, { status: 400 });
    statements.push(runtime.DB.prepare("UPDATE prompt_events SET outcome_status=?,outcome_evidence=? WHERE id=? AND anonymous_participant_id=?")
      .bind(outcomeStatus, note || null, promptEventId, participantId));
    statements.push(runtime.DB.prepare("UPDATE prompt_evaluations SET rubric_version=rubric_version||'-superseded-'||? WHERE prompt_event_id=? AND rubric_version=?")
      .bind(String(now), promptEventId, RUBRIC_VERSION));
  }
  statements.push(runtime.DB.prepare(`INSERT INTO prompt_coaching_actions (id,prompt_event_id,evaluation_id,participant_id,action,note,created_at)
    VALUES (?,?,?,?,?,?,?)`).bind(actionId, promptEventId, evaluationId, participantId, action, note || null, now));
  statements.push(runtime.DB.prepare(`INSERT INTO cognee_sync_outbox (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at)
    VALUES (?,'coaching_action',?,'agentforge_learning_signals',?,'pending',0,?)`).bind(crypto.randomUUID(), actionId, JSON.stringify({
      schema_version: "agentforge.prompt-coaching.v3", event_type: "participant_coaching_action", coaching_action_id: actionId,
      prompt_event_id: promptEventId, evaluation_id: evaluationId, participant_id: participantId, team_id: prompt.teamId,
      action, outcome_status: action === "recorded_outcome" ? input.outcomeStatus : undefined,
      participant_note: note || null, occurred_at: new Date(now).toISOString(), evidence_type: "participant_reported_fact",
    }), now));
  await runtime.DB.batch(statements);
  waitUntil(syncPendingMemory(runtime, 10));
  return Response.json({ saved: true, action, actionId, reevaluationRequired: action === "recorded_outcome" });
}
