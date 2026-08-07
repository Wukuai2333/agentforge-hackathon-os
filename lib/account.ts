import { env } from "cloudflare:workers";
import { createRemoteJWKSet, jwtVerify } from "jose";

export type AuthIdentity = {
  subject: string;
  email: string;
  displayName: string;
  provider: "chatgpt" | "supabase";
};

type AuthRuntime = { SUPABASE_URL?: string; SUPABASE_PUBLISHABLE_KEY?: string };
const jwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export function authRuntime() {
  const runtime = env as unknown as AuthRuntime;
  return {
    url: runtime.SUPABASE_URL?.replace(/\/$/, "") || "",
    publishableKey: runtime.SUPABASE_PUBLISHABLE_KEY || "",
  };
}

function cookie(request: Request, name: string) {
  const match = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

export function accessTokenFromRequest(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  return bearer || cookie(request, "agentforge_access_token");
}

export function refreshTokenFromRequest(request: Request) {
  return cookie(request, "agentforge_refresh_token");
}

export async function identityFromSupabaseToken(token: string): Promise<AuthIdentity | null> {
  const config = authRuntime();
  if (!token || !config.url || !config.publishableKey) return null;
  try {
    let remote = jwks.get(config.url);
    if (!remote) {
      remote = createRemoteJWKSet(new URL(`${config.url}/auth/v1/.well-known/jwks.json`));
      jwks.set(config.url, remote);
    }
    const { payload } = await jwtVerify(token, remote, { issuer: `${config.url}/auth/v1`, audience: "authenticated" });
    const metadata = (payload.user_metadata || {}) as Record<string, unknown>;
    const email = String(payload.email || "").trim().toLowerCase();
    if (!payload.sub || !email) return null;
    return { subject: payload.sub, email, displayName: String(metadata.full_name || metadata.display_name || metadata.name || email), provider: "supabase" };
  } catch {
    try {
      const response = await fetch(`${config.url}/auth/v1/user`, { headers: { apikey: config.publishableKey, Authorization: `Bearer ${token}` } });
      if (!response.ok) return null;
      const user = await response.json() as { id?: string; email?: string; user_metadata?: Record<string, unknown> };
      const email = String(user.email || "").trim().toLowerCase();
      if (!user.id || !email) return null;
      return { subject: user.id, email, displayName: String(user.user_metadata?.full_name || user.user_metadata?.display_name || user.user_metadata?.name || email), provider: "supabase" };
    } catch { return null; }
  }
}

export type CurrentAccount = {
  userId: string;
  participantId: string;
  eventId: string;
  displayName: string;
  email: string;
  role: "participant" | "organizer";
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

export async function identityFromRequest(request: Request): Promise<AuthIdentity | null> {
  const accessToken = accessTokenFromRequest(request);
  if (accessToken) return identityFromSupabaseToken(accessToken);
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
  const identity = await identityFromRequest(request);
  if (!identity) return { error: Response.json({ error: "Sign in is required." }, { status: 401 }), identity: null, account: null };
  const account = await currentAccount(db, identity);
  if (!account) return { error: Response.json({ error: "Complete event registration first." }, { status: 403 }), identity, account: null };
  return { error: null, identity, account };
}
