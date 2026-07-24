import { env } from "cloudflare:workers";

type Runtime = { DB: D1Database; ORGANIZER_ACCESS_CODE?: string; COGNEE_API_KEY?: string };

function authorized(request: Request, runtime: Runtime) {
  const supplied = request.headers.get("x-organizer-code") || "";
  return Boolean(runtime.ORGANIZER_ACCESS_CODE && supplied === runtime.ORGANIZER_ACCESS_CODE);
}

function maskSensitive(value: string | null) {
  if (!value) return value;
  return value
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[REDACTED API KEY]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED EMAIL]")
    .replace(/(password|api[_ -]?key|secret)\s*[:=]\s*\S+/gi, "$1=[REDACTED]");
}

export async function GET(request: Request) {
  const runtime = env as unknown as Runtime;
  if (!authorized(request, runtime)) return Response.json({ error: "Organizer access required." }, { status: 401 });

  const [summary, hourly, pages, teams, recent, feedbacks, settings, cogneeSync, participantModel, learningSignals, promptEvaluations] = await Promise.all([
    runtime.DB.prepare(`SELECT COUNT(*) AS totalPrompts, COALESCE(SUM(input_tokens),0) AS inputTokens,
      COALESCE(SUM(output_tokens),0) AS outputTokens,
      COALESCE(ROUND(100.0 * SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0),1),0) AS successRate,
      COALESCE(ROUND(AVG(latency_ms)),0) AS avgLatencyMs,
      SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS lastHour
      FROM prompt_events`).bind(Date.now() - 3600000).first(),
    runtime.DB.prepare(`SELECT strftime('%Y-%m-%d %H:00', created_at / 1000, 'unixepoch') AS hour,
      COUNT(*) AS prompts, COALESCE(SUM(input_tokens + output_tokens),0) AS tokens
      FROM prompt_events GROUP BY hour ORDER BY hour DESC LIMIT 24`).all(),
    runtime.DB.prepare(`SELECT page, tutorial_step AS tutorialStep, COUNT(*) AS prompts,
      SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) AS errors,
      COALESCE(SUM(input_tokens + output_tokens),0) AS tokens
      FROM prompt_events GROUP BY page, tutorial_step ORDER BY prompts DESC LIMIT 20`).all(),
    runtime.DB.prepare(`SELECT COALESCE(anonymous_team_id,'Unassigned') AS teamId, COUNT(*) AS prompts,
      COALESCE(SUM(input_tokens + output_tokens),0) AS tokens
      FROM prompt_events GROUP BY anonymous_team_id ORDER BY tokens DESC LIMIT 30`).all(),
    runtime.DB.prepare(`SELECT id, anonymous_participant_id AS participantId, anonymous_team_id AS teamId,
      page, tutorial_step AS tutorialStep, user_prompt AS userPrompt, response_text AS responseText,
      model_name AS modelName, latency_ms AS latencyMs, input_tokens AS inputTokens,
      output_tokens AS outputTokens, status, error_code AS errorCode, user_feedback AS userFeedback, created_at AS createdAt
      FROM prompt_events ORDER BY created_at DESC LIMIT 100`).all(),
    runtime.DB.prepare(`SELECT afe.id, afe.prompt_event_id AS promptEventId,
      afe.anonymous_participant_id AS participantId, afe.anonymous_team_id AS teamId,
      afe.participant_display_name AS participantDisplayName, afe.feedback, afe.created_at AS createdAt,
      pe.page, pe.tutorial_step AS tutorialStep, pe.user_prompt AS userPrompt
      FROM assistant_feedback_events afe JOIN prompt_events pe ON pe.id=afe.prompt_event_id
      ORDER BY afe.created_at DESC LIMIT 100`).all(),
    runtime.DB.prepare("SELECT assistant_enabled AS assistantEnabled, default_team_token_quota AS defaultTeamTokenQuota FROM organizer_settings WHERE id='global'").first(),
    runtime.DB.prepare("SELECT status, COUNT(*) AS count FROM cognee_sync_outbox GROUP BY status").all(),
    runtime.DB.prepare("SELECT entry_kind AS entryKind, COUNT(*) AS count FROM participant_model_entries GROUP BY entry_kind").all(),
    runtime.DB.prepare(`SELECT id, page, tutorial_step AS tutorialStep, prompt_count AS promptCount,
      participant_count AS participantCount, error_count AS errorCount,
      negative_feedback_count AS negativeFeedbackCount, detection_rule AS detectionRule,
      cognee_summary AS cogneeSummary, suggested_action AS suggestedAction,
      review_status AS reviewStatus, created_at AS createdAt
      FROM learning_signals ORDER BY created_at DESC LIMIT 20`).all(),
    runtime.DB.prepare(`SELECT ev.id,ev.prompt_event_id AS promptEventId,ev.rubric_version AS rubricVersion,
      ev.evaluator,ev.evaluation_json AS evaluationJson,ev.total_score AS totalScore,ev.created_at AS createdAt,
      pe.anonymous_participant_id AS participantId,pe.page,pe.user_prompt AS userPrompt
      FROM prompt_evaluations ev JOIN prompt_events pe ON pe.id=ev.prompt_event_id
      ORDER BY ev.created_at DESC LIMIT 100`).all(),
  ]);

  const safeRecent = recent.results.map((row) => ({ ...row, userPrompt: maskSensitive(String(row.userPrompt || "")), responseText: maskSensitive(String(row.responseText || "")) }));
  const safeFeedbacks = feedbacks.results.map((row) => ({ ...row, userPrompt: maskSensitive(String(row.userPrompt || "")) }));
  return Response.json({ summary, hourly: hourly.results.reverse(), pages: pages.results, teams: teams.results,
    prompts: safeRecent, settings: settings || { assistantEnabled: 1, defaultTeamTokenQuota: 100000 },
    feedbacks: safeFeedbacks,
    cognee: { connected: Boolean(runtime.COGNEE_API_KEY), sync: cogneeSync.results },
    participantModel: participantModel.results, learningSignals: learningSignals.results,
    promptEvaluations: promptEvaluations.results.map((row) => ({ ...row, userPrompt: maskSensitive(String(row.userPrompt || "")) })) });
}

export async function PATCH(request: Request) {
  const runtime = env as unknown as Runtime;
  if (!authorized(request, runtime)) return Response.json({ error: "Organizer access required." }, { status: 401 });
  const input = await request.json() as { assistantEnabled?: boolean; defaultTeamTokenQuota?: number };
  const enabled = input.assistantEnabled === false ? 0 : 1;
  const quota = Math.max(1000, Math.min(10000000, Number(input.defaultTeamTokenQuota) || 100000));
  await runtime.DB.prepare(`INSERT INTO organizer_settings (id, assistant_enabled, default_team_token_quota, updated_at)
    VALUES ('global', ?, ?, ?) ON CONFLICT(id) DO UPDATE SET assistant_enabled=excluded.assistant_enabled,
    default_team_token_quota=excluded.default_team_token_quota, updated_at=excluded.updated_at`).bind(enabled, quota, Date.now()).run();
  return Response.json({ assistantEnabled: enabled, defaultTeamTokenQuota: quota });
}

export async function DELETE(request: Request) {
  const runtime = env as unknown as Runtime;
  if (!authorized(request, runtime)) return Response.json({ error: "Organizer access required." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Prompt id is required." }, { status: 400 });
  await runtime.DB.prepare("DELETE FROM prompt_events WHERE id = ?").bind(id).run();
  return Response.json({ deleted: id });
}
