import { accessTokenFromRequest, authRuntime, identityFromSupabaseToken } from "../../../../lib/account";

export async function PATCH(request: Request) {
  const token = accessTokenFromRequest(request);
  const input = await request.json() as { password?: string };
  const password = input.password || "";
  if (password.length < 8) return Response.json({ error: "Use at least 8 characters." }, { status: 400 });
  if (!token || !await identityFromSupabaseToken(token)) return Response.json({ error: "This recovery session is no longer valid." }, { status: 401 });
  const config = authRuntime();
  const response = await fetch(`${config.url}/auth/v1/user`, {
    method: "PUT", headers: { apikey: config.publishableKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ password }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { msg?: string; error_description?: string };
    return Response.json({ error: result.msg || result.error_description || "Password could not be updated." }, { status: response.status });
  }
  return Response.json({ updated: true });
}
