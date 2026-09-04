import { env } from "cloudflare:workers";
import { requireCurrentAccount } from "../../../../lib/account";
import {
  automaticClawMaxLaunchUrl,
  CLAWMAX_CONNECTION_CODE_TTL_MS,
  configuredDestination,
  randomConnectionCode,
  type ClawMaxPartnerRuntime,
} from "../../../../lib/clawmax-partner";
import { sha256 } from "../../../../lib/clawmax-ingestion";
import { processClawMaxPurge } from "../../../../lib/clawmax-purge";

export async function GET(request: Request) {
  const runtime = env as unknown as ClawMaxPartnerRuntime;
  const auth = await requireCurrentAccount(request, runtime.DB);
  if (auth.error) return auth.error;
  const enrollments = await runtime.DB.prepare(`SELECT id,destination_id AS destinationId,
      external_workspace_id AS workspaceId,status,created_at AS createdAt,updated_at AS updatedAt
    FROM clawmax_partner_enrollments WHERE participant_id=? ORDER BY created_at DESC`)
    .bind(auth.account!.participantId).all();
  return Response.json({ destinationId: configuredDestination(runtime), enrollments: enrollments.results });
}

export async function POST(request: Request) {
  const runtime = env as unknown as ClawMaxPartnerRuntime;
  const auth = await requireCurrentAccount(request, runtime.DB);
  if (auth.error) return auth.error;
  const accepted = await runtime.DB.prepare(`SELECT id FROM consent_records
    WHERE event_participant_id=? AND status='accepted' ORDER BY recorded_at DESC LIMIT 1`)
    .bind(auth.account!.participantId).first<{ id: string }>();
  if (!accepted) return Response.json({ error: "Accept the AgentForge privacy consent before connecting ClawMax." }, { status: 403 });
  const now = Date.now();
  const recentCodes = await runtime.DB.prepare(`SELECT COUNT(*) AS count FROM clawmax_enrollment_codes
    WHERE participant_id=? AND created_at>?`).bind(auth.account!.participantId, now - 60 * 60 * 1000).first<{ count: number }>();
  if (Number(recentCodes?.count || 0) >= 5) return Response.json({ error: "Connection-code limit reached. Try again later." }, { status: 429, headers: { "Retry-After": "3600" } });
  const code = randomConnectionCode();
  const codeHash = await sha256(code);
  const destinationId = configuredDestination(runtime);
  const launchUrl = automaticClawMaxLaunchUrl(runtime, code);
  if (!launchUrl) return Response.json({ error: "ClawMax launch is not configured for this event." }, { status: 503 });
  await runtime.DB.batch([
    runtime.DB.prepare(`UPDATE clawmax_enrollment_codes SET status='revoked'
      WHERE participant_id=? AND destination_id=? AND status='active'`).bind(auth.account!.participantId, destinationId),
    runtime.DB.prepare(`INSERT INTO clawmax_enrollment_codes
      (id,code_hash,event_id,participant_id,destination_id,status,expires_at,created_at)
      VALUES (?,?,?,?,?,'active',?,?)`).bind(
        crypto.randomUUID(), codeHash, auth.account!.eventId, auth.account!.participantId,
        destinationId, now + CLAWMAX_CONNECTION_CODE_TTL_MS, now,
      ),
  ]);
  return Response.json({
    launchUrl,
    destinationId,
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  const runtime = env as unknown as ClawMaxPartnerRuntime;
  const auth = await requireCurrentAccount(request, runtime.DB);
  if (auth.error) return auth.error;
  let input: { enrollmentId?: string };
  try { input = await request.json() as { enrollmentId?: string }; } catch { return Response.json({ error: "Request body must be valid JSON." }, { status: 400 }); }
  const enrollmentId = input.enrollmentId?.trim().slice(0, 200) || "";
  const enrollment = await runtime.DB.prepare("SELECT id FROM clawmax_partner_enrollments WHERE id=? AND participant_id=?")
    .bind(enrollmentId, auth.account!.participantId).first<{ id: string }>();
  if (!enrollment) return Response.json({ error: "ClawMax connection was not found." }, { status: 404 });
  const receipts = await runtime.DB.prepare("SELECT receipt_id AS receiptId FROM clawmax_consent_receipts WHERE enrollment_id=? AND status='active'")
    .bind(enrollmentId).all<{ receiptId: string }>();
  const now = Date.now();
  await runtime.DB.batch([
    runtime.DB.prepare("UPDATE clawmax_partner_enrollments SET status='revoked',revoked_at=?,updated_at=? WHERE id=?").bind(now, now, enrollmentId),
    runtime.DB.prepare("UPDATE clawmax_consent_receipts SET status='revoked',revoked_at=?,updated_at=? WHERE enrollment_id=? AND status='active'").bind(now, now, enrollmentId),
    ...receipts.results.map((receipt) => runtime.DB.prepare(`INSERT OR IGNORE INTO clawmax_purge_jobs
      (id,receipt_id,status,created_at) VALUES (?,?,'pending',?)`).bind(`purge:${receipt.receiptId}`, receipt.receiptId, now)),
  ]);
  const purges = [];
  for (const receipt of receipts.results) {
    try {
      purges.push(await processClawMaxPurge(runtime, receipt.receiptId));
    } catch (problem) {
      const message = problem instanceof Error ? problem.message : "Purge processing failed.";
      await runtime.DB.prepare("UPDATE clawmax_purge_jobs SET status='error',last_error=? WHERE receipt_id=?")
        .bind(message.slice(0, 1000), receipt.receiptId).run();
      purges.push({ receiptId: receipt.receiptId, status: "error", lastError: message });
    }
  }
  return Response.json({ enrollmentId, status: "revoked", purges }, { status: purges.every((purge) => purge?.status === "completed") ? 200 : 202 });
}
