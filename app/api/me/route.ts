import { env } from "cloudflare:workers";
import { requireCurrentAccount } from "../../../lib/account";

export async function GET(request: Request) {
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const account = auth.account!;
  const [consent, projects, prompts, memory, progress, authoredNotes] = await Promise.all([
    env.DB.prepare("SELECT id,policy_version AS policyVersion,status,choices_json AS choicesJson,recorded_at AS recordedAt FROM consent_records WHERE event_participant_id=? ORDER BY recorded_at DESC").bind(account.participantId).all(),
    env.DB.prepare("SELECT id,title,problem,success_criteria AS successCriteria,status,created_at AS createdAt,updated_at AS updatedAt FROM agent_projects WHERE anonymous_participant_id=? ORDER BY updated_at DESC").bind(account.participantId).all(),
    env.DB.prepare(`SELECT p.id,p.page,p.tutorial_step AS tutorialStep,p.user_prompt AS userPrompt,p.response_text AS responseText,p.model_name AS modelName,p.input_tokens AS inputTokens,p.output_tokens AS outputTokens,p.status,p.user_feedback AS userFeedback,p.created_at AS createdAt,
      c.status AS memoryStatus,c.synced_at AS memorySyncedAt FROM prompt_events p LEFT JOIN cognee_sync_outbox c ON c.source_type='prompt_event' AND c.source_id=p.id WHERE p.anonymous_participant_id=? ORDER BY p.created_at DESC`).bind(account.participantId).all(),
    env.DB.prepare(`SELECT m.id,m.entry_kind AS entryKind,m.category,m.statement,m.source_type AS sourceType,m.confidence_percent AS confidencePercent,m.confirmed_by_participant AS confirmedByParticipant,m.observed_at AS observedAt,
      c.status AS memoryStatus,c.synced_at AS memorySyncedAt FROM participant_model_entries m LEFT JOIN cognee_sync_outbox c ON c.source_type='participant_model' AND c.source_id=m.id WHERE m.anonymous_participant_id=? ORDER BY m.observed_at DESC`).bind(account.participantId).all(),
    env.DB.prepare("SELECT id,milestone,status,source,occurred_at AS occurredAt FROM event_progress_events WHERE event_participant_id=? ORDER BY occurred_at DESC").bind(account.participantId).all(),
    env.DB.prepare("SELECT id,team_id AS teamId,content,source_type AS sourceType,created_at AS createdAt,updated_at AS updatedAt FROM shared_notes WHERE author_id=? ORDER BY created_at DESC").bind(account.participantId).all(),
  ]);
  const payload = {
    exportedAt: new Date().toISOString(),
    account,
    relationship: { userId: account.userId, eventRegistrationId: account.participantId, eventId: account.eventId, teamId: account.teamId },
    consent: consent.results,
    projects: projects.results,
    prompts: prompts.results,
    memory: memory.results,
    progress: progress.results,
    authoredTeamNotes: authoredNotes.results,
    deletion: { availableHere: false, note: "Single-record deletion is intentionally not enabled in this phase. Event retention and a reviewed deletion workflow will be handled separately." },
  };
  const url = new URL(request.url);
  if (url.searchParams.get("download") === "1") {
    return new Response(JSON.stringify(payload, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="agentforge-my-data-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" } });
  }
  return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
}
