import { env } from "cloudflare:workers";
import {
  CLAWMAX_CONSENT_VERSION,
  configuredDestination,
  normalizeScopes,
  partnerAuthorized,
  receiptPayloadHash,
  type ClawMaxPartnerRuntime,
} from "../../../../lib/clawmax-partner";
import { getClawMaxPurgeJob, processClawMaxPurge } from "../../../../lib/clawmax-purge";

type ConsentInput = {
  receiptId?: string;
  enrollmentId?: string;
  destinationId?: string;
  workspaceId?: string;
  userId?: string;
  scopes?: unknown;
  consentVersion?: string;
  consentedAt?: string;
  expiresAt?: string | null;
};

async function inputFrom(request: Request) {
  try { return await request.json() as ConsentInput; } catch { return null; }
}

async function authorize(request: Request, runtime: ClawMaxPartnerRuntime) {
  if (!runtime.CLAWMAX_INGESTION_TOKEN) return Response.json({ error: "ClawMax partner access is not configured." }, { status: 503 });
  if (!await partnerAuthorized(request, runtime)) return Response.json({ error: "Invalid partner credential." }, { status: 401 });
  return null;
}

export async function GET(request: Request) {
  const runtime = env as unknown as ClawMaxPartnerRuntime;
  const authError = await authorize(request, runtime);
  if (authError) return authError;
  const receiptId = new URL(request.url).searchParams.get("receiptId")?.trim().slice(0, 200) || "";
  if (!receiptId) return Response.json({ error: "receiptId is required." }, { status: 400 });
  const receipt = await runtime.DB.prepare(`SELECT receipt_id AS receiptId,status,scopes_json AS scopesJson,
      consented_at AS consentedAt,expires_at AS expiresAt,revoked_at AS revokedAt
    FROM clawmax_consent_receipts WHERE receipt_id=?`).bind(receiptId).first<{
      receiptId: string; status: string; scopesJson: string; consentedAt: number; expiresAt: number | null; revokedAt: number | null;
    }>();
  if (!receipt) return Response.json({ error: "Consent receipt was not found." }, { status: 404 });
  const purge = await getClawMaxPurgeJob(runtime, receiptId);
  return Response.json({
    receiptId: receipt.receiptId,
    status: receipt.status,
    scopes: JSON.parse(receipt.scopesJson),
    consentedAt: receipt.consentedAt,
    expiresAt: receipt.expiresAt,
    revokedAt: receipt.revokedAt,
    purge,
  });
}

