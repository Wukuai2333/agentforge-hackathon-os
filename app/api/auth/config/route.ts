import { env } from "cloudflare:workers";

type Runtime = { DB: D1Database; GOOGLE_AUTH_ENABLED?: string; RESEND_API_KEY?: string; AUTH_EMAIL_FROM?: string; APP_ORIGIN?: string };

export async function GET() {
  const runtime = env as unknown as Runtime;
  const event = await runtime.DB.prepare("SELECT registration_open AS registrationOpen FROM event_configuration WHERE id='primary'").first<{ registrationOpen: number }>();
  return Response.json({
    enabled: true,
    mode: "agentforge",
    googleEnabled: runtime.GOOGLE_AUTH_ENABLED === "true",
    emailDeliveryConfigured: Boolean(runtime.RESEND_API_KEY && runtime.AUTH_EMAIL_FROM && runtime.APP_ORIGIN),
    registrationOpen: event?.registrationOpen !== 0,
  }, { headers: { "Cache-Control": "no-store" } });
}
