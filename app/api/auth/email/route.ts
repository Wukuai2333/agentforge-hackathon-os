import { env } from "cloudflare:workers";
import { consumeAuthToken, emailConfigured, issueAuthEmail, type AuthEmailRuntime } from "../../../../lib/auth-email";
import { authAudit, createLocalSession, hashPassword, normalizedEmail, sessionCookie } from "../../../../lib/local-auth";

type Input = { action?: "verify" | "request_verification" | "forgot" | "reset"; token?: string; email?: string; password?: string };

function responseWithSession(body: unknown, token: string) {
  return Response.json(body, { headers: { "Cache-Control": "no-store", "Set-Cookie": sessionCookie(token) } });
}

export async function POST(request: Request) {
  const runtime = env as unknown as AuthEmailRuntime;
  let input: Input;
  try { input = await request.json() as Input; }
  catch { return Response.json({ error: "Invalid request body." }, { status: 400 }); }

  if (input.action === "verify") {
    const token = input.token?.trim() || "";
    const record = token ? await consumeAuthToken(runtime, "verify_email", token) : null;
    if (!record) return Response.json({ error: "This verification link is invalid or has expired." }, { status: 400 });
    const now = Date.now();
    const consumed = await runtime.DB.prepare("UPDATE auth_action_tokens SET consumed_at=? WHERE id=? AND consumed_at IS NULL").bind(now, record.id).run();
    if (!consumed.meta.changes) return Response.json({ error: "This verification link has already been used." }, { status: 409 });
    await runtime.DB.prepare("UPDATE app_users SET email_verified_at=?,updated_at=? WHERE id=?").bind(now, now, record.userId).run();
    const session = await createLocalSession(runtime.DB, request, record.userId);
    await authAudit(runtime.DB, request, "verify_email", "success", { userId: record.userId, email: record.email, sessionId: session.id });
    return responseWithSession({ verified: true }, session.token);
  }

  if (input.action === "request_verification") {
    if (!emailConfigured(runtime)) return Response.json({ error: "Verification email is temporarily unavailable. Please contact an Organizer." }, { status: 503 });
    const email = normalizedEmail(input.email || "");
    const user = await runtime.DB.prepare("SELECT id,email,display_name AS displayName,email_verified_at AS verifiedAt FROM app_users WHERE email=? LIMIT 1")
      .bind(email).first<{ id: string; email: string; displayName: string; verifiedAt: number | null }>();
    if (!user) return Response.json({ sent: true });
    if (user.verifiedAt) return Response.json({ verified: true });
    const recent = await runtime.DB.prepare("SELECT created_at AS createdAt FROM auth_action_tokens WHERE user_id=? AND purpose='verify_email' ORDER BY created_at DESC LIMIT 1")
      .bind(user.id).first<{ createdAt: number }>();
    if (recent && recent.createdAt > Date.now() - 60_000) return Response.json({ error: "Please wait one minute before requesting another email." }, { status: 429 });
    await issueAuthEmail(runtime, user, "verify_email");
    await authAudit(runtime.DB, request, "verify_email", "sent", { userId: user.id, email });
    return Response.json({ sent: true });
  }

  if (input.action === "forgot") {
    if (!emailConfigured(runtime)) return Response.json({ error: "Password recovery is temporarily unavailable. Please contact an Organizer." }, { status: 503 });
    const email = normalizedEmail(input.email || "");
    const user = await runtime.DB.prepare("SELECT id,email,display_name AS displayName FROM app_users WHERE email=? LIMIT 1")
      .bind(email).first<{ id: string; email: string; displayName: string }>();
    if (user) {
      const recent = await runtime.DB.prepare("SELECT created_at AS createdAt FROM auth_action_tokens WHERE user_id=? AND purpose='reset_password' ORDER BY created_at DESC LIMIT 1")
        .bind(user.id).first<{ createdAt: number }>();
      if (!recent || recent.createdAt <= Date.now() - 60_000) {
        await issueAuthEmail(runtime, user, "reset_password");
        await authAudit(runtime.DB, request, "password_reset", "sent", { userId: user.id, email });
      }
    }
    return Response.json({ sent: true, message: "If this email is registered, a password reset link has been sent." });
  }

  if (input.action === "reset") {
    const token = input.token?.trim() || "", password = input.password || "";
    if (password.length < 12) return Response.json({ error: "Use a password with at least 12 characters." }, { status: 400 });
    const record = token ? await consumeAuthToken(runtime, "reset_password", token) : null;
    if (!record) return Response.json({ error: "This password reset link is invalid or has expired." }, { status: 400 });
    const now = Date.now(), passwordRecord = await hashPassword(password);
    const consumed = await runtime.DB.prepare("UPDATE auth_action_tokens SET consumed_at=? WHERE id=? AND consumed_at IS NULL").bind(now, record.id).run();
    if (!consumed.meta.changes) return Response.json({ error: "This password reset link has already been used." }, { status: 409 });
    await runtime.DB.batch([
      runtime.DB.prepare(`UPDATE user_credentials SET password_hash=?,password_salt=?,password_iterations=?,password_updated_at=?,failed_attempt_count=0,locked_until=NULL WHERE user_id=?`)
        .bind(passwordRecord.hash, passwordRecord.salt, passwordRecord.iterations, now, record.userId),
      runtime.DB.prepare("UPDATE auth_sessions SET revoked_at=?,revoke_reason='password_reset' WHERE user_id=? AND revoked_at IS NULL").bind(now, record.userId),
    ]);
    await authAudit(runtime.DB, request, "password_reset", "success", { userId: record.userId, email: record.email });
    return Response.json({ reset: true, message: "Password updated. Sign in with your new password." });
  }

  return Response.json({ error: "Unknown email authentication action." }, { status: 400 });
}
