import { env } from "cloudflare:workers";
import { currentAccount, identityFromRequest } from "../../../lib/account";

type Runtime = { DB: D1Database; SUBMISSIONS?: R2Bucket; COGNEE_API_KEY?: string; OPENAI_API_KEY?: string; OPENAI_API_KEYS_JSON?: string; RESEND_API_KEY?: string; AUTH_EMAIL_FROM?: string; APP_ORIGIN?: string; CLAWMAX_APP_URL?: string; COGNEE_SYNC_QUEUE?: { send(message: { kind: "sync" }): Promise<void> } };

function configuredProviderKeyCount(runtime: Runtime) {
  try {
    const parsed = JSON.parse(runtime.OPENAI_API_KEYS_JSON || "[]");
    if (Array.isArray(parsed)) return parsed.filter((value) => typeof value === "string" && value.trim().length > 20).length || (runtime.OPENAI_API_KEY ? 1 : 0);
  } catch { /* Report the valid fallback key only. */ }
  return runtime.OPENAI_API_KEY ? 1 : 0;
}

async function authorized(request: Request, runtime: Runtime) {
  const identity = await identityFromRequest(request);
  if (!identity) return false;
  return (await currentAccount(runtime.DB, identity))?.role === "organizer";
}

function maskSensitive(value: string | null) {
  if (!value) return value;
  return value
    .replace(/sk-[A-Za-z0-9_-]{12,}/g, "[REDACTED API KEY]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[REDACTED EMAIL]")
    .replace(/(password|api[_ -]?key|secret)\s*[:=]\s*\S+/gi, "$1=[REDACTED]");
}

function evaluationScore(value: unknown) {
  const match = String(value || "").match(/total_score[^0-9]{0,24}(\d+)/);
  return match ? Number(match[1]) : null;
}

