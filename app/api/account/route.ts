import { env } from "cloudflare:workers";
import { currentAccount, identityFromRequest, requireCurrentAccount } from "../../../lib/account";

type Runtime = { DB: D1Database; ORGANIZER_EMAILS?: string };
const POLICY_VERSION = "AF-DEMO-2026-07";

function organizers(runtime: Runtime) {
  return new Set((runtime.ORGANIZER_EMAILS || "").split(",").map((v) => v.trim().toLowerCase()).filter(Boolean));
}

async function ensureEvent(db: D1Database) {
  const existing = await db.prepare("SELECT id FROM hackathon_events ORDER BY created_at DESC LIMIT 1").first<{ id: string }>();
  if (existing) return existing.id;
  const config = await db.prepare("SELECT event_name AS name,starts_at AS startsAt,ends_at AS endsAt FROM event_configuration WHERE id='primary'").first<{ name?: string; startsAt?: number; endsAt?: number }>();
  const now = Date.now(), startsAt = Number(config?.startsAt || now), endsAt = Number(config?.endsAt || now + 86400000);
  const id = crypto.randomUUID();
  await db.prepare(`INSERT INTO hackathon_events
    (id,name,slug,starts_at,ends_at,retention_ends_at,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?, 'registration',?,?)`).bind(id, config?.name || "Personal Agent Hackathon", "current-event", startsAt, endsAt, endsAt + 86400000, now, now).run();
  return id;
}

async function bootstrap(request: Request, runtime: Runtime) {
  const identity = identityFromRequest(request);
  if (!identity) return Response.json({ authenticated: false, signInPath: "/signin-with-chatgpt?return_to=%2F" }, { status: 401 });
  const now = Date.now(), eventId = await ensureEvent(runtime.DB);
  const existing = await runtime.DB.prepare("SELECT id,role FROM app_users WHERE identity_provider=? AND identity_subject=?").bind(identity.provider, identity.subject).first<{ id: string; role: "participant" | "mentor" | "organizer" }>();
  const role = existing?.role === "organizer" || organizers(runtime).has(identity.email) ? "organizer" : existing?.role || "participant";
  const userId = existing?.id || crypto.randomUUID();
  if (existing) {
    await runtime.DB.prepare("UPDATE app_users SET email=?,display_name=?,role=?,updated_at=? WHERE id=?").bind(identity.email, identity.displayName, role, now, userId).run();
  } else {
    await runtime.DB.prepare(`INSERT INTO app_users (id,identity_provider,identity_subject,email,display_name,role,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?)`).bind(userId, identity.provider, identity.subject, identity.email, identity.displayName, role, now, now).run();
  }
  const registration = await runtime.DB.prepare("SELECT id FROM event_participants WHERE event_id=? AND user_id=?").bind(eventId, userId).first<{ id: string }>();
  if (!registration) {
    await runtime.DB.prepare(`INSERT INTO event_participants
      (id,event_id,user_id,identity_provider,identity_subject,email,display_name,role,status,consent_version,joined_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?, 'active',?,?,?)`).bind(crypto.randomUUID(), eventId, userId, identity.provider, identity.subject, identity.email, identity.displayName, role, role === "organizer" ? "organizer-access-v1" : "pending", now, now).run();
  } else {
    await runtime.DB.prepare("UPDATE event_participants SET email=?,display_name=?,role=?,updated_at=? WHERE id=?").bind(identity.email, identity.displayName, role, now, registration.id).run();
  }
  return Response.json({ authenticated: true, account: await currentAccount(runtime.DB, identity) });
}