export async function POST(request: Request) {
  const runtime = env as unknown as ClawMaxPartnerRuntime;
  const authError = await authorize(request, runtime);
  if (authError) return authError;
  const input = await inputFrom(request);
  if (!input) return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  const receiptId = input.receiptId?.trim().slice(0, 200) || "";
  const enrollmentId = input.enrollmentId?.trim().slice(0, 200) || "";
  const destinationId = input.destinationId?.trim() || "";
  const workspaceId = input.workspaceId?.trim().slice(0, 200) || "";
  const userId = input.userId?.trim().slice(0, 200) || "";
  const scopes = normalizeScopes(input.scopes);
  const requestedScopes = Array.isArray(input.scopes) ? [...new Set(input.scopes.map((scope) => String(scope).trim()).filter(Boolean))] : [];
  const consentVersion = input.consentVersion?.trim().slice(0, 100) || CLAWMAX_CONSENT_VERSION;
  const consentedAt = Date.parse(input.consentedAt || "");
  const expiresAt = input.expiresAt ? Date.parse(input.expiresAt) : null;
  if (!receiptId || !enrollmentId || !workspaceId || !userId || !Number.isFinite(consentedAt)) {
    return Response.json({ error: "receiptId, enrollmentId, workspaceId, userId, and a valid consentedAt are required." }, { status: 400 });
  }
  if (request.headers.get("idempotency-key")?.trim() !== receiptId) return Response.json({ error: "Idempotency-Key must match receiptId." }, { status: 400 });
  if (destinationId !== configuredDestination(runtime)) return Response.json({ error: "This credential is not authorized for that destination." }, { status: 403 });
  if (consentVersion !== CLAWMAX_CONSENT_VERSION) return Response.json({ error: "Unsupported consent version." }, { status: 400 });
  const unsupportedScopes = requestedScopes.filter((scope) => !scopes.includes(scope));
  if (unsupportedScopes.length) return Response.json({ error: `Unsupported initial-launch scope: ${unsupportedScopes.join(", ")}.` }, { status: 400 });
  if (!scopes.length) return Response.json({ error: "At least one supported scope is required. Group/community export is disabled for the initial launch." }, { status: 400 });
  if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= consentedAt)) return Response.json({ error: "expiresAt must be later than consentedAt." }, { status: 400 });
  const enrollment = await runtime.DB.prepare(`SELECT id FROM clawmax_partner_enrollments
    WHERE id=? AND destination_id=? AND external_workspace_id=? AND external_user_id=? AND status='active' LIMIT 1`)
    .bind(enrollmentId, destinationId, workspaceId, userId).first<{ id: string }>();
  if (!enrollment) return Response.json({ error: "Active enrollment was not found for this ClawMax identity." }, { status: 403 });
  const payloadHash = await receiptPayloadHash({ receiptId, enrollmentId, destinationId, workspaceId, userId, scopes, consentedAt, expiresAt });
  const existing = await runtime.DB.prepare("SELECT payload_hash AS payloadHash,status FROM clawmax_consent_receipts WHERE receipt_id=?")
    .bind(receiptId).first<{ payloadHash: string; status: string }>();
  if (existing) {
    if (existing.payloadHash !== payloadHash) return Response.json({ error: "Idempotency conflict: receiptId was already used for different consent content." }, { status: 409 });
    return Response.json({ receiptId, status: existing.status, duplicate: true });
  }
  const now = Date.now();
  await runtime.DB.prepare(`INSERT INTO clawmax_consent_receipts
    (receipt_id,enrollment_id,destination_id,external_workspace_id,external_user_id,scopes_json,status,consent_version,consented_at,expires_at,payload_hash,created_at,updated_at)
    VALUES (?,?,?,?,?,?,'active',?,?,?,?,?,?)`).bind(
      receiptId, enrollmentId, destinationId, workspaceId, userId, JSON.stringify(scopes), consentVersion,
      consentedAt, expiresAt, payloadHash, now, now,
    ).run();
  return Response.json({ receiptId, status: "active", scopes }, { status: 201 });
}

export async function DELETE(request: Request) {
  const runtime = env as unknown as ClawMaxPartnerRuntime;
  const authError = await authorize(request, runtime);
  if (authError) return authError;
  const input = await inputFrom(request);
  const receiptId = input?.receiptId?.trim().slice(0, 200) || "";
  if (!receiptId) return Response.json({ error: "receiptId is required." }, { status: 400 });
  if (request.headers.get("idempotency-key")?.trim() !== `${receiptId}:revoke`) {
    return Response.json({ error: "Idempotency-Key must equal receiptId:revoke." }, { status: 400 });
  }
  const now = Date.now();
  const existing = await runtime.DB.prepare("SELECT status FROM clawmax_consent_receipts WHERE receipt_id=?")
    .bind(receiptId).first<{ status: string }>();
  if (!existing) return Response.json({ error: "Consent receipt was not found." }, { status: 404 });
  await runtime.DB.batch([
    runtime.DB.prepare("UPDATE clawmax_consent_receipts SET status='revoked',revoked_at=COALESCE(revoked_at,?),updated_at=? WHERE receipt_id=?").bind(now, now, receiptId),
    runtime.DB.prepare(`INSERT OR IGNORE INTO clawmax_purge_jobs
      (id,receipt_id,status,created_at) VALUES (?,?,'pending',?)`).bind(`purge:${receiptId}`, receiptId, now),
  ]);
  try {
    const purge = await processClawMaxPurge(runtime, receiptId);
    return Response.json({ receiptId, status: "revoked", purge }, { status: purge?.status === "completed" ? 200 : 202 });
  } catch (problem) {
    const message = problem instanceof Error ? problem.message : "Purge processing failed.";
    await runtime.DB.prepare("UPDATE clawmax_purge_jobs SET status='error',last_error=? WHERE receipt_id=?")
      .bind(message.slice(0, 1000), receiptId).run();
    return Response.json({ receiptId, status: "revoked", purge: { status: "error", error: message } }, { status: 202 });
  }
}