export async function GET(request: Request) {
  const runtime = env as unknown as Runtime;
  if (!await authorized(request, runtime)) return Response.json({ error: "Organizer access required." }, { status: 401 });

  const submissionId = new URL(request.url).searchParams.get("downloadSubmission");
  if (submissionId) {
    const submission = await runtime.DB.prepare(`SELECT artifact_object_key AS objectKey,artifact_filename AS filename
      FROM team_submissions WHERE id=?`).bind(submissionId).first<{ objectKey: string | null; filename: string | null }>();
    if (!submission?.objectKey || !runtime.SUBMISSIONS) return Response.json({ error: "No stored artifact is available for this submission." }, { status: 404 });
    const object = await runtime.SUBMISSIONS.get(submission.objectKey);
    if (!object) return Response.json({ error: "The submitted artifact could not be found." }, { status: 404 });
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    const safeName = (submission.filename || "agentforge-submission").replace(/[^a-zA-Z0-9._-]+/g, "-");
    headers.set("Content-Disposition", `attachment; filename="${safeName}"`);
    headers.set("Cache-Control", "private, no-store");
    return new Response(object.body, { headers });
  }

  const [summary, hourly, pages, teams, recent, feedbacks, settings, cogneeSync, participantModel, learningSignals, promptEvaluations, promptClusters, signalEvidence, clawmaxStatus, clawmaxRecent, clawmaxConnections, clawmaxPurges, operations, submissions, researchEpisodeSummary, researchEpisodeRecent] = await Promise.all([
    runtime.DB.prepare(`SELECT COUNT(*) AS totalPrompts, COALESCE(SUM(input_tokens),0) AS inputTokens,
      COALESCE(SUM(output_tokens),0) AS outputTokens,
      (SELECT COUNT(*) FROM participant_interview_events WHERE event_type='followup_generated') AS interviewerCalls,
      (SELECT COALESCE(SUM(input_tokens),0) FROM participant_interview_events WHERE event_type='followup_generated') AS interviewerInputTokens,
      (SELECT COALESCE(SUM(output_tokens),0) FROM participant_interview_events WHERE event_type='followup_generated') AS interviewerOutputTokens,
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
    runtime.DB.prepare(`SELECT COALESCE(pe.anonymous_team_id,'Unassigned') AS teamId,
      COALESCE(t.name,'Unassigned') AS teamName, COUNT(*) AS prompts,
      COALESCE(SUM(input_tokens + output_tokens),0) AS tokens
      FROM prompt_events pe LEFT JOIN teams t ON t.id=pe.anonymous_team_id
      GROUP BY pe.anonymous_team_id,t.name ORDER BY tokens DESC LIMIT 30`).all(),
    runtime.DB.prepare(`SELECT pe.id, pe.anonymous_participant_id AS participantId, pe.anonymous_team_id AS teamId,
      COALESCE(ep.display_name,p.display_name,'Unknown participant') AS participantDisplayName,
      ep.email AS participantEmail,COALESCE(t.name,'Unassigned') AS teamName,
      pe.page, pe.tutorial_step AS tutorialStep, pe.user_prompt AS userPrompt, pe.response_text AS responseText,
      pe.model_name AS modelName, pe.latency_ms AS latencyMs, pe.input_tokens AS inputTokens,
      pe.output_tokens AS outputTokens, pe.status, pe.error_code AS errorCode, pe.user_feedback AS userFeedback, pe.created_at AS createdAt
      FROM prompt_events pe
      LEFT JOIN event_participants ep ON ep.id=pe.anonymous_participant_id
      LEFT JOIN participants p ON p.id=pe.anonymous_participant_id
      LEFT JOIN teams t ON t.id=pe.anonymous_team_id
      ORDER BY pe.created_at DESC LIMIT 100`).all(),
    runtime.DB.prepare(`SELECT afe.id, afe.prompt_event_id AS promptEventId,
      afe.anonymous_participant_id AS participantId, afe.anonymous_team_id AS teamId,
      afe.participant_display_name AS participantDisplayName, afe.feedback,
      afe.reason_code AS reasonCode, afe.note, afe.created_at AS createdAt,
      pe.page, pe.tutorial_step AS tutorialStep, pe.user_prompt AS userPrompt
      FROM assistant_feedback_events afe JOIN prompt_events pe ON pe.id=afe.prompt_event_id
      ORDER BY afe.created_at DESC LIMIT 100`).all(),
    runtime.DB.prepare(`SELECT assistant_enabled AS assistantEnabled,event_token_quota AS eventTokenQuota,
      default_team_token_quota AS defaultTeamTokenQuota,default_participant_token_quota AS defaultParticipantTokenQuota,
      per_minute_request_limit AS perMinuteRequestLimit,per_hour_request_limit AS perHourRequestLimit,
      max_concurrent_requests AS maxConcurrentRequests,max_output_tokens AS maxOutputTokens
      FROM organizer_settings WHERE id='global'`).first(),
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
      pe.anonymous_participant_id AS participantId,pe.page,pe.tutorial_step AS tutorialStep,pe.user_prompt AS userPrompt,
      COALESCE(ep.display_name,p.display_name,'Unknown participant') AS participantDisplayName,
      ep.email AS participantEmail,pe.anonymous_team_id AS teamId,COALESCE(t.name,'Unassigned') AS teamName,
      pe.context_reference AS contextReference,
      pe.parent_prompt_event_id AS parentPromptEventId,parent.user_prompt AS parentPrompt,
      pe.outcome_status AS outcomeStatus,pe.outcome_evidence AS outcomeEvidence
      FROM prompt_evaluations ev JOIN prompt_events pe ON pe.id=ev.prompt_event_id
      LEFT JOIN prompt_events parent ON parent.id=pe.parent_prompt_event_id
      LEFT JOIN event_participants ep ON ep.id=pe.anonymous_participant_id
      LEFT JOIN participants p ON p.id=pe.anonymous_participant_id
      LEFT JOIN teams t ON t.id=pe.anonymous_team_id
      ORDER BY ev.created_at DESC LIMIT 100`).all(),
    runtime.DB.prepare(`SELECT id,page,tutorial_step AS tutorialStep,category,label,participant_level AS participantLevel,prompt_count AS promptCount,
      participant_count AS participantCount,error_count AS errorCount,examples_json AS examplesJson,
      window_started_at AS windowStartedAt,window_ended_at AS windowEndedAt,created_at AS createdAt
      FROM prompt_clusters ORDER BY created_at DESC LIMIT 50`).all(),
    runtime.DB.prepare(`SELECT e.signal_id AS signalId,p.id AS promptEventId,p.user_prompt AS userPrompt,p.status,p.error_code AS errorCode,p.user_feedback AS userFeedback,p.created_at AS createdAt
      FROM learning_signal_evidence e JOIN prompt_events p ON p.id=e.prompt_event_id ORDER BY e.created_at DESC LIMIT 200`).all(),
    runtime.DB.prepare(`SELECT normalization_status AS status,COUNT(*) AS count
      FROM clawmax_ingestion_events GROUP BY normalization_status`).all(),
    runtime.DB.prepare(`SELECT ce.event_id AS eventId,ce.source,ce.occurred_at AS occurredAt,
      ce.normalization_status AS normalizationStatus,ce.normalization_error AS normalizationError,
      ce.participant_id AS participantId,ce.team_id AS teamId,ce.received_at AS receivedAt,
      ep.display_name AS participantDisplayName
      FROM clawmax_ingestion_events ce LEFT JOIN event_participants ep ON ep.id=ce.participant_id
      ORDER BY ce.received_at DESC LIMIT 50`).all(),
    runtime.DB.prepare(`SELECT e.id,e.destination_id AS destinationId,e.status,e.external_workspace_id AS workspaceId,
      e.created_at AS createdAt,e.updated_at AS updatedAt,ep.display_name AS participantDisplayName,
      COUNT(r.receipt_id) AS receiptCount,SUM(CASE WHEN r.status='active' THEN 1 ELSE 0 END) AS activeReceipts
      FROM clawmax_partner_enrollments e JOIN event_participants ep ON ep.id=e.participant_id
      LEFT JOIN clawmax_consent_receipts r ON r.enrollment_id=e.id
      GROUP BY e.id ORDER BY e.updated_at DESC LIMIT 100`).all(),
    runtime.DB.prepare(`SELECT p.id,p.receipt_id AS receiptId,p.status,p.raw_events_purged AS rawEventsPurged,
      p.normalized_records_purged AS normalizedRecordsPurged,p.cognee_records_pending AS cogneeRecordsPending,
      p.last_error AS lastError,p.created_at AS createdAt,p.completed_at AS completedAt,
      e.external_workspace_id AS workspaceId,ep.display_name AS participantDisplayName
      FROM clawmax_purge_jobs p
      JOIN clawmax_consent_receipts r ON r.receipt_id=p.receipt_id
      JOIN clawmax_partner_enrollments e ON e.id=r.enrollment_id
      JOIN event_participants ep ON ep.id=e.participant_id
      ORDER BY p.created_at DESC LIMIT 100`).all(),
    runtime.DB.prepare(`SELECT
      (SELECT COUNT(*) FROM event_participants WHERE status='active') AS registeredParticipants,
      (SELECT COUNT(*) FROM teams WHERE status='active') AS activeTeams,
      (SELECT COUNT(*) FROM team_submissions) AS submittedTeams,
      (SELECT COUNT(*) FROM team_submissions WHERE status='complete') AS completeSubmissions,
      (SELECT COUNT(*) FROM assistant_feedback_events) AS feedbackCount`).first(),
    runtime.DB.prepare(`SELECT s.id,s.team_id AS teamId,COALESCE(t.name,'Unknown team') AS teamName,
      s.submitted_by_participant_id AS submittedByParticipantId,COALESCE(ep.display_name,'Unknown participant') AS submittedByName,
      s.artifact_kind AS artifactKind,s.artifact_url AS artifactUrl,s.artifact_filename AS artifactFilename,
      s.artifact_size_bytes AS artifactSizeBytes,s.notes,s.artifact_submitted_at AS artifactSubmittedAt,
      s.demo_video_url AS demoVideoUrl,s.demo_submitted_at AS demoSubmittedAt,s.demo_due_at AS demoDueAt,
      s.status,s.updated_at AS updatedAt
      FROM team_submissions s LEFT JOIN teams t ON t.id=s.team_id
      LEFT JOIN event_participants ep ON ep.id=s.submitted_by_participant_id
      ORDER BY s.updated_at DESC LIMIT 100`).all(),
    runtime.DB.prepare(`SELECT episode_type AS episodeType,scaffold_level AS scaffoldLevel,status,COUNT(*) AS count
      FROM research_episodes GROUP BY episode_type,scaffold_level,status ORDER BY episode_type,scaffold_level,status`).all(),
    runtime.DB.prepare(`SELECT re.id,re.episode_type AS episodeType,re.scaffold_level AS scaffoldLevel,re.fevi_stage AS feviStage,
      re.source_page AS sourcePage,re.source_prompt_event_id AS promptEventId,re.status,re.created_at AS createdAt,
      COALESCE(ep.display_name,'Unknown participant') AS participantDisplayName,COALESCE(t.name,'Unassigned') AS teamName,
      (SELECT COUNT(*) FROM research_episode_events ree WHERE ree.research_episode_id=re.id) AS eventCount
      FROM research_episodes re LEFT JOIN event_participants ep ON ep.id=re.participant_id
      LEFT JOIN teams t ON t.id=re.team_id ORDER BY re.created_at DESC LIMIT 100`).all(),
  ]);

  const safeRecent = recent.results.map((row) => ({ ...row, userPrompt: maskSensitive(String(row.userPrompt || "")), responseText: maskSensitive(String(row.responseText || "")) }));
  const safeFeedbacks = feedbacks.results.map((row) => ({ ...row, userPrompt: maskSensitive(String(row.userPrompt || "")) }));
  const requiredTables = ["app_users", "user_credentials", "user_identities", "auth_sessions", "auth_audit_logs", "auth_action_tokens", "participant_onboarding_profiles", "participant_onboarding_drafts", "participant_onboarding_revisions", "participant_interview_events", "research_episodes", "research_episode_events", "participant_orientation_acknowledgements", "assistant_feedback_events", "assistant_token_usage", "assistant_token_reservations", "learning_checkins", "learner_notes", "agent_design_blueprints", "agent_design_events", "team_memberships", "team_invites"];
  const schemaTables = await runtime.DB.prepare("SELECT name FROM sqlite_master WHERE type='table'").all<{ name: string }>();
  const presentTables = new Set(schemaTables.results.map((row) => row.name));
  const missingTables = requiredTables.filter((name) => !presentTables.has(name));
  const reservationHealth = presentTables.has("assistant_token_reservations") ? await runtime.DB.prepare(`SELECT
    SUM(CASE WHEN status IN ('reserved','processing') AND expires_at>=? THEN 1 ELSE 0 END) AS active,
    SUM(CASE WHEN status IN ('reserved','processing') AND expires_at<? THEN 1 ELSE 0 END) AS stale
    FROM assistant_token_reservations`).bind(Date.now(), Date.now()).first<{ active: number | null; stale: number | null }>() : { active: 0, stale: 0 };
  const eventSchedule = await runtime.DB.prepare("SELECT starts_at AS startsAt,ends_at AS endsAt FROM event_configuration WHERE id='primary'").first<{ startsAt: number | null; endsAt: number | null }>();
  const cogneeErrorCount = Number((cogneeSync.results as Array<{ status?: string; count?: number }>).find((row) => row.status === "error")?.count || 0);
  return Response.json({ generatedAt: Date.now(), summary, hourly: hourly.results.reverse(), pages: pages.results, teams: teams.results,
    prompts: safeRecent, settings: { ...(settings || { assistantEnabled: 1, eventTokenQuota: 5000000, defaultTeamTokenQuota: 100000, defaultParticipantTokenQuota: 25000, perMinuteRequestLimit: 10, perHourRequestLimit: 100, maxConcurrentRequests: 2, maxOutputTokens: 1500 }), providerKeyCount: configuredProviderKeyCount(runtime), keyRouting: "stable_team_shard" },
    feedbacks: safeFeedbacks,
    preflight: { databaseReady: missingTables.length === 0, missingTables, emailConfigured: Boolean(runtime.RESEND_API_KEY && runtime.AUTH_EMAIL_FROM), appOriginConfigured: Boolean(runtime.APP_ORIGIN), scheduleConfigured: Boolean(eventSchedule?.startsAt && eventSchedule?.endsAt), clawmaxConfigured: Boolean(runtime.CLAWMAX_APP_URL), queueConfigured: Boolean(runtime.COGNEE_SYNC_QUEUE), cogneeErrorCount, activeReservations: Number(reservationHealth?.active || 0), staleReservations: Number(reservationHealth?.stale || 0), expectedParticipantScale: "50–70" },
    clawmax: { status: clawmaxStatus.results, recent: clawmaxRecent.results, connections: clawmaxConnections.results, purges: clawmaxPurges.results },
    cognee: { connected: Boolean(runtime.COGNEE_API_KEY), sync: cogneeSync.results },
    participantModel: participantModel.results, learningSignals: learningSignals.results,
    operations: operations || { registeredParticipants: 0, activeTeams: 0, submittedTeams: 0, completeSubmissions: 0, feedbackCount: 0 },
    submissions: submissions.results,
    researchEpisodes: { summary: researchEpisodeSummary.results, recent: researchEpisodeRecent.results },
    promptClusters: promptClusters.results, signalEvidence: signalEvidence.results,
    promptEvaluations: promptEvaluations.results.map((row) => ({
      ...row, totalScore: row.totalScore ?? evaluationScore(row.evaluationJson),
      userPrompt: maskSensitive(String(row.userPrompt || "")),
      contextReference: maskSensitive(String(row.contextReference || "")),
    })) });
}