async function moveTeam(runtime: Runtime, account: NonNullable<Awaited<ReturnType<typeof currentAccount>>>, toTeamId: string, action: "joined" | "switched" | "created", membershipRole: "creator" | "member") {
  const now = Date.now();
  if (account.teamId && account.teamId !== toTeamId) {
    await runtime.DB.prepare("UPDATE team_memberships SET ended_at=?,end_reason='switched' WHERE participant_id=? AND ended_at IS NULL").bind(now, account.participantId).run();
  }
  if (account.teamId !== toTeamId) await runtime.DB.prepare(`INSERT INTO team_memberships
    (id,event_id,team_id,participant_id,membership_role,joined_at) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(), account.eventId, toTeamId, account.participantId, membershipRole, now).run();
  await runtime.DB.prepare(`INSERT INTO team_membership_events
    (id,event_id,participant_id,from_team_id,to_team_id,action,occurred_at) VALUES (?,?,?,?,?,?,?)`).bind(crypto.randomUUID(), account.eventId, account.participantId, account.teamId, toTeamId, action, now).run();
}

export async function GET(request: Request) {
  const runtime = env as unknown as Runtime;
  const auth = await requireCurrentAccount(request, runtime.DB);
  if (auth.error) return auth.error;
  const members = auth.account!.teamId ? await runtime.DB.prepare(`SELECT ep.id,ep.display_name AS displayName,ep.role,tm.membership_role AS membershipRole,tm.joined_at AS joinedAt
    FROM team_memberships tm JOIN event_participants ep ON ep.id=tm.participant_id WHERE tm.team_id=? AND tm.ended_at IS NULL ORDER BY tm.joined_at`).bind(auth.account!.teamId).all() : { results: [] };
  return Response.json({ account: auth.account, members: members.results });
}

export async function POST(request: Request) {
  const runtime = env as unknown as Runtime;
  const input = await request.json() as { action?: string; choices?: boolean[]; teamName?: string; inviteCode?: string };
  if (input.action === "bootstrap") return bootstrap(request, runtime);
  const auth = await requireCurrentAccount(request, runtime.DB);
  if (auth.error) return auth.error;
  const account = auth.account!, now = Date.now();
  if (input.action === "accept_consent") {
    if (!input.choices || input.choices.length !== 3 || !input.choices.every(Boolean)) return Response.json({ error: "All consent choices must be confirmed." }, { status: 400 });
    await runtime.DB.batch([
      runtime.DB.prepare("INSERT INTO consent_records (id,event_participant_id,policy_version,status,choices_json,recorded_at) VALUES (?,?,?,'accepted',?,?)").bind(crypto.randomUUID(), account.participantId, POLICY_VERSION, JSON.stringify(input.choices), now),
      runtime.DB.prepare("UPDATE event_participants SET consent_version=?,updated_at=? WHERE id=?").bind(POLICY_VERSION, now, account.participantId),
    ]);
  } else if (input.action === "create_team") {
    const name = input.teamName?.trim().slice(0, 80) || "";
    if (!name) return Response.json({ error: "Team name is required." }, { status: 400 });
    const teamId = crypto.randomUUID(), inviteCode = crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
    await runtime.DB.prepare(`INSERT INTO teams (id,event_id,created_by_participant_id,name,invite_code,status,data_expires_at,created_at,updated_at)
      VALUES (?,?,?,?,?,'active',(SELECT retention_ends_at FROM hackathon_events WHERE id=?),?,?)`).bind(teamId, account.eventId, account.participantId, name, inviteCode, account.eventId, now, now).run();
    await moveTeam(runtime, account, teamId, account.teamId ? "switched" : "created", "creator");
  } else if (input.action === "join_team") {
    const code = input.inviteCode?.trim().toUpperCase() || "";
    const team = await runtime.DB.prepare("SELECT id FROM teams WHERE event_id=? AND invite_code=? AND status='active'").bind(account.eventId, code).first<{ id: string }>();
    if (!team) return Response.json({ error: "That team invite code is not valid." }, { status: 404 });
    await moveTeam(runtime, account, team.id, account.teamId ? "switched" : "joined", "member");
  } else if (input.action === "leave_team") {
    if (account.teamId) {
      await runtime.DB.batch([
        runtime.DB.prepare("UPDATE team_memberships SET ended_at=?,end_reason='left' WHERE participant_id=? AND ended_at IS NULL").bind(now, account.participantId),
        runtime.DB.prepare("INSERT INTO team_membership_events (id,event_id,participant_id,from_team_id,to_team_id,action,occurred_at) VALUES (?,?,?,?,NULL,'left',?)").bind(crypto.randomUUID(), account.eventId, account.participantId, account.teamId, now),
      ]);
    }
  } else return Response.json({ error: "Unknown account action." }, { status: 400 });
  return Response.json({ account: await currentAccount(runtime.DB, auth.identity!) });
}
