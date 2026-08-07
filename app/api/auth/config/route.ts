import { env } from "cloudflare:workers";

type Runtime = { SUPABASE_URL?: string; SUPABASE_PUBLISHABLE_KEY?: string; SUPABASE_GOOGLE_ENABLED?: string };

export async function GET() {
  const runtime = env as unknown as Runtime;
  const url = runtime.SUPABASE_URL?.replace(/\/$/, "") || "";
  const publishableKey = runtime.SUPABASE_PUBLISHABLE_KEY || "";
  return Response.json({
    enabled: Boolean(url && publishableKey),
    url,
    publishableKey,
    googleEnabled: runtime.SUPABASE_GOOGLE_ENABLED === "true",
  }, { headers: { "Cache-Control": "no-store" } });
}
