type CreateTeamInput = {
  eventId: string;
  participantId: string;
  name: string;
  retentionEndsAt: number;
};

type JoinTeamInput = {
  eventId: string;
  participantId: string;
  inviteCode: string;
};

type ActiveMembership = { id: string; team_id: string };

async function activeMembership(db: D1Database, participantId: string) {
  return db.prepare(
    "SELECT id, team_id FROM team_memberships WHERE participant_id = ? AND ended_at IS NULL LIMIT 1",
  ).bind(participantId).first<ActiveMembership>();
}

export async function createTeam(db: D1Database, input: CreateTeamInput) {
  if ((await activeMembership(db, input.participantId)) !== null) {
    throw new Error("Leave or switch from the current team before creating another team.");
  }

  const now = Date.now();
  const teamId = crypto.randomUUID();
  const membershipId = crypto.randomUUID();
  const inviteId = crypto.randomUUID();
  const activityId = crypto.randomUUID();
  const inviteCode = crypto.randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();

  await db.batch([
    db.prepare("INSERT INTO teams (id, event_id, created_by_participant_id, name, invite_code, status, data_expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)")
      .bind(teamId, input.eventId, input.participantId, input.name.trim(), inviteCode, input.retentionEndsAt, now, now),
    db.prepare("INSERT INTO team_memberships (id, event_id, team_id, participant_id, membership_role, joined_at) VALUES (?, ?, ?, ?, 'creator', ?)")
      .bind(membershipId, input.eventId, teamId, input.participantId, now),
    db.prepare("INSERT INTO team_invites (id, event_id, team_id, code, created_by_participant_id, use_count, expires_at, created_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?)")
      .bind(inviteId, input.eventId, teamId, inviteCode, input.participantId, input.retentionEndsAt, now),
    db.prepare("INSERT INTO team_membership_events (id, event_id, participant_id, to_team_id, action, occurred_at) VALUES (?, ?, ?, ?, 'created', ?)")
      .bind(activityId, input.eventId, input.participantId, teamId, now),
  ]);

  return { teamId, inviteCode };
}

export async function joinOrSwitchTeam(db: D1Database, input: JoinTeamInput) {
  const invite = await db.prepare(
    `SELECT i.id, i.team_id, i.max_uses, i.use_count, i.expires_at, i.revoked_at
     FROM team_invites i JOIN teams t ON t.id = i.team_id
     WHERE i.event_id = ? AND i.code = ? AND t.status = 'active' LIMIT 1`,
  ).bind(input.eventId, input.inviteCode.trim().toUpperCase()).first<{
    id: string; team_id: string; max_uses: number | null; use_count: number; expires_at: number; revoked_at: number | null;
  }>();

  const now = Date.now();
  if (!invite || invite.revoked_at || invite.expires_at <= now || (invite.max_uses !== null && invite.use_count >= invite.max_uses)) {
    throw new Error("This team invitation is invalid or expired.");
  }

  const current = await activeMembership(db, input.participantId);
  if (current?.team_id === invite.team_id) return { teamId: invite.team_id, switched: false };

  const membershipId = crypto.randomUUID();
  const activityId = crypto.randomUUID();
  const statements = [];
  if (current) {
    statements.push(db.prepare("UPDATE team_memberships SET ended_at = ?, end_reason = 'switched' WHERE id = ?").bind(now, current.id));
  }
  statements.push(
    db.prepare("INSERT INTO team_memberships (id, event_id, team_id, participant_id, membership_role, joined_at) VALUES (?, ?, ?, ?, 'member', ?)")
      .bind(membershipId, input.eventId, invite.team_id, input.participantId, now),
    db.prepare("UPDATE team_invites SET use_count = use_count + 1 WHERE id = ?").bind(invite.id),
    db.prepare("INSERT INTO team_membership_events (id, event_id, participant_id, from_team_id, to_team_id, action, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(activityId, input.eventId, input.participantId, current?.team_id ?? null, invite.team_id, current ? "switched" : "joined", now),
  );
  await db.batch(statements);
  return { teamId: invite.team_id, switched: Boolean(current) };
}

export async function leaveTeam(db: D1Database, eventId: string, participantId: string) {
  const current = await activeMembership(db, participantId);
  if (!current) return { left: false };
  const now = Date.now();
  await db.batch([
    db.prepare("UPDATE team_memberships SET ended_at = ?, end_reason = 'left' WHERE id = ?").bind(now, current.id),
    db.prepare("INSERT INTO team_membership_events (id, event_id, participant_id, from_team_id, action, occurred_at) VALUES (?, ?, ?, ?, 'left', ?)")
      .bind(crypto.randomUUID(), eventId, participantId, current.team_id, now),
  ]);
  return { left: true, retainedTeamId: current.team_id };
}
