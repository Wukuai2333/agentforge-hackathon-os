import { env } from "cloudflare:workers";
import {
  CLAWMAX_ACTIVITY_SCHEMA,
  CLAWMAX_MAX_REQUEST_BYTES,
  sha256,
  validateClawMaxBatch,
  type ClawMaxActivityEvent,
} from "../../../../lib/clawmax-ingestion";
import {
  authorizeEventWithReceipt,
  configuredDestination,
  partnerAuthorized,
  splitAgentChat,
  type ClawMaxPartnerRuntime,
  type StoredClawMaxReceipt,
} from "../../../../lib/clawmax-partner";

type Runtime = ClawMaxPartnerRuntime;

function jsonError(error: string, status: number) {
  return Response.json({ error }, { status });
}

function eventCanonical(event: ClawMaxActivityEvent) {
  return JSON.stringify(event);
}

export async function GET(request: Request) {
  const runtime = env as unknown as Runtime;
  if (!runtime.CLAWMAX_INGESTION_TOKEN) return jsonError("ClawMax ingestion is not configured.", 503);
  if (!await partnerAuthorized(request, runtime)) return jsonError("Invalid ingestion credential.", 401);
  const destinationId = configuredDestination(runtime);
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
  if (!await partnerAuthorized(request, runtime)) return jsonError("Invalid ingestion credential.", 401);
  const headerVersion = request.headers.get("x-clawmax-schema-version")?.trim();
  if (headerVersion !== CLAWMAX_ACTIVITY_SCHEMA) return jsonError("Unsupported X-ClawMax-Schema-Version.", 400);
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > CLAWMAX_MAX_REQUEST_BYTES) return jsonError("Batch exceeds the request size limit.", 413);
  let parsed: unknown;
  try { parsed = JSON.parse(rawBody); } catch { return jsonError("Request body must be valid JSON.", 400); }
  const destinationId = configuredDestination(runtime);
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
  const receiptIds = [...new Set(batch.events.map((event) => event.consentReceiptId))];
  const receiptPlaceholders = receiptIds.map(() => "?").join(",");
  const receiptRows = await runtime.DB.prepare(`SELECT r.receipt_id AS receiptId,r.enrollment_id AS enrollmentId,
      r.destination_id AS destinationId,r.external_workspace_id AS workspaceId,r.external_user_id AS userId,
      r.scopes_json AS scopesJson,r.status,r.consented_at AS consentedAt,r.expires_at AS expiresAt,
      e.participant_id AS participantId,e.event_id AS eventId
    FROM clawmax_consent_receipts r JOIN clawmax_partner_enrollments e ON e.id=r.enrollment_id
    WHERE r.receipt_id IN (${receiptPlaceholders}) AND e.status='active'`)
    .bind(...receiptIds).all<StoredClawMaxReceipt>();
  const receipts = new Map(receiptRows.results.map((row) => [String(row.receiptId), row]));
  const authorization = batch.events.map((event) => ({ event, result: authorizeEventWithReceipt(event, receipts.get(event.consentReceiptId) || null) }));
  const unauthorized = authorization.find((item) => !item.result.ok);
  if (unauthorized && !unauthorized.result.ok) {
    return jsonError(`Event ${unauthorized.event.eventId} is not authorized: ${unauthorized.result.error}`, 403);
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
  const normalized = await Promise.all(accepted.map(async ({ event, eventHash }) => {
    const receipt = receipts.get(event.consentReceiptId)!;
    const occurredAt = Date.parse(event.occurredAt);
    const membership = await runtime.DB.prepare(`SELECT team_id AS teamId FROM team_memberships
      WHERE participant_id=? AND joined_at<=? AND (ended_at IS NULL OR ended_at>?)
      ORDER BY joined_at DESC LIMIT 1`).bind(receipt.participantId, occurredAt, occurredAt).first<{ teamId: string }>();
    const internalId = `clawmax:${event.eventId}`;
    const metadata = event.metadata || {};
    if (event.source === "agent-chat") {
      const chat = splitAgentChat(event.content);
      if (!chat.prompt) return { event, eventHash, receipt, teamId: membership?.teamId || null, internalId: null, statements: [], error: "ClawMax agent-chat event did not contain a user prompt." };
      const memoryPayload = JSON.stringify({
        schema_version: "agentforge.learning-event.v2", event_id: internalId, hackathon_event_id: receipt.eventId,
        event_type: "external_agent_prompt", source_platform: "clawmax", source_event_id: event.eventId,
        participant_id: receipt.participantId, team_id: membership?.teamId || null,
        page: "ClawMax", tutorial_step: typeof metadata.tutorialStep === "string" ? metadata.tutorialStep : null,
        question: chat.prompt, assistant_response: chat.response, agent_id: metadata.agentId || event.subjectId || null,
        model: metadata.model || null, occurred_at: event.occurredAt, evidence_type: "observed_fact",
      });
      return { event, eventHash, receipt, teamId: membership?.teamId || null, internalId, error: null, statements: [
        runtime.DB.prepare(`INSERT OR IGNORE INTO prompt_events
          (id,conversation_id,anonymous_participant_id,anonymous_team_id,page,tutorial_step,task_reference,user_prompt,system_prompt_version,
           context_type,context_reference,agent_name,model_name,response_text,status,created_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'success',?)`).bind(
            internalId, event.sessionId || internalId, receipt.participantId, membership?.teamId || null, "ClawMax",
            typeof metadata.tutorialStep === "string" ? metadata.tutorialStep.slice(0, 150) : null,
            event.subjectId || "ClawMax agent activity", chat.prompt, "clawmax-external-v1", "external_activity",
            event.eventId, String(metadata.agentId || event.subjectId || "ClawMax Agent").slice(0, 200),
            metadata.model ? String(metadata.model).slice(0, 200) : null, chat.response || null, occurredAt,
          ),
        runtime.DB.prepare(`INSERT OR IGNORE INTO cognee_sync_outbox
          (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at)
          VALUES (?,'prompt_event',?,'agentforge_learning_signals',?,'pending',0,?)`)
          .bind(crypto.randomUUID(), internalId, memoryPayload, receivedAt),
      ] };
    }
    const milestone = event.source === "builder" ? "ClawMax builder activity" : "ClawMax workflow activity";
    return { event, eventHash, receipt, teamId: membership?.teamId || null, internalId, error: null, statements: [
      runtime.DB.prepare(`INSERT OR IGNORE INTO event_progress_events
        (id,event_participant_id,team_id,milestone,status,source,occurred_at)
        VALUES (?,?,?,?,?,'clawmax',?)`).bind(
          internalId, receipt.participantId, membership?.teamId || null, milestone,
          metadata.status === "completed" ? "completed" : "started", occurredAt,
        ),
      runtime.DB.prepare(`INSERT OR IGNORE INTO cognee_sync_outbox
        (id,source_type,source_id,dataset_name,payload_json,status,attempts,created_at)
        VALUES (?,'progress_event',?,'agentforge_learning_signals',?,'pending',0,?)`).bind(
          crypto.randomUUID(), internalId, JSON.stringify({ schema_version: "agentforge.learning-event.v2", event_type: "external_progress",
            source_platform: "clawmax", source_event_id: event.eventId, participant_id: receipt.participantId,
            team_id: membership?.teamId || null, source: event.source, milestone, metadata, occurred_at: event.occurredAt,
            evidence_type: "observed_fact" }), receivedAt,
        ),
    ] };
  }));
  await runtime.DB.batch([
    runtime.DB.prepare(`INSERT INTO clawmax_ingestion_batches
      (id,destination_id,batch_id,request_hash,schema_version,sent_at,received_at,status,event_count,accepted_count,duplicate_count)
      VALUES (?,?,?,?,?,?,?,'accepted',?,?,?)`)
      .bind(batchRowId, batch.destinationId, batch.batchId, requestHash, CLAWMAX_ACTIVITY_SCHEMA, batch.sentAt || null, receivedAt, batch.events.length, accepted.length, duplicateEventIds.length),
    ...normalized.map(({ event, eventHash, receipt, teamId, internalId, error }) => runtime.DB.prepare(`INSERT INTO clawmax_ingestion_events
      (id,destination_id,event_id,batch_id,event_hash,schema_version,source,occurred_at,external_workspace_id,external_user_id,session_id,subject_id,consent_receipt_id,content_text,metadata_json,sanitized_event_json,normalization_status,received_at,event_id_internal,participant_id,team_id,normalization_error,normalized_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(`${batch.destinationId}:${event.eventId}`, batch.destinationId, event.eventId, batch.batchId, eventHash, CLAWMAX_ACTIVITY_SCHEMA,
        event.source, event.occurredAt, event.workspaceId, event.userId, event.sessionId || null, event.subjectId || null,
        event.consentReceiptId, event.content || null, event.metadata ? JSON.stringify(event.metadata) : null, eventCanonical(event),
        error ? "rejected" : "normalized", receivedAt, internalId, receipt.participantId, teamId, error, error ? null : receivedAt)),
    ...normalized.flatMap((item) => item.statements),
  ]);
  return Response.json({
    batchId: batch.batchId,
    acceptedEventIds: accepted.map((row) => row.event.eventId),
    duplicateEventIds,
    rejected: [],
  }, { status: 202 });
}
