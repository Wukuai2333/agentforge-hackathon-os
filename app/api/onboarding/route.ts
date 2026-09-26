import { env, waitUntil } from "cloudflare:workers";
import { requireCurrentAccount } from "../../../lib/account";
import { wakeCogneeSync } from "../../../lib/cognee-delivery";

type ResponseLength = "brief" | "balanced" | "detailed";
type InteractionMode = "guide" | "collaborate" | "direct";
type Answer = { id: string; value: string };
type Input = { answers?: Answer[]; responseLength?: ResponseLength; interactionMode?: InteractionMode; draft?: boolean; currentStep?: number; changeSource?: string; orientationAcknowledged?: boolean };

const ONBOARDING_VERSION = "agentforge-mira-interviewer-v2";
const ORIENTATION_VERSION = "agentforge-fevi-orientation-v1";
const questionIds = ["introduction", "background", "stage", "field", "ai_experience", "agent_experience", "cognee_familiarity", "clawmax_familiarity", "learning_goal", "baseline_confidence"] as const;
const required = ["background", "stage", "field", "ai_experience", "agent_experience", "cognee_familiarity", "clawmax_familiarity", "learning_goal", "baseline_confidence"] as const;
const categoryLabels: Record<(typeof questionIds)[number], string> = {
  introduction: "Self introduction",
  background: "Current background",
  stage: "Education or career stage",
  field: "Major or primary field",
  ai_experience: "Prior AI-tool experience",
  agent_experience: "Prior agent-building experience",
  cognee_familiarity: "Cognee familiarity",
  clawmax_familiarity: "ClawMax or OpenClaw familiarity",
  learning_goal: "Hackathon learning goal",
  baseline_confidence: "Baseline confidence designing and testing a memory-enabled agent",
};

function isFollowupId(value: string) { return /^mira_followup_[12]$/.test(value); }
function acceptedAnswerId(value: string) { return (questionIds as readonly string[]).includes(value) || isFollowupId(value); }
function answerLabel(id: string) { return categoryLabels[id as keyof typeof categoryLabels] || `Mira optional follow-up ${id.endsWith("2") ? "2" : "1"}`; }

function validLength(value: unknown): value is ResponseLength { return value === "brief" || value === "balanced" || value === "detailed"; }
function validMode(value: unknown): value is InteractionMode { return value === "guide" || value === "collaborate" || value === "direct"; }
function clean(value: unknown) { return String(value || "").trim().replace(/\s+/g, " ").slice(0, 1200); }

export async function GET(request: Request) {
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const [profile, draft, generatedQuestions, revisions] = await Promise.all([env.DB.prepare(`SELECT onboarding_version AS onboardingVersion,answers_json AS answersJson,
      response_length AS responseLength,interaction_mode AS interactionMode,completed_at AS completedAt,updated_at AS updatedAt
    FROM participant_onboarding_profiles WHERE participant_id=?`).bind(auth.account!.participantId).first(),
    env.DB.prepare(`SELECT answers_json AS answersJson,current_step AS currentStep,response_length AS responseLength,
      interaction_mode AS interactionMode,updated_at AS updatedAt FROM participant_onboarding_drafts WHERE participant_id=?`)
      .bind(auth.account!.participantId).first(),
    env.DB.prepare(`SELECT question_id AS id,prompt_text AS prompt,source,branch_rule AS branchRule,created_at AS createdAt
      FROM participant_interview_events WHERE participant_id=? AND event_type IN ('followup_generated','followup_fallback')
      ORDER BY created_at ASC`).bind(auth.account!.participantId).all(),
    env.DB.prepare(`SELECT id,answers_json AS answersJson,response_length AS responseLength,interaction_mode AS interactionMode,
      change_source AS changeSource,created_at AS createdAt FROM participant_onboarding_revisions
      WHERE participant_id=? ORDER BY created_at DESC LIMIT 20`).bind(auth.account!.participantId).all()]);
  return Response.json({
    completed: Boolean(profile),
    profile: profile ? { ...profile, answers: JSON.parse(String(profile.answersJson || "[]")), answersJson: undefined } : null,
    draft: draft ? { ...draft, answers: JSON.parse(String(draft.answersJson || "[]")), answersJson: undefined } : null,
    dynamicQuestions: generatedQuestions.results,
    revisions: revisions.results.map((revision) => ({ ...revision, answers: JSON.parse(String(revision.answersJson || "[]")), answersJson: undefined })),
  });
}

