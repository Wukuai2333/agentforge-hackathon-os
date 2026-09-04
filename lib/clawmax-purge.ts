import type { ClawMaxPartnerRuntime } from "./clawmax-partner";

type PurgeJobRow = {
  id: string;
  receiptId: string;
  status: string;
  rawEventsPurged: number;
  normalizedRecordsPurged: number;
  cogneeRecordsPending: number;
  lastError: string | null;
  createdAt: number;
  completedAt: number | null;
};

const COGNEE_DELETE_REQUIRED = "Local evidence was purged, but one or more records were already sent to Cognee. Remote deletion remains pending until AgentForge stores a record-addressable Cognee deletion handle.";

export async function getClawMaxPurgeJob(runtime: ClawMaxPartnerRuntime, receiptId: string) {
  return runtime.DB.prepare(`SELECT id,receipt_id AS receiptId,status,
      raw_events_purged AS rawEventsPurged,normalized_records_purged AS normalizedRecordsPurged,
      cognee_records_pending AS cogneeRecordsPending,last_error AS lastError,
      created_at AS createdAt,completed_at AS completedAt
    FROM clawmax_purge_jobs WHERE receipt_id=? LIMIT 1`)
    .bind(receiptId).first<PurgeJobRow>();
}

export async function processClawMaxPurge(runtime: ClawMaxPartnerRuntime, receiptId: string) {
  const job = await getClawMaxPurgeJob(runtime, receiptId);
  if (!job) throw new Error("Purge job was not found.");
  if (job.status === "completed") return job;

  const counts = await runtime.DB.prepare(`SELECT
      COUNT(*) AS rawEvents,
      SUM(CASE WHEN event_id_internal IS NOT NULL THEN 1 ELSE 0 END) AS normalizedRecords
    FROM clawmax_ingestion_events WHERE consent_receipt_id=?`).bind(receiptId)
    .first<{ rawEvents: number; normalizedRecords: number }>();
  const remote = await runtime.DB.prepare(`SELECT COUNT(*) AS count FROM cognee_sync_outbox
    WHERE status IN ('synced','syncing') AND source_id IN (
      SELECT event_id_internal FROM clawmax_ingestion_events
      WHERE consent_receipt_id=? AND event_id_internal IS NOT NULL
    )`).bind(receiptId).first<{ count: number }>();
  const now = Date.now();
  const rawEvents = Number(counts?.rawEvents || 0);
  const normalizedRecords = Number(counts?.normalizedRecords || 0);
  const cogneePending = Number(remote?.count || 0);

  await runtime.DB.batch([
    runtime.DB.prepare("UPDATE clawmax_purge_jobs SET status='processing',last_error=NULL WHERE receipt_id=?").bind(receiptId),
    runtime.DB.prepare(`DELETE FROM learning_signal_evidence WHERE prompt_event_id IN (
      SELECT event_id_internal FROM clawmax_ingestion_events WHERE consent_receipt_id=? AND source='agent-chat'
    )`).bind(receiptId),
    runtime.DB.prepare(`DELETE FROM prompt_coaching_actions WHERE prompt_event_id IN (
      SELECT event_id_internal FROM clawmax_ingestion_events WHERE consent_receipt_id=? AND source='agent-chat'
    )`).bind(receiptId),
    runtime.DB.prepare(`DELETE FROM prompt_evaluations WHERE prompt_event_id IN (
      SELECT event_id_internal FROM clawmax_ingestion_events WHERE consent_receipt_id=? AND source='agent-chat'
    )`).bind(receiptId),
    runtime.DB.prepare(`DELETE FROM assistant_feedback_events WHERE prompt_event_id IN (
      SELECT event_id_internal FROM clawmax_ingestion_events WHERE consent_receipt_id=? AND source='agent-chat'
    )`).bind(receiptId),
    runtime.DB.prepare(`DELETE FROM participant_model_reviews WHERE entry_id IN (
      SELECT id FROM participant_model_entries WHERE source_id IN (
        SELECT event_id_internal FROM clawmax_ingestion_events WHERE consent_receipt_id=?
      )
    ) OR replacement_entry_id IN (
      SELECT id FROM participant_model_entries WHERE source_id IN (
        SELECT event_id_internal FROM clawmax_ingestion_events WHERE consent_receipt_id=?
      )
    )`).bind(receiptId, receiptId),
    runtime.DB.prepare(`DELETE FROM participant_model_entries WHERE source_id IN (
      SELECT event_id_internal FROM clawmax_ingestion_events WHERE consent_receipt_id=?
    )`).bind(receiptId),
    runtime.DB.prepare(`DELETE FROM shared_note_revisions WHERE note_id IN (
      SELECT id FROM shared_notes WHERE source_prompt_event_id IN (
        SELECT event_id_internal FROM clawmax_ingestion_events WHERE consent_receipt_id=? AND source='agent-chat'
      )
    )`).bind(receiptId),
    runtime.DB.prepare(`DELETE FROM shared_notes WHERE source_prompt_event_id IN (
      SELECT event_id_internal FROM clawmax_ingestion_events WHERE consent_receipt_id=? AND source='agent-chat'
    )`).bind(receiptId),
    runtime.DB.prepare(`DELETE FROM cognee_sync_outbox WHERE status IN ('pending','error') AND source_id IN (
      SELECT event_id_internal FROM clawmax_ingestion_events WHERE consent_receipt_id=?
    )`).bind(receiptId),
    runtime.DB.prepare(`UPDATE cognee_sync_outbox
      SET status='error',payload_json=?,last_error=?
      WHERE status IN ('synced','syncing') AND source_id IN (
        SELECT event_id_internal FROM clawmax_ingestion_events WHERE consent_receipt_id=?
      )`).bind(JSON.stringify({ deleted_locally: true, receipt_id: receiptId }), COGNEE_DELETE_REQUIRED, receiptId),
    runtime.DB.prepare(`DELETE FROM prompt_events WHERE id IN (
      SELECT event_id_internal FROM clawmax_ingestion_events WHERE consent_receipt_id=? AND source='agent-chat'
    )`).bind(receiptId),
    runtime.DB.prepare(`DELETE FROM event_progress_events WHERE id IN (
      SELECT event_id_internal FROM clawmax_ingestion_events WHERE consent_receipt_id=? AND source IN ('builder','workflow')
    )`).bind(receiptId),
    runtime.DB.prepare("DELETE FROM clawmax_ingestion_events WHERE consent_receipt_id=?").bind(receiptId),
    cogneePending > 0
      ? runtime.DB.prepare(`UPDATE clawmax_purge_jobs SET status='error',raw_events_purged=?,
          normalized_records_purged=?,cognee_records_pending=?,last_error=?,completed_at=NULL WHERE receipt_id=?`)
          .bind(rawEvents, normalizedRecords, cogneePending, COGNEE_DELETE_REQUIRED, receiptId)
      : runtime.DB.prepare(`UPDATE clawmax_purge_jobs SET status='completed',raw_events_purged=?,
          normalized_records_purged=?,cognee_records_pending=0,last_error=NULL,completed_at=? WHERE receipt_id=?`)
          .bind(rawEvents, normalizedRecords, now, receiptId),
  ]);

  return getClawMaxPurgeJob(runtime, receiptId);
}
