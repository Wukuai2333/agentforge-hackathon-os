import { env } from "cloudflare:workers";

type Runtime = { DB: D1Database; GOOGLE_AUTH_ENABLED?: string };

export async function GET() {
  const runtime = env as unknown as Runtime;
  const event = await runtime.DB.prepare("SELECT registration_open AS registrationOpen FROM event_configuration WHERE id='primary'").first<{ registrationOpen: number }>();
  return Response.json({
    enabled: true,
    mode: "agentforge",
    googleEnabled: runtime.GOOGLE_AUTH_ENABLED === "true",
    registrationOpen: event?.registrationOpen !== 0,
  }, { headers: { "Cache-Control": "no-store" } });
}
