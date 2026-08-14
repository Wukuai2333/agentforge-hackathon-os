const SESSION_COOKIE = "agentforge_session";
// Cloudflare Workers WebCrypto caps a single PBKDF2 operation at 100,000
// iterations. The count is stored per credential so it remains upgradeable.
const PASSWORD_ITERATIONS = 100_000;
const SESSION_LIFETIME_MS = 24 * 60 * 60 * 1000;

function bytesToBase64(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function base64ToBytes(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const decoded = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

export function normalizedEmail(value: string) {
  return value.trim().toLowerCase();
}

export function requestCookie(request: Request, name: string) {
  const item = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return item ? decodeURIComponent(item.slice(name.length + 1)) : "";
}

export function localSessionToken(request: Request) {
  return requestCookie(request, SESSION_COOKIE);
}

export async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

export async function hashPassword(password: string, salt = randomToken(24), iterations = PASSWORD_ITERATIONS) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const result = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: base64ToBytes(salt), iterations }, material, 256);
  return { hash: bytesToBase64(new Uint8Array(result)), salt, iterations, algorithm: "pbkdf2-sha256" };
}

export async function verifyPassword(password: string, storedHash: string, salt: string, iterations: number) {
  const candidate = await hashPassword(password, salt, iterations);
  const left = base64ToBytes(candidate.hash), right = base64ToBytes(storedHash);
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export function sessionCookie(token: string, maxAgeSeconds = Math.floor(SESSION_LIFETIME_MS / 1000)) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearLocalSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function createLocalSession(db: D1Database, request: Request, userId: string) {
  const token = randomToken(32), tokenHash = await sha256(token), now = Date.now(), id = crypto.randomUUID();
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  await db.prepare(`INSERT INTO auth_sessions
    (id,user_id,token_hash,created_at,expires_at,last_seen_at,ip_hash,user_agent)
    VALUES (?,?,?,?,?,?,?,?)`).bind(
      id, userId, tokenHash, now, now + SESSION_LIFETIME_MS, now,
      await sha256(ip), (request.headers.get("user-agent") || "").slice(0, 300),
    ).run();
  return { id, token, expiresAt: now + SESSION_LIFETIME_MS };
}

export async function localSessionIdentity(db: D1Database, request: Request) {
  const token = localSessionToken(request);
  if (!token) return null;
  const tokenHash = await sha256(token), now = Date.now();
  const identity = await db.prepare(`SELECT s.id AS sessionId,u.id AS subject,u.email,u.display_name AS displayName
    FROM auth_sessions s JOIN app_users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? LIMIT 1`)
    .bind(tokenHash, now).first<{ sessionId: string; subject: string; email: string; displayName: string }>();
  if (!identity) return null;
  await db.prepare("UPDATE auth_sessions SET last_seen_at=? WHERE id=? AND last_seen_at<?")
    .bind(now, identity.sessionId, now - 5 * 60 * 1000).run();
  return { ...identity, provider: "password" as const };
}

export async function revokeLocalSession(db: D1Database, request: Request, reason = "signed_out") {
  const token = localSessionToken(request);
  if (!token) return;
  await db.prepare("UPDATE auth_sessions SET revoked_at=?,revoke_reason=? WHERE token_hash=? AND revoked_at IS NULL")
    .bind(Date.now(), reason, await sha256(token)).run();
}

export async function authAudit(db: D1Database, request: Request, eventType: string, result: string, options: { userId?: string; email?: string; sessionId?: string; metadata?: Record<string, unknown> } = {}) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  await db.prepare(`INSERT INTO auth_audit_logs
    (id,user_id,normalized_email_hash,event_type,result,ip_hash,session_id,metadata_json,created_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).bind(
      crypto.randomUUID(), options.userId || null, options.email ? await sha256(normalizedEmail(options.email)) : null,
      eventType, result, await sha256(ip), options.sessionId || null,
      options.metadata ? JSON.stringify(options.metadata) : null, Date.now(),
    ).run();
}
