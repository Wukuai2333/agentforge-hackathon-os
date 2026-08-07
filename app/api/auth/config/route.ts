import { env } from "cloudflare:workers";

type Runtime = { DB: D1Database; SUPABASE_URL?: string; SUPABASE_PUBLISHABLE_KEY?: string; SUPABASE_GOOGLE_ENABLED?: string };

export async function GET() {
  const runtime = env as unknown as Runtime;
  const url = runtime.SUPABASE_URL?.replace(/\/$/, "") || "";
  const publishableKey = runtime.SUPABASE_PUBLISHABLE_KEY || "";
  const event = await runtime.DB.prepare("SELECT registration_open AS registrationOpen FROM event_configuration WHERE id='primary'").first<{ registrationOpen: number }>();
  return Response.json({
    enabled: Boolean(url && publishableKey),
    url,
    publishableKey,
    googleEnabled: runtime.SUPABASE_GOOGLE_ENABLED === "true",
    registrationOpen: event?.registrationOpen !== 0,
  }, { headers: { "Cache-Control": "no-store" } });
}
