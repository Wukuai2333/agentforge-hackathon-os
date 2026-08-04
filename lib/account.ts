export type AuthIdentity = {
  subject: string;
  email: string;
  displayName: string;
  provider: "chatgpt";
};

export type CurrentAccount = {
  userId: string;
  participantId: string;
  eventId: string;
  displayName: string;
  email: string;
  role: "participant" | "mentor" | "organizer";
  consentVersion: string;
  teamId: string | null;
  teamName: string | null;
  inviteCode: string | null;
};

function decodeName(headers: Headers, email: string) {
  const encoded = headers.get("oai-authenticated-user-full-name");
  if (!encoded || headers.get("oai-authenticated-user-full-name-encoding") !== "percent-encoded-utf-8") return email;
  try { return decodeURIComponent(encoded); } catch { return email; }
}

export function identityFromRequest(request: Request): AuthIdentity | null {
  const subject = request.headers.get("oai-authenticated-user-id")?.trim();
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!subject || !email) return null;
  return { subject, email, displayName: decodeName(request.headers, email), provider: "chatgpt" };
}

export async function currentAccount(db: D1Database, identity: AuthIdentity): Promise<CurrentAccount | null> {
  return db.prepare(`SELECT u.id AS userId, ep.id AS participantId, ep.event_id AS eventId,
      u.display_name AS displayName, u.email, ep.role, ep.consent_version AS consentVersion,
      t.id AS teamId, t.name AS teamName, t.invite_code AS inviteCode
    FROM app_users u
    JOIN event_participants ep ON ep.user_id=u.id
    LEFT JOIN team_memberships tm ON tm.participant_id=ep.id AND tm.ended_at IS NULL
    LEFT JOIN teams t ON t.id=tm.team_id AND t.status='active'
    WHERE u.identity_provider=? AND u.identity_subject=?
    ORDER BY ep.joined_at DESC LIMIT 1`)
    .bind(identity.provider, identity.subject).first<CurrentAccount>();
}

export async function requireCurrentAccount(request: Request, db: D1Database) {
  const identity = identityFromRequest(request);
  if (!identity) return { error: Response.json({ error: "Sign in is required." }, { status: 401 }), identity: null, account: null };
  const account = await currentAccount(db, identity);
  if (!account) return { error: Response.json({ error: "Complete event registration first." }, { status: 403 }), identity, account: null };
  return { error: null, identity, account };
}
