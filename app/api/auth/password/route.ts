import { env } from "cloudflare:workers";
import { authAudit, createLocalSession, hashPassword, normalizedEmail, sessionCookie, sha256, verifyPassword } from "../../../../lib/local-auth";

type Runtime = { DB: D1Database; ORGANIZER_EMAILS?: string };
type Input = { action?: "signup" | "signin"; email?: string; password?: string; displayName?: string };
type Credential = {
  userId: string;
  email: string;
  displayName: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  failedAttemptCount: number;
  lockedUntil: number | null;
};

function organizerEmails(runtime: Runtime) {
  return new Set((runtime.ORGANIZER_EMAILS || "").split(",").map(normalizedEmail).filter(Boolean));
}

function jsonWithSession(body: unknown, token: string, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", "Set-Cookie": sessionCookie(token) },
  });
}

async function requestFingerprint(request: Request) {
  return sha256(request.headers.get("cf-connecting-ip") || "unknown");
}

async function registrationIsOpen(db: D1Database) {
  const event = await db.prepare("SELECT registration_open AS registrationOpen FROM event_configuration WHERE id='primary'")
    .first<{ registrationOpen: number }>();
  return event?.registrationOpen !== 0;
}

async function signup(request: Request, runtime: Runtime, input: Input) {
  const email = normalizedEmail(input.email || "");
  const displayName = (input.displayName || "").trim().slice(0, 100);
  const password = input.password || "";
  if (!await registrationIsOpen(runtime.DB)) return Response.json({ error: "Registration is currently closed." }, { status: 403 });
  if (!/^\S+@\S+\.\S+$/.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!displayName) return Response.json({ error: "Enter the name your teammates should see." }, { status: 400 });
  if (password.length < 12) return Response.json({ error: "Use a password with at least 12 characters." }, { status: 400 });

  const ipHash = await requestFingerprint(request);
  const recentSignups = await runtime.DB.prepare(`SELECT COUNT(*) AS count FROM auth_audit_logs
    WHERE ip_hash=? AND event_type='signup' AND created_at>?`).bind(ipHash, Date.now() - 60 * 60 * 1000).first<{ count: number }>();
  if (Number(recentSignups?.count || 0) >= 10) {
    await authAudit(runtime.DB, request, "signup", "rate_limited", { email });
    return Response.json({ error: "Too many signup attempts. Please try again later." }, { status: 429 });
  }

  const existing = await runtime.DB.prepare("SELECT id FROM app_users WHERE email=? LIMIT 1").bind(email).first<{ id: string }>();
  if (existing) {
    await authAudit(runtime.DB, request, "signup", "email_exists", { email, userId: existing.id });
    return Response.json({ error: "An account already exists for this email. Sign in instead." }, { status: 409 });
  }

  const now = Date.now(), userId = crypto.randomUUID(), identityId = crypto.randomUUID();
  const passwordRecord = await hashPassword(password);
  const grant = await runtime.DB.prepare("SELECT email FROM organizer_access_grants WHERE email=? AND status='active'")
    .bind(email).first<{ email: string }>();
  const role = organizerEmails(runtime).has(email) || Boolean(grant) ? "organizer" : "participant";
  try {
    await runtime.DB.batch([
      runtime.DB.prepare(`INSERT INTO app_users
        (id,identity_provider,identity_subject,email,display_name,role,created_at,updated_at)
        VALUES (?,'password',?,?,?,?,?,?)`).bind(userId, userId, email, displayName, role, now, now),
      runtime.DB.prepare(`INSERT INTO user_identities
        (id,user_id,provider,provider_subject,provider_email,linked_at,last_used_at)
        VALUES (?,?,'password',?,?,?,?)`).bind(identityId, userId, userId, email, now, now),
      runtime.DB.prepare(`INSERT INTO user_credentials
        (user_id,password_hash,password_salt,password_algorithm,password_iterations,password_updated_at,failed_attempt_count)
        VALUES (?,?,?,'pbkdf2-sha256',?,?,0)`).bind(userId, passwordRecord.hash, passwordRecord.salt, passwordRecord.iterations, now),
    ]);
  } catch {
    await authAudit(runtime.DB, request, "signup", "database_conflict", { email });
    return Response.json({ error: "This email is already registered. Sign in instead." }, { status: 409 });
  }
  const session = await createLocalSession(runtime.DB, request, userId);
  await authAudit(runtime.DB, request, "signup", "success", { email, userId, sessionId: session.id });
  return jsonWithSession({ authenticated: true, identity: { subject: userId, email, displayName, provider: "password" } }, session.token, 201);
}

async function signin(request: Request, runtime: Runtime, input: Input) {
  const email = normalizedEmail(input.email || ""), password = input.password || "", now = Date.now();
  const emailHash = await sha256(email);
  const recentFailures = await runtime.DB.prepare(`SELECT COUNT(*) AS count FROM auth_audit_logs
    WHERE normalized_email_hash=? AND event_type='signin' AND result='invalid_credentials' AND created_at>?`)
    .bind(emailHash, now - 15 * 60 * 1000).first<{ count: number }>();
  if (Number(recentFailures?.count || 0) >= 10) {
    await authAudit(runtime.DB, request, "signin", "rate_limited", { email });
    return Response.json({ error: "Too many failed attempts. Please wait 15 minutes and try again." }, { status: 429 });
  }

  const credential = await runtime.DB.prepare(`SELECT u.id AS userId,u.email,u.display_name AS displayName,
      c.password_hash AS passwordHash,c.password_salt AS passwordSalt,c.password_iterations AS passwordIterations,
      c.failed_attempt_count AS failedAttemptCount,c.locked_until AS lockedUntil
    FROM app_users u JOIN user_credentials c ON c.user_id=u.id WHERE u.email=? LIMIT 1`)
    .bind(email).first<Credential>();
  const valid = credential && (!credential.lockedUntil || credential.lockedUntil <= now)
    ? await verifyPassword(password, credential.passwordHash, credential.passwordSalt, credential.passwordIterations)
    : false;
  if (!credential || !valid) {
    if (credential) {
      const failures = credential.failedAttemptCount + 1;
      await runtime.DB.prepare("UPDATE user_credentials SET failed_attempt_count=?,locked_until=? WHERE user_id=?")
        .bind(failures, failures >= 10 ? now + 15 * 60 * 1000 : null, credential.userId).run();
    }
    await authAudit(runtime.DB, request, "signin", "invalid_credentials", { email, userId: credential?.userId });
    return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  await runtime.DB.batch([
    runtime.DB.prepare("UPDATE user_credentials SET failed_attempt_count=0,locked_until=NULL WHERE user_id=?").bind(credential.userId),
    runtime.DB.prepare("UPDATE user_identities SET last_used_at=? WHERE user_id=? AND provider='password'").bind(now, credential.userId),
  ]);
  const session = await createLocalSession(runtime.DB, request, credential.userId);
  await authAudit(runtime.DB, request, "signin", "success", { email, userId: credential.userId, sessionId: session.id });
  return jsonWithSession({ authenticated: true, identity: { subject: credential.userId, email: credential.email, displayName: credential.displayName, provider: "password" } }, session.token);
}

export async function POST(request: Request) {
  const runtime = env as unknown as Runtime;
  let input: Input;
  try { input = await request.json() as Input; }
  catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }
  if (input.action === "signup") return signup(request, runtime, input);
  if (input.action === "signin") return signin(request, runtime, input);
  return Response.json({ error: "Unknown authentication action." }, { status: 400 });
}
