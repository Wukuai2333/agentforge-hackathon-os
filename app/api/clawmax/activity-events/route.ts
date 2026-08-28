import { env } from "cloudflare:workers";
import {
  CLAWMAX_ACTIVITY_SCHEMA,
  CLAWMAX_MAX_REQUEST_BYTES,
  safeTokenMatch,
  sha256,
  validateClawMaxBatch,
  type ClawMaxActivityEvent,
} from "../../../../lib/clawmax-ingestion";

type Runtime = {
  DB: D1Database;
  CLAWMAX_INGESTION_TOKEN?: string;
  CLAWMAX_DESTINATION_ID?: string;
};

function bearer(request: Request) {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
}

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function eventCanonical(event: ClawMaxActivityEvent) {
  return JSON.stringify(event);
}

export async function GET(request: Request) {
  const runtime = env as unknown as Runtime;
  if (!runtime.CLAWMAX_INGESTION_TOKEN) return jsonError("ClawMax ingestion is not configured.", 503);
  if (!await safeTokenMatch(bearer(request), runtime.CLAWMAX_INGESTION_TOKEN)) return jsonError("Invalid ingestion credential.", 401);
  const destinationId = runtime.CLAWMAX_DESTINATION_ID?.trim() || "agentforge";
  const [batches, events] = await runtime.DB.batch([
    runtime.DB.prepare("SELECT COUNT(*) AS count,MAX(received_at) AS lastReceivedAt FROM clawmax_ingestion_batches WHERE destination_id=?").bind(destinationId),
    runtime.DB.prepare("SELECT COUNT(*) AS count FROM clawmax_ingestion_events WHERE destination_id=?").bind(destinationId),
  ]);
  const batchSummary = batches.results?.[0] as { count?: number; lastReceivedAt?: number | null } | undefined;
  const eventSummary = events.results?.[0] as { count?: number } | undefined;
  return Response.json({
    ok: true,
    destinationId,
    schemaVersion: CLAWMAX_ACTIVITY_SCHEMA,
    batchesReceived: Number(batchSummary?.count || 0),
    eventsReceived: Number(eventSummary?.count || 0),
    lastReceivedAt: batchSummary?.lastReceivedAt || null,
  });
}

export async function POST(request: Request) {
  const runtime = env as unknown as Runtime;
  const expectedToken = runtime.CLAWMAX_INGESTION_TOKEN?.trim() || "";
  if (!expectedToken) return jsonError("ClawMax ingestion is not configured.", 503);
  if (!await safeTokenMatch(bearer(request), expectedToken)) return jsonError("Invalid ingestion credential.", 401);
  const headerVersion = request.headers.get("x-clawmax-schema-version")?.trim();
  if (headerVersion !== CLAWMAX_ACTIVITY_SCHEMA) return jsonError("Unsupported X-ClawMax-Schema-Version.", 400);
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > CLAWMAX_MAX_REQUEST_BYTES) return jsonError("Batch exceeds the request size limit.", 413);
  let parsed: unknown;
  try { parsed = JSON.parse(rawBody); } catch { return jsonError("Request body must be valid JSON.", 400); }
  const destinationId = runtime.CLAWMAX_DESTINATION_ID?.trim() || "agentforge";
  const validation = validateClawMaxBatch(parsed, destinationId);
  if (!validation.ok) return jsonError(validation.error, 400);
  const batch = validation.batch;
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey !== batch.batchId) return jsonError("Idempotency-Key must match batchId.", 400);
  const canonicalRequest = JSON.stringify({ batchId: batch.batchId, destinationId: batch.destinationId, events: batch.events });
  const requestHash = await sha256(canonicalRequest);
  const batchRowId = `${batch.destinationId}:${batch.batchId}`;
  const existingBatch = await runtime.DB.prepare("SELECT request_hash AS requestHash FROM clawmax_ingestion_batches WHERE id=?")
    .bind(batchRowId).first<{ requestHash: string }>();
  if (existingBatch) {
    if (existingBatch.requestHash !== requestHash) return jsonError("Idempotency conflict: batchId was already used for different event content.", 409);
    return Response.json({ batchId: batch.batchId, acceptedEventIds: [], duplicateEventIds: batch.events.map((event) => event.eventId), rejected: [] }, { status: 202 });
  }
  const placeholders = batch.events.map(() => "?").join(",");
  const existingEvents = await runtime.DB.prepare(`SELECT event_id AS eventId,event_hash AS eventHash FROM clawmax_ingestion_events WHERE destination_id=? AND event_id IN (${placeholders})`)
    .bind(batch.destinationId, ...batch.events.map((event) => event.eventId)).all<{ eventId: string; eventHash: string }>();
  const known = new Map(existingEvents.results.map((row) => [String(row.eventId), String(row.eventHash)]));
  const eventRows = await Promise.all(batch.events.map(async (event) => ({ event, eventHash: await sha256(eventCanonical(event)) })));
  for (const row of eventRows) {
    if (known.has(row.event.eventId) && known.get(row.event.eventId) !== row.eventHash) {
      return jsonError(`Idempotency conflict: eventId ${row.event.eventId} was already used for different content.`, 409);
    }
  }
  const accepted = eventRows.filter((row) => !known.has(row.event.eventId));
  const duplicateEventIds = eventRows.filter((row) => known.has(row.event.eventId)).map((row) => row.event.eventId);
  const receivedAt = Date.now();
  await runtime.DB.batch([
    runtime.DB.prepare(`INSERT INTO clawmax_ingestion_batches
      (id,destination_id,batch_id,request_hash,schema_version,sent_at,received_at,status,event_count,accepted_count,duplicate_count)
      VALUES (?,?,?,?,?,?,?,'accepted',?,?,?)`)
      .bind(batchRowId, batch.destinationId, batch.batchId, requestHash, CLAWMAX_ACTIVITY_SCHEMA, batch.sentAt || null, receivedAt, batch.events.length, accepted.length, duplicateEventIds.length),
    ...accepted.map(({ event, eventHash }) => runtime.DB.prepare(`INSERT INTO clawmax_ingestion_events
      (id,destination_id,event_id,batch_id,event_hash,schema_version,source,occurred_at,external_workspace_id,external_user_id,session_id,subject_id,consent_receipt_id,content_text,metadata_json,sanitized_event_json,normalization_status,received_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'quarantined',?)`)
      .bind(`${batch.destinationId}:${event.eventId}`, batch.destinationId, event.eventId, batch.batchId, eventHash, CLAWMAX_ACTIVITY_SCHEMA,
        event.source, event.occurredAt, event.workspaceId, event.userId, event.sessionId || null, event.subjectId || null,
        event.consentReceiptId, event.content || null, event.metadata ? JSON.stringify(event.metadata) : null, eventCanonical(event), receivedAt)),
  ]);
  return Response.json({
    batchId: batch.batchId,
    acceptedEventIds: accepted.map((row) => row.event.eventId),
    duplicateEventIds,
    rejected: [],
  }, { status: 202 });
}
