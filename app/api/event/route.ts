import { env } from "cloudflare:workers";
import { currentAccount, identityFromRequest } from "../../../lib/account";

type Runtime = { DB: D1Database; ORGANIZER_EMAILS?: string };
const serverOrganizerEmails = (runtime: Runtime) => new Set((runtime.ORGANIZER_EMAILS || "")
  .split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
const organizerAccount = async (request: Request, runtime: Runtime) => {
  const identity = await identityFromRequest(request);
  if (!identity) return null;
  const account = await currentAccount(runtime.DB, identity);
  return account?.role === "organizer" ? account : null;
};

export async function GET(request: Request) {
  const runtime = env as unknown as Runtime;
  const config = await runtime.DB.prepare(`SELECT event_name AS eventName, starts_at AS startsAt, ends_at AS endsAt,
    timezone, discord_url AS discordUrl, announcement_text AS announcementText,
    announcement_active AS announcementActive, announcement_updated_at AS announcementUpdatedAt,
    registration_open AS registrationOpen, updated_at AS updatedAt
    FROM event_configuration WHERE id='primary'`).first();
  const publishedAnnouncements = await runtime.DB.prepare(`SELECT id, announcement_text AS announcementText,
    action, created_at AS createdAt FROM event_announcement_history
    WHERE active=1 AND announcement_text IS NOT NULL
    ORDER BY created_at DESC LIMIT 100`).all();
  const organizer = await organizerAccount(request, runtime);
  if (!organizer) {
    if (new URL(request.url).searchParams.get("admin") === "1") return Response.json({ error: "Organizer access required." }, { status: 401 });
    return Response.json({ config, publishedAnnouncements: publishedAnnouncements.results });
  }
  const participants = await runtime.DB.prepare(`SELECT ep.id, ep.display_name AS displayName, ep.email, ep.role,
    ep.consent_version AS consentVersion, ep.joined_at AS joinedAt, t.name AS teamName,
    COALESCE((SELECT cr.status FROM consent_records cr WHERE cr.event_participant_id=ep.id ORDER BY cr.recorded_at DESC LIMIT 1),
      CASE WHEN ep.consent_version='pending' THEN 'pending' ELSE 'accepted' END) AS consentStatus,
    MAX(ep.updated_at,
      COALESCE((SELECT MAX(pe.created_at) FROM prompt_events pe WHERE pe.anonymous_participant_id=ep.id),0),
      COALESCE((SELECT MAX(pg.occurred_at) FROM event_progress_events pg WHERE pg.event_participant_id=ep.id),0),
      COALESCE((SELECT MAX(fe.created_at) FROM assistant_feedback_events fe WHERE fe.anonymous_participant_id=ep.id),0)) AS lastActive
    FROM event_participants ep
    LEFT JOIN team_memberships tm ON tm.participant_id=ep.id AND tm.ended_at IS NULL
    LEFT JOIN teams t ON t.id=tm.team_id
    ORDER BY ep.joined_at DESC LIMIT 500`).all();
  const announcementHistory = await runtime.DB.prepare(`SELECT id, announcement_text AS announcementText, action, active,
    editor_name AS editorName, created_at AS createdAt FROM event_announcement_history ORDER BY created_at DESC LIMIT 100`).all();
  const organizerGrants = await runtime.DB.prepare(`SELECT email,status,granted_by_name AS grantedByName,
    created_at AS createdAt,updated_at AS updatedAt FROM organizer_access_grants ORDER BY updated_at DESC`).all();
  return Response.json({ config, participants: participants.results, organizerGrants: organizerGrants.results,
    serverOrganizerEmails: [...serverOrganizerEmails(runtime)], currentOrganizerParticipantId: organizer.participantId,
    announcementHistory: announcementHistory.results, publishedAnnouncements: publishedAnnouncements.results });
}

export async function POST(request: Request) {
  const runtime = env as unknown as Runtime;
  const organizer = await organizerAccount(request, runtime);
  if (!organizer) return Response.json({ error: "Organizer access required." }, { status: 401 });
  const input = await request.json() as { email?: string };
  const email = input.email?.trim().toLowerCase() || "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  const now = Date.now();
  await runtime.DB.batch([
    runtime.DB.prepare(`INSERT INTO organizer_access_grants
      (email,status,granted_by_participant_id,granted_by_name,created_at,updated_at)
      VALUES (?,'active',?,?,?,?) ON CONFLICT(email) DO UPDATE SET status='active',
      granted_by_participant_id=excluded.granted_by_participant_id,granted_by_name=excluded.granted_by_name,updated_at=excluded.updated_at`)
      .bind(email, organizer.participantId, organizer.displayName, now, now),
    runtime.DB.prepare("UPDATE app_users SET role='organizer',updated_at=? WHERE lower(email)=?").bind(now, email),
    runtime.DB.prepare("UPDATE event_participants SET role='organizer',consent_version=CASE WHEN consent_version='pending' THEN 'organizer-access-v1' ELSE consent_version END,updated_at=? WHERE lower(email)=?").bind(now, email),
  ]);
  const registered = await runtime.DB.prepare("SELECT id FROM event_participants WHERE lower(email)=? LIMIT 1").bind(email).first<{ id: string }>();
  return Response.json({ saved: true, email, registered: Boolean(registered) });
}

export async function DELETE(request: Request) {
  const runtime = env as unknown as Runtime;
  const organizer = await organizerAccount(request, runtime);
  if (!organizer) return Response.json({ error: "Organizer access required." }, { status: 401 });
  const input = await request.json() as { email?: string };
  const email = input.email?.trim().toLowerCase() || "";
  if (!email) return Response.json({ error: "Organizer email is required." }, { status: 400 });
  if (serverOrganizerEmails(runtime).has(email)) return Response.json({ error: "This Organizer is protected by the server allowlist." }, { status: 409 });
  const target = await runtime.DB.prepare("SELECT id,user_id AS userId,role FROM event_participants WHERE lower(email)=? LIMIT 1").bind(email).first<{ id: string; userId: string | null; role: string }>();
  if (target?.role === "organizer") {
    const count = await runtime.DB.prepare("SELECT COUNT(*) AS count FROM event_participants WHERE role='organizer'").first<{ count: number }>();
    if (Number(count?.count || 0) <= 1) return Response.json({ error: "At least one Organizer must remain." }, { status: 409 });
  }
  const now = Date.now();
  const statements = [runtime.DB.prepare("UPDATE organizer_access_grants SET status='revoked',updated_at=? WHERE email=?").bind(now, email)];
  if (target?.userId) {
    statements.push(runtime.DB.prepare("UPDATE app_users SET role='participant',updated_at=? WHERE id=?").bind(now, target.userId));
    statements.push(runtime.DB.prepare("UPDATE event_participants SET role='participant',updated_at=? WHERE id=?").bind(now, target.id));
  }
  await runtime.DB.batch(statements);
  return Response.json({ saved: true, email });
}

export async function PUT(request: Request) {
  const runtime = env as unknown as Runtime;
  if (!await organizerAccount(request, runtime)) return Response.json({ error: "Organizer access required." }, { status: 401 });
  const input = await request.json() as { eventName?: string; startsAt?: number | null; endsAt?: number | null; timezone?: string; discordUrl?: string; announcementText?: string; announcementActive?: boolean; registrationOpen?: boolean };
  const startsAt = Number(input.startsAt) || null, endsAt = Number(input.endsAt) || null;
  if (startsAt && endsAt && endsAt <= startsAt) return Response.json({ error: "End time must be after start time." }, { status: 400 });
  const discordUrl = input.discordUrl?.trim() || null;
  if (discordUrl && !/^https:\/\/(discord\.gg|discord\.com\/invite)\//i.test(discordUrl)) return Response.json({ error: "Enter a valid Discord invite URL." }, { status: 400 });
  const updatedAt = Date.now();
  const announcementText = input.announcementText?.trim().slice(0, 1000) || null;
  const announcementActive = Boolean(input.announcementActive && announcementText);
  const previous = await runtime.DB.prepare("SELECT announcement_text AS announcementText, announcement_active AS announcementActive FROM event_configuration WHERE id='primary'").first<{ announcementText: string | null; announcementActive: number }>();
  const announcementChanged = (previous?.announcementText || null) !== announcementText || Boolean(previous?.announcementActive) !== announcementActive;
  const statements = [runtime.DB.prepare(`INSERT INTO event_configuration (id,event_name,starts_at,ends_at,timezone,discord_url,announcement_text,announcement_active,announcement_updated_at,registration_open,updated_at)
    VALUES ('primary',?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET event_name=excluded.event_name,starts_at=excluded.starts_at,
    ends_at=excluded.ends_at,timezone=excluded.timezone,discord_url=excluded.discord_url,announcement_text=excluded.announcement_text,
    announcement_active=excluded.announcement_active,announcement_updated_at=excluded.announcement_updated_at,
    registration_open=excluded.registration_open,updated_at=excluded.updated_at`)
    .bind(input.eventName?.trim().slice(0, 120) || "Personal Agent Hackathon", startsAt, endsAt, input.timezone?.trim().slice(0, 80) || "America/New_York", discordUrl, announcementText, announcementActive ? 1 : 0, updatedAt, input.registrationOpen === false ? 0 : 1, updatedAt)];
  if (announcementChanged) {
    const action = !announcementActive ? "withdrawn" : previous?.announcementActive ? "updated" : "published";
    statements.push(runtime.DB.prepare(`INSERT INTO event_announcement_history (id,announcement_text,action,active,editor_name,created_at) VALUES (?,?,?,?,?,?)`)
      .bind(crypto.randomUUID(), announcementText, action, announcementActive ? 1 : 0, "Organizer", updatedAt));
  }
  await runtime.DB.batch(statements);
  return Response.json({ saved: true, updatedAt });
}

export async function PATCH(request: Request) {
  const runtime = env as unknown as Runtime;
  const organizer = await organizerAccount(request, runtime);
  if (!organizer) return Response.json({ error: "Organizer access required." }, { status: 401 });
  const input = await request.json() as { participantId?: string; role?: "participant" | "organizer" };
  if (!input.participantId || !["participant", "organizer"].includes(input.role || "")) {
    return Response.json({ error: "Participant and role are required." }, { status: 400 });
  }
  const target = await runtime.DB.prepare("SELECT id,user_id AS userId,role,email FROM event_participants WHERE id=?").bind(input.participantId).first<{ id: string; userId: string | null; role: string; email: string | null }>();
  if (!target?.userId) return Response.json({ error: "Registered user not found." }, { status: 404 });
  if (target.role === "organizer" && input.role === "participant") {
    if (target.email && serverOrganizerEmails(runtime).has(target.email.toLowerCase())) return Response.json({ error: "This Organizer is protected by the server allowlist." }, { status: 409 });
    const count = await runtime.DB.prepare("SELECT COUNT(*) AS count FROM event_participants WHERE role='organizer'").first<{ count: number }>();
    if (Number(count?.count || 0) <= 1) return Response.json({ error: "At least one Organizer must remain." }, { status: 409 });
  }
  const now = Date.now();
  await runtime.DB.batch([
    runtime.DB.prepare("UPDATE event_participants SET role=?,updated_at=? WHERE id=?").bind(input.role, now, target.id),
    runtime.DB.prepare("UPDATE app_users SET role=?,updated_at=? WHERE id=?").bind(input.role, now, target.userId),
    ...(input.role === "participant" && target.email ? [runtime.DB.prepare("UPDATE organizer_access_grants SET status='revoked',updated_at=? WHERE email=?").bind(now, target.email.toLowerCase())] : []),
  ]);
  return Response.json({ saved: true, participantId: target.id, role: input.role, changedBy: organizer.participantId });
}