export async function POST(request: Request) {
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const input = await request.json() as Input;
  if (input.orientationAcknowledged) {
    const acknowledgedAt = Date.now();
    await env.DB.prepare(`INSERT INTO participant_orientation_acknowledgements
      (participant_id,orientation_version,acknowledged_at) VALUES (?,?,?)
      ON CONFLICT(participant_id) DO UPDATE SET orientation_version=excluded.orientation_version,acknowledged_at=excluded.acknowledged_at`)
      .bind(auth.account!.participantId, ORIENTATION_VERSION, acknowledgedAt).run();
    return Response.json({ acknowledged: true, orientationVersion: ORIENTATION_VERSION, acknowledgedAt });
  }
  const responseLength = validLength(input.responseLength) ? input.responseLength : "brief";
  const interactionMode = validMode(input.interactionMode) ? input.interactionMode : "guide";
  const submittedAnswers = (input.answers || []).filter((answer) => acceptedAnswerId(answer.id)).map((answer) => ({ id: answer.id, label: answerLabel(answer.id), value: clean(answer.value) }));
  const values = new Map(submittedAnswers.map((answer) => [answer.id, answer.value]));
  if (input.draft) {
    const answers = [...questionIds.map((id) => ({ id, label: categoryLabels[id], value: values.get(id) || "" })), ...submittedAnswers.filter((answer) => isFollowupId(answer.id))];
    const currentStep = Math.max(0, Math.min(questionIds.length + 2, Number(input.currentStep) || 0));
    const completedAnswer = currentStep > 0 ? answers[currentStep - 1] : null;
    const statements = [env.DB.prepare(`INSERT INTO participant_onboarding_drafts
      (participant_id,onboarding_version,answers_json,current_step,response_length,interaction_mode,updated_at)
      VALUES (?,?,?,?,?,?,?) ON CONFLICT(participant_id) DO UPDATE SET answers_json=excluded.answers_json,
      current_step=excluded.current_step,response_length=excluded.response_length,interaction_mode=excluded.interaction_mode,updated_at=excluded.updated_at`)
      .bind(auth.account!.participantId, ONBOARDING_VERSION, JSON.stringify(answers), currentStep, responseLength, interactionMode, Date.now())];
    if (completedAnswer) statements.push(env.DB.prepare(`INSERT INTO participant_interview_events
      (id,participant_id,team_id,event_type,question_id,question_version,prompt_text,required,source,branch_rule,answer_value,consent_version,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,NULL,?,?,?)`).bind(crypto.randomUUID(), auth.account!.participantId, auth.account!.teamId,
        completedAnswer.value ? "answer_saved" : "answer_skipped", completedAnswer.id, ONBOARDING_VERSION,
        completedAnswer.label, (required as readonly string[]).includes(completedAnswer.id) ? 1 : 0, isFollowupId(completedAnswer.id) ? "ai" : "fixed", completedAnswer.value || null,
        auth.account!.consentVersion, Date.now()));
    await env.DB.batch(statements);
    return Response.json({ saved: true, currentStep, updatedAt: Date.now() });
  }
  if (required.some((id) => !values.get(id))) return Response.json({ error: "Please answer every required onboarding question." }, { status: 400 });
  const confidence = Number(values.get("baseline_confidence"));
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) return Response.json({ error: "Baseline confidence must be a number from 0 to 100." }, { status: 400 });

  const existing = await env.DB.prepare("SELECT participant_id FROM participant_onboarding_profiles WHERE participant_id=?")
    .bind(auth.account!.participantId).first();
  if (existing) return Response.json({ completed: true, alreadySaved: true });

  const now = Date.now();
  const answers = [...questionIds.map((id) => ({ id, label: categoryLabels[id], value: values.get(id) || "" })), ...submittedAnswers.filter((answer) => isFollowupId(answer.id))];
  const facts = [
    ...answers.filter((answer) => answer.value).map((answer) => ({ category: answer.id, statement: `${answer.label}: ${answer.value}` })),
    { category: "response_length_preference", statement: `Preferred AI response length: ${responseLength}` },
    { category: "interaction_mode_preference", statement: `Preferred AI interaction mode: ${interactionMode}` },
  ].map((item) => ({ ...item, id: crypto.randomUUID() }));
  const sourceId = `${auth.account!.participantId}:${ONBOARDING_VERSION}`;
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO participant_onboarding_profiles
      (participant_id,onboarding_version,answers_json,response_length,interaction_mode,completed_at,updated_at)
      VALUES (?,?,?,?,?,?,?)`).bind(auth.account!.participantId, ONBOARDING_VERSION, JSON.stringify(answers), responseLength, interactionMode, now, now),
    env.DB.prepare(`INSERT INTO participant_onboarding_revisions
      (id,participant_id,answers_json,response_length,interaction_mode,change_source,created_at) VALUES (?,?,?,?,?,'initial_interview',?)`)
      .bind(crypto.randomUUID(), auth.account!.participantId, JSON.stringify(answers), responseLength, interactionMode, now),
    env.DB.prepare("DELETE FROM participant_onboarding_drafts WHERE participant_id=?").bind(auth.account!.participantId),
    ...facts.flatMap((fact) => [
      env.DB.prepare(`INSERT INTO participant_model_entries
        (id,anonymous_participant_id,anonymous_team_id,entry_kind,category,statement,source_type,source_id,confirmed_by_participant,observed_at,created_at)
        VALUES (?,?,?,'fact',?,?,'onboarding_interview',?,1,?,?)`)
        .bind(fact.id, auth.account!.participantId, auth.account!.teamId, fact.category, fact.statement, sourceId, now, now),
      env.DB.prepare(`INSERT INTO cognee_sync_outbox
        (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at)
        VALUES (?,'participant_model',?,'agentforge_learning_signals',?,'pending',0,?)`)
        .bind(crypto.randomUUID(), fact.id, JSON.stringify({
          schema_version: "agentforge.memory.v2", event_type: "participant_model_fact", hackathon_event_id: auth.account!.eventId,
          participant_id: auth.account!.participantId, team_id: auth.account!.teamId, category: fact.category, statement: fact.statement,
          source_type: "onboarding_interview", source_id: sourceId, evidence_type: "participant_reported_fact",
          occurred_at: new Date(now).toISOString(),
        }), now),
    ]),
  ]);
  waitUntil(wakeCogneeSync(env));
  return Response.json({ completed: true, responseLength, interactionMode });
}

export async function PATCH(request: Request) {
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const input = await request.json() as Input;
  if (!validLength(input.responseLength) || !validMode(input.interactionMode)) {
    return Response.json({ error: "Choose a valid response length and interaction mode." }, { status: 400 });
  }
  const now = Date.now();
  const current = await env.DB.prepare("SELECT answers_json AS answersJson,response_length AS responseLength,interaction_mode AS interactionMode FROM participant_onboarding_profiles WHERE participant_id=?")
    .bind(auth.account!.participantId).first<{ answersJson: string; responseLength: ResponseLength; interactionMode: InteractionMode }>();
  const requestedAnswers = input.answers?.filter((answer) => acceptedAnswerId(answer.id)).map((answer) => ({ id: answer.id, label: answerLabel(answer.id), value: clean(answer.value) }));
  if (requestedAnswers) {
    const values = new Map(requestedAnswers.map((answer) => [answer.id, answer.value]));
    if (required.some((id) => !values.get(id))) return Response.json({ error: "Complete every required profile field before saving." }, { status: 400 });
    const confidence = Number(values.get("baseline_confidence"));
    if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) return Response.json({ error: "Baseline confidence must be a number from 0 to 100." }, { status: 400 });
  }
  const nextAnswersJson = requestedAnswers ? JSON.stringify(requestedAnswers) : current?.answersJson || "[]";
  const priorAnswers = current?.answersJson || "[]";
  const activeEntries = await env.DB.prepare(`SELECT id,category,statement FROM participant_model_entries
    WHERE anonymous_participant_id=? AND source_type='onboarding_interview' AND superseded_by_id IS NULL`)
    .bind(auth.account!.participantId).all<{ id: string; category: string; statement: string }>();
  const nextAnswers = JSON.parse(nextAnswersJson) as Array<{ id: string; label: string; value: string }>;
  const desiredFacts = [
    ...nextAnswers.filter((answer) => answer.value).map((answer) => ({ category: answer.id, statement: `${answer.label}: ${answer.value}` })),
    { category: "response_length_preference", statement: `Preferred AI response length: ${input.responseLength}` },
    { category: "interaction_mode_preference", statement: `Preferred AI interaction mode: ${input.interactionMode}` },
  ];
  const desiredByCategory = new Map(desiredFacts.map((fact) => [fact.category, fact]));
  const mutations: D1PreparedStatement[] = [env.DB.prepare(`INSERT INTO participant_onboarding_profiles
    (participant_id,onboarding_version,answers_json,response_length,interaction_mode,completed_at,updated_at)
    VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(participant_id) DO UPDATE SET answers_json=excluded.answers_json,response_length=excluded.response_length,interaction_mode=excluded.interaction_mode,updated_at=excluded.updated_at`)
    .bind(auth.account!.participantId, ONBOARDING_VERSION, nextAnswersJson, input.responseLength, input.interactionMode, now, now),
  env.DB.prepare(`INSERT INTO participant_onboarding_revisions
    (id,participant_id,answers_json,response_length,interaction_mode,change_source,created_at) VALUES (?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(), auth.account!.participantId, priorAnswers, current?.responseLength || input.responseLength, current?.interactionMode || input.interactionMode, clean(input.changeSource) || "settings", now)];

  const oldByCategory = new Map(activeEntries.results.map((entry) => [entry.category, entry]));
  for (const [category, desired] of desiredByCategory) {
    const old = oldByCategory.get(category);
    if (old?.statement === desired.statement) continue;
    const replacementId = crypto.randomUUID();
    mutations.push(env.DB.prepare(`INSERT INTO participant_model_entries
      (id,anonymous_participant_id,anonymous_team_id,entry_kind,category,statement,source_type,source_id,confirmed_by_participant,observed_at,created_at)
      VALUES (?,?,?,'fact',?,?,'onboarding_interview',?,1,?,?)`).bind(replacementId, auth.account!.participantId, auth.account!.teamId,
        category, desired.statement, `${auth.account!.participantId}:${ONBOARDING_VERSION}:${now}`, now, now));
    if (old) mutations.push(env.DB.prepare("UPDATE participant_model_entries SET superseded_by_id=? WHERE id=? AND superseded_by_id IS NULL").bind(replacementId, old.id));
    mutations.push(env.DB.prepare(`INSERT INTO cognee_sync_outbox
      (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at)
      VALUES (?,'participant_model',?,'agentforge_learning_signals',?,'pending',0,?)`).bind(crypto.randomUUID(), replacementId, JSON.stringify({
        schema_version: "agentforge.memory.v2", event_type: "participant_model_correction", hackathon_event_id: auth.account!.eventId,
        participant_id: auth.account!.participantId, team_id: auth.account!.teamId, category, statement: desired.statement,
        source_type: "onboarding_interview", source_id: replacementId, supersedes_entry_id: old?.id || null,
        evidence_type: "participant_reported_fact", occurred_at: new Date(now).toISOString(),
      }), now));
  }
  for (const old of activeEntries.results) {
    if (desiredByCategory.has(old.category)) continue;
    const replacementId = crypto.randomUUID();
    const statement = `${answerLabel(old.category)}: participant chose not to provide this optional response.`;
    mutations.push(env.DB.prepare(`INSERT INTO participant_model_entries
      (id,anonymous_participant_id,anonymous_team_id,entry_kind,category,statement,source_type,source_id,confirmed_by_participant,observed_at,created_at)
      VALUES (?,?,?,'fact',?,?,'onboarding_interview',?,1,?,?)`).bind(replacementId, auth.account!.participantId, auth.account!.teamId,
        old.category, statement, `${auth.account!.participantId}:${ONBOARDING_VERSION}:${now}`, now, now));
    mutations.push(env.DB.prepare("UPDATE participant_model_entries SET superseded_by_id=? WHERE id=? AND superseded_by_id IS NULL").bind(replacementId, old.id));
    mutations.push(env.DB.prepare(`INSERT INTO cognee_sync_outbox
      (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at)
      VALUES (?,'participant_model',?,'agentforge_learning_signals',?,'pending',0,?)`).bind(crypto.randomUUID(), replacementId, JSON.stringify({
        schema_version: "agentforge.memory.v2", event_type: "participant_model_correction", hackathon_event_id: auth.account!.eventId,
        participant_id: auth.account!.participantId, team_id: auth.account!.teamId, category: old.category, statement,
        source_type: "onboarding_interview", source_id: replacementId, supersedes_entry_id: old.id,
        evidence_type: "participant_reported_fact", occurred_at: new Date(now).toISOString(),
      }), now));
  }
  await env.DB.batch(mutations);
  if (mutations.length > 2) waitUntil(wakeCogneeSync(env));
  return Response.json({ saved: true, responseLength: input.responseLength, interactionMode: input.interactionMode });
}
