import { env } from "cloudflare:workers";
import { configuredDestination, partnerAuthorized, type ClawMaxPartnerRuntime } from "../../../../../lib/clawmax-partner";
import { sha256 } from "../../../../../lib/clawmax-ingestion";

type ExchangeInput = { connectionCode?: string; destinationId?: string; workspaceId?: string; userId?: string };

export async function POST(request: Request) {
  const runtime = env as unknown as ClawMaxPartnerRuntime;
  if (!runtime.CLAWMAX_INGESTION_TOKEN) return Response.json({ error: "ClawMax partner access is not configured." }, { status: 503 });
  if (!await partnerAuthorized(request, runtime)) return Response.json({ error: "Invalid partner credential." }, { status: 401 });
  let input: ExchangeInput;
  try { input = await request.json() as ExchangeInput; } catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const code = input.connectionCode?.trim().toUpperCase() || "";
  const destinationId = input.destinationId?.trim() || "";
  const workspaceId = input.workspaceId?.trim().slice(0, 200) || "";
  const userId = input.userId?.trim().slice(0, 200) || "";
  if (!code || !workspaceId || !userId) return Response.json({ error: "connectionCode, workspaceId, and userId are required." }, { status: 400 });
  if (destinationId !== configuredDestination(runtime)) return Response.json({ error: "This credential is not authorized for that destination." }, { status: 403 });
  const codeHash = await sha256(code);
  const now = Date.now();
  const row = await runtime.DB.prepare(`SELECT id,event_id AS eventId,participant_id AS participantId,
      destination_id AS destinationId,status,expires_at AS expiresAt
    FROM clawmax_enrollment_codes WHERE code_hash=? LIMIT 1`).bind(codeHash).first<{
      id: string; eventId: string; participantId: string; destinationId: string; status: string; expiresAt: number;
    }>();
  if (!row || row.destinationId !== destinationId) return Response.json({ error: "Connection code is invalid." }, { status: 404 });
  if (row.status !== "active") return Response.json({ error: "Connection code has already been used or revoked." }, { status: 409 });
  if (row.expiresAt <= now) {
    await runtime.DB.prepare("UPDATE clawmax_enrollment_codes SET status='expired' WHERE id=? AND status='active'").bind(row.id).run();
    return Response.json({ error: "Connection code has expired." }, { status: 410 });
  }
  const collision = await runtime.DB.prepare(`SELECT id,participant_id AS participantId FROM clawmax_partner_enrollments
    WHERE destination_id=? AND external_workspace_id=? AND external_user_id=? LIMIT 1`)
    .bind(destinationId, workspaceId, userId).first<{ id: string; participantId: string }>();
  if (collision && collision.participantId !== row.participantId) {
    return Response.json({ error: "This ClawMax identity is already connected to another participant." }, { status: 409 });
  }
  const enrollmentId = collision?.id || crypto.randomUUID();
  let results;
  if (collision) {
    results = await runtime.DB.batch([
      runtime.DB.prepare(`UPDATE clawmax_enrollment_codes SET status='consumed',consumed_at=?
        WHERE id=? AND status='active' AND expires_at>?`).bind(now, row.id, now),
      runtime.DB.prepare(`UPDATE clawmax_partner_enrollments SET event_id=?,participant_id=?,status='active',updated_at=?,revoked_at=NULL WHERE id=?`)
        .bind(row.eventId, row.participantId, now, enrollmentId),
    ]);
  } else {
    results = await runtime.DB.batch([
      runtime.DB.prepare(`UPDATE clawmax_enrollment_codes SET status='consumed',consumed_at=?
        WHERE id=? AND status='active' AND expires_at>?`).bind(now, row.id, now),
      runtime.DB.prepare(`INSERT INTO clawmax_partner_enrollments
        (id,destination_id,event_id,participant_id,external_workspace_id,external_user_id,status,created_at,updated_at)
        VALUES (?,?,?,?,?,?,'active',?,?)`).bind(enrollmentId, destinationId, row.eventId, row.participantId, workspaceId, userId, now, now),
    ]);
  }
  if (!results[0].meta.changes) return Response.json({ error: "Connection code was consumed by another request." }, { status: 409 });
  return Response.json({
    enrollmentId,
    destinationId,
    partnerParticipantId: enrollmentId,
    status: "active",
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
