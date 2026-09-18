import { randomToken, sha256 } from "./local-auth";

export type AuthEmailRuntime = {
  DB: D1Database;
  RESEND_API_KEY?: string;
  AUTH_EMAIL_FROM?: string;
  APP_ORIGIN?: string;
};

type Purpose = "verify_email" | "reset_password";

const lifetime: Record<Purpose, number> = {
  verify_email: 24 * 60 * 60 * 1000,
  reset_password: 30 * 60 * 1000,
};

export function emailConfigured(runtime: AuthEmailRuntime) {
  return Boolean(runtime.RESEND_API_KEY && runtime.AUTH_EMAIL_FROM && runtime.APP_ORIGIN);
}

function safeOrigin(runtime: AuthEmailRuntime) {
  const value = String(runtime.APP_ORIGIN || "").replace(/\/$/, "");
  if (!/^https:\/\//.test(value) && !/^http:\/\/localhost(?::\d+)?$/.test(value)) throw new Error("APP_ORIGIN is not configured with a safe URL.");
  return value;
}

async function deliver(runtime: AuthEmailRuntime, to: string, subject: string, html: string) {
  if (!emailConfigured(runtime)) throw new Error("Transactional email is not configured.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${runtime.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: runtime.AUTH_EMAIL_FROM, to: [to], subject, html }),
  });
  if (!response.ok) throw new Error(`Email provider rejected the request (${response.status}).`);
}

export async function issueAuthEmail(runtime: AuthEmailRuntime, user: { id: string; email: string; displayName: string }, purpose: Purpose) {
  const token = randomToken(32), tokenHash = await sha256(token), now = Date.now();
  await runtime.DB.batch([
    runtime.DB.prepare("UPDATE auth_action_tokens SET consumed_at=? WHERE user_id=? AND purpose=? AND consumed_at IS NULL").bind(now, user.id, purpose),
    runtime.DB.prepare(`INSERT INTO auth_action_tokens (id,user_id,purpose,token_hash,expires_at,created_at)
      VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(), user.id, purpose, tokenHash, now + lifetime[purpose], now),
  ]);
  const action = purpose === "verify_email" ? "verify" : "reset";
  const url = `${safeOrigin(runtime)}/?auth=${action}&token=${encodeURIComponent(token)}`;
  const heading = purpose === "verify_email" ? "Verify your AgentForge email" : "Reset your AgentForge password";
  const explanation = purpose === "verify_email"
    ? "Confirm this email address before continuing to the hackathon consent and onboarding flow. This link expires in 24 hours and can be used once."
    : "Use this link to choose a new password. It expires in 30 minutes and can be used once. If you did not request it, you can ignore this email.";
  try {
    await deliver(runtime, user.email, heading, `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;padding:32px"><h1>${heading}</h1><p>Hello ${user.displayName.replace(/[<>&]/g, "")},</p><p>${explanation}</p><p><a style="display:inline-block;background:#171718;color:#fff;padding:14px 20px;border-radius:8px;text-decoration:none" href="${url}">${purpose === "verify_email" ? "Verify email" : "Reset password"}</a></p><p style="color:#68645d;font-size:13px">Never forward this link or share it in a Prompt.</p></div>`);
  } catch (error) {
    await runtime.DB.prepare("UPDATE auth_action_tokens SET consumed_at=? WHERE token_hash=?").bind(Date.now(), tokenHash).run();
    throw error;
  }
  return { expiresAt: now + lifetime[purpose] };
}

export async function consumeAuthToken(runtime: AuthEmailRuntime, purpose: Purpose, token: string) {
  const tokenHash = await sha256(token);
  return runtime.DB.prepare(`SELECT t.id,t.user_id AS userId,u.email,u.display_name AS displayName
    FROM auth_action_tokens t JOIN app_users u ON u.id=t.user_id
    WHERE t.token_hash=? AND t.purpose=? AND t.consumed_at IS NULL AND t.expires_at>? LIMIT 1`)
    .bind(tokenHash, purpose, Date.now()).first<{ id: string; userId: string; email: string; displayName: string }>();
}
