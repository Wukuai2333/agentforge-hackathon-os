import { accessTokenFromRequest, authRuntime, identityFromRequest, identityFromSupabaseToken, refreshTokenFromRequest } from "../../../../lib/account";

type SessionInput = { accessToken?: string; refreshToken?: string; expiresIn?: number };
type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string; msg?: string };

function sessionHeaders(accessToken: string, refreshToken: string, expiresIn = 3600) {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  headers.append("Set-Cookie", `agentforge_access_token=${encodeURIComponent(accessToken)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(60, Math.min(expiresIn, 86400))}`);
  if (refreshToken) headers.append("Set-Cookie", `agentforge_refresh_token=${encodeURIComponent(refreshToken)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000`);
  return headers;
}

function clearedHeaders() {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  headers.append("Set-Cookie", "agentforge_access_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  headers.append("Set-Cookie", "agentforge_refresh_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");
  return headers;
}

export async function GET(request: Request) {
  const current = await identityFromRequest(request);
  if (current) return Response.json({ authenticated: true, identity: current }, { headers: { "Cache-Control": "no-store" } });
  const refreshToken = refreshTokenFromRequest(request);
  const config = authRuntime();
  if (!refreshToken || !config.url || !config.publishableKey) return Response.json({ authenticated: false }, { status: 401, headers: clearedHeaders() });
  const refreshed = await fetch(`${config.url}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST", headers: { apikey: config.publishableKey, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refreshToken }),
  });
  const tokens = await refreshed.json() as TokenResponse;
  if (!refreshed.ok || !tokens.access_token) return Response.json({ authenticated: false, error: "Your session expired. Please sign in again." }, { status: 401, headers: clearedHeaders() });
  const identity = await identityFromSupabaseToken(tokens.access_token);
  if (!identity) return Response.json({ authenticated: false }, { status: 401, headers: clearedHeaders() });
  return new Response(JSON.stringify({ authenticated: true, identity }), { headers: sessionHeaders(tokens.access_token, tokens.refresh_token || refreshToken, tokens.expires_in) });
}

export async function POST(request: Request) {
  const input = await request.json() as SessionInput;
  const accessToken = input.accessToken?.trim() || "";
  const refreshToken = input.refreshToken?.trim() || "";
  const identity = await identityFromSupabaseToken(accessToken);
  if (!identity) return Response.json({ error: "Supabase did not return a valid authenticated user." }, { status: 401 });
  return new Response(JSON.stringify({ authenticated: true, identity }), { headers: sessionHeaders(accessToken, refreshToken, Number(input.expiresIn || 3600)) });
}

export async function DELETE(request: Request) {
  const token = accessTokenFromRequest(request);
  const config = authRuntime();
  if (token && config.url && config.publishableKey) {
    try { await fetch(`${config.url}/auth/v1/logout`, { method: "POST", headers: { apikey: config.publishableKey, Authorization: `Bearer ${token}` } }); } catch { /* Local sign-out still completes. */ }
  }
  return Response.json({ signedOut: true }, { headers: clearedHeaders() });
}
