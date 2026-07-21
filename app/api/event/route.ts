import { env } from "cloudflare:workers";

type Runtime = { DB: D1Database; ORGANIZER_ACCESS_CODE?: string };
const authorized = (request: Request, runtime: Runtime) => Boolean(runtime.ORGANIZER_ACCESS_CODE && request.headers.get("x-organizer-code") === runtime.ORGANIZER_ACCESS_CODE);

export async function GET(request: Request) {
  const runtime = env as unknown as Runtime;
  const config = await runtime.DB.prepare(`SELECT event_name AS eventName, starts_at AS startsAt, ends_at AS endsAt,
    timezone, discord_url AS discordUrl, announcement_text AS announcementText,
    announcement_active AS announcementActive, announcement_updated_at AS announcementUpdatedAt,
    registration_open AS registrationOpen, updated_at AS updatedAt
    FROM event_configuration WHERE id='primary'`).first();
  if (!authorized(request, runtime)) return Response.json({ config });
  const participants = await runtime.DB.prepare(`SELECT ep.id, ep.display_name AS displayName, ep.email, ep.role, ep.status,
    ep.joined_at AS joinedAt, t.name AS teamName
    FROM event_participants ep
    LEFT JOIN team_memberships tm ON tm.participant_id=ep.id AND tm.ended_at IS NULL
    LEFT JOIN teams t ON t.id=tm.team_id
    ORDER BY ep.joined_at DESC LIMIT 500`).all();
  const anonymous = await runtime.DB.prepare(`SELECT p.id, COALESCE(p.display_name,'Anonymous participant') AS displayName,
    NULL AS email, 'participant' AS role, 'prototype' AS status, p.created_at AS joinedAt, t.name AS teamName
    FROM participants p LEFT JOIN teams t ON t.id=p.team_id
    WHERE NOT EXISTS (SELECT 1 FROM event_participants ep WHERE ep.id=p.id)
    ORDER BY p.created_at DESC LIMIT 500`).all();
  return Response.json({ config, participants: [...participants.results, ...anonymous.results] });
}

export async function PUT(request: Request) {
  const runtime = env as unknown as Runtime;
  if (!authorized(request, runtime)) return Response.json({ error: "Organizer access required." }, { status: 401 });
  const input = await request.json() as { eventName?: string; startsAt?: number | null; endsAt?: number | null; timezone?: string; discordUrl?: string; announcementText?: string; announcementActive?: boolean; registrationOpen?: boolean };
  const startsAt = Number(input.startsAt) || null, endsAt = Number(input.endsAt) || null;
  if (startsAt && endsAt && endsAt <= startsAt) return Response.json({ error: "End time must be after start time." }, { status: 400 });
  const discordUrl = input.discordUrl?.trim() || null;
  if (discordUrl && !/^https:\/\/(discord\.gg|discord\.com\/invite)\//i.test(discordUrl)) return Response.json({ error: "Enter a valid Discord invite URL." }, { status: 400 });
  const updatedAt = Date.now();
  const announcementText = input.announcementText?.trim().slice(0, 1000) || null;
  const announcementActive = Boolean(input.announcementActive && announcementText);
  await runtime.DB.prepare(`INSERT INTO event_configuration (id,event_name,starts_at,ends_at,timezone,discord_url,announcement_text,announcement_active,announcement_updated_at,registration_open,updated_at)
    VALUES ('primary',?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET event_name=excluded.event_name,starts_at=excluded.starts_at,
    ends_at=excluded.ends_at,timezone=excluded.timezone,discord_url=excluded.discord_url,announcement_text=excluded.announcement_text,
    announcement_active=excluded.announcement_active,announcement_updated_at=excluded.announcement_updated_at,
    registration_open=excluded.registration_open,updated_at=excluded.updated_at`)
    .bind(input.eventName?.trim().slice(0, 120) || "Personal Agent Hackathon", startsAt, endsAt, input.timezone?.trim().slice(0, 80) || "America/New_York", discordUrl, announcementText, announcementActive ? 1 : 0, updatedAt, input.registrationOpen === false ? 0 : 1, updatedAt).run();
  return Response.json({ saved: true, updatedAt });
}