export async function PATCH(request: Request) {
  const runtime = env as unknown as Runtime;
  if (!await authorized(request, runtime)) return Response.json({ error: "Organizer access required." }, { status: 401 });
  const input = await request.json() as { action?: string; signalId?: string; decision?: "approved" | "rejected" | "reviewing"; editedSummary?: string; suggestedAction?: string; assistantEnabled?: boolean; eventTokenQuota?: number; defaultTeamTokenQuota?: number; defaultParticipantTokenQuota?: number; perMinuteRequestLimit?: number; perHourRequestLimit?: number; maxConcurrentRequests?: number; maxOutputTokens?: number };
  if (input.action === "review_signal") {
    if (!input.signalId || !input.decision) return Response.json({ error: "Signal and review decision are required." }, { status: 400 });
    const result = await runtime.DB.prepare(`UPDATE learning_signals SET review_status=?,cognee_summary=COALESCE(?,cognee_summary),suggested_action=COALESCE(?,suggested_action),reviewed_at=? WHERE id=?`)
      .bind(input.decision, input.editedSummary?.trim().slice(0, 12000) || null, input.suggestedAction?.trim().slice(0, 2000) || null, Date.now(), input.signalId).run();
    if (!result.meta.changes) return Response.json({ error: "Learning signal not found." }, { status: 404 });
    return Response.json({ saved: true, signalId: input.signalId, reviewStatus: input.decision });
  }
  const enabled = input.assistantEnabled === false ? 0 : 1;
  const eventQuota = Math.max(1000, Math.min(1000000000, Number(input.eventTokenQuota) || 5000000));
  const quota = Math.max(1000, Math.min(eventQuota, 10000000, Number(input.defaultTeamTokenQuota) || 100000));
  const participantQuota = Math.max(500, Math.min(quota, Number(input.defaultParticipantTokenQuota) || 25000));
  const perMinute = Math.max(1, Math.min(60, Number(input.perMinuteRequestLimit) || 10));
  const perHour = Math.max(perMinute, Math.min(1000, Number(input.perHourRequestLimit) || 100));
  const concurrent = Math.max(1, Math.min(5, Number(input.maxConcurrentRequests) || 2));
  const maxOutput = Math.max(128, Math.min(4000, Number(input.maxOutputTokens) || 1500));
  await runtime.DB.prepare(`INSERT INTO organizer_settings
    (id,assistant_enabled,event_token_quota,default_team_token_quota,default_participant_token_quota,per_minute_request_limit,per_hour_request_limit,max_concurrent_requests,max_output_tokens,updated_at)
    VALUES ('global',?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET assistant_enabled=excluded.assistant_enabled,
    event_token_quota=excluded.event_token_quota,default_team_token_quota=excluded.default_team_token_quota,
    default_participant_token_quota=excluded.default_participant_token_quota,per_minute_request_limit=excluded.per_minute_request_limit,
    per_hour_request_limit=excluded.per_hour_request_limit,max_concurrent_requests=excluded.max_concurrent_requests,
    max_output_tokens=excluded.max_output_tokens,updated_at=excluded.updated_at`)
    .bind(enabled,eventQuota,quota,participantQuota,perMinute,perHour,concurrent,maxOutput,Date.now()).run();
  return Response.json({ assistantEnabled: enabled,eventTokenQuota:eventQuota,defaultTeamTokenQuota:quota,defaultParticipantTokenQuota:participantQuota,perMinuteRequestLimit:perMinute,perHourRequestLimit:perHour,maxConcurrentRequests:concurrent,maxOutputTokens:maxOutput });
}

export async function DELETE(request: Request) {
  const runtime = env as unknown as Runtime;
  if (!await authorized(request, runtime)) return Response.json({ error: "Organizer access required." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Prompt id is required." }, { status: 400 });
  await runtime.DB.prepare("DELETE FROM prompt_events WHERE id = ?").bind(id).run();
  return Response.json({ deleted: id });
}
