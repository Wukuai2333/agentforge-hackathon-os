import { env } from "cloudflare:workers";
import { currentAccount, requireCurrentAccount } from "../../../lib/account";

export async function GET(request: Request) {
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const account = auth.account!;
  if (!account.teamId) return Response.json({ account, team: null, members: [], projects: [], progress: [], memories: [], questions: [] });
  const [members, projects, progress, memories, questions] = await Promise.all([
    env.DB.prepare(`SELECT ep.id,ep.display_name AS displayName,ep.role,tm.membership_role AS membershipRole,tm.joined_at AS joinedAt
      FROM team_memberships tm JOIN event_participants ep ON ep.id=tm.participant_id
      WHERE tm.team_id=? AND tm.ended_at IS NULL ORDER BY tm.joined_at`).bind(account.teamId).all(),
    env.DB.prepare(`SELECT id,title,problem,success_criteria AS successCriteria,status,anonymous_participant_id AS participantId,updated_at AS updatedAt
      FROM agent_projects WHERE team_id=? ORDER BY updated_at DESC LIMIT 20`).bind(account.teamId).all(),
    env.DB.prepare(`SELECT e.event_participant_id AS participantId,ep.display_name AS displayName,e.milestone,e.status,e.source,e.occurred_at AS occurredAt
      FROM event_progress_events e JOIN event_participants ep ON ep.id=e.event_participant_id
      WHERE e.team_id=? ORDER BY e.occurred_at DESC LIMIT 200`).bind(account.teamId).all(),
    env.DB.prepare(`SELECT m.id,m.entry_kind AS entryKind,m.category,m.statement,m.source_type AS sourceType,m.observed_at AS observedAt,ep.display_name AS participantName,c.status AS memoryStatus
      FROM participant_model_entries m LEFT JOIN event_participants ep ON ep.id=m.anonymous_participant_id
      LEFT JOIN cognee_sync_outbox c ON c.source_type='participant_model' AND c.source_id=m.id
      WHERE m.anonymous_team_id=? ORDER BY m.observed_at DESC LIMIT 100`).bind(account.teamId).all(),
    env.DB.prepare(`SELECT id,anonymous_participant_id AS participantId,page,tutorial_step AS tutorialStep,user_prompt AS userPrompt,response_text AS responseText,status,created_at AS createdAt
      FROM prompt_events WHERE anonymous_team_id=? ORDER BY created_at DESC LIMIT 50`).bind(account.teamId).all(),
  ]);
  return Response.json({ account, team: { id: account.teamId, name: account.teamName, inviteCode: account.inviteCode }, members: members.results, projects: projects.results, progress: progress.results, memories: memories.results, questions: questions.results }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireCurrentAccount(request, env.DB);
  if (auth.error) return auth.error;
  const account = auth.account!;
  if (!account.teamId) return Response.json({ error: "Join or create a team first." }, { status: 409 });
  const input = await request.json() as { action?: string };
  if (input.action !== "regenerate_invite") return Response.json({ error: "Unknown team action." }, { status: 400 });
  const owner = await env.DB.prepare("SELECT membership_role AS membershipRole FROM team_memberships WHERE participant_id=? AND team_id=? AND ended_at IS NULL").bind(account.participantId, account.teamId).first<{ membershipRole: string }>();
  if (owner?.membershipRole !== "creator") return Response.json({ error: "Only the team creator can regenerate the invite code." }, { status: 403 });
  const inviteCode = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  await env.DB.prepare("UPDATE teams SET invite_code=?,updated_at=? WHERE id=?").bind(inviteCode, Date.now(), account.teamId).run();
  return Response.json({ account: await currentAccount(env.DB, auth.identity!), inviteCode });
}
