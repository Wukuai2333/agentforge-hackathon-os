export type AssistantBudgetRuntime = { DB: D1Database };

type ReservationInput = {
  requestId: string;
  promptEventId: string;
  eventId: string;
  participantId: string;
  teamId: string | null;
  estimatedTokens: number;
  eventQuota: number;
  teamQuota: number;
  participantQuota: number;
  now: number;
};

export async function expireStaleReservations(runtime: AssistantBudgetRuntime, now = Date.now()) {
  return runtime.DB.prepare(`UPDATE assistant_token_reservations
    SET status='expired',error_code='reservation_expired',updated_at=?
    WHERE status IN ('reserved','processing') AND expires_at<?`).bind(now, now).run();
}

export async function reserveAssistantTokens(runtime: AssistantBudgetRuntime, input: ReservationInput) {
  const expiresAt = input.now + 5 * 60 * 1000;
  const result = await runtime.DB.prepare(`INSERT INTO assistant_token_reservations
    (request_id,prompt_event_id,event_id,participant_id,team_id,estimated_tokens,status,expires_at,created_at,updated_at)
    SELECT ?,?,?,?,?,?,'reserved',?,?,?
    WHERE COALESCE((SELECT used_tokens+reserved_tokens FROM assistant_token_usage WHERE scope_type='event' AND scope_id=?),0)+?<=?
      AND (? IS NULL OR COALESCE((SELECT used_tokens+reserved_tokens FROM assistant_token_usage WHERE scope_type='team' AND scope_id=?),0)+?<=?)
      AND COALESCE((SELECT used_tokens+reserved_tokens FROM assistant_token_usage WHERE scope_type='participant' AND scope_id=?),0)+?<=?
    ON CONFLICT(request_id) DO NOTHING`).bind(
      input.requestId, input.promptEventId, input.eventId, input.participantId, input.teamId, input.estimatedTokens,
      expiresAt, input.now, input.now,
      input.eventId, input.estimatedTokens, input.eventQuota,
      input.teamId, input.teamId, input.estimatedTokens, input.teamQuota,
      input.participantId, input.estimatedTokens, input.participantQuota,
    ).run();
  return result.meta.changes > 0;
}

export async function markReservationProcessing(runtime: AssistantBudgetRuntime, requestId: string, now = Date.now()) {
  await runtime.DB.prepare("UPDATE assistant_token_reservations SET status='processing',updated_at=? WHERE request_id=? AND status='reserved'")
    .bind(now, requestId).run();
}

export async function settleAssistantReservation(runtime: AssistantBudgetRuntime, requestId: string, actualTokens: number, now = Date.now()) {
  await runtime.DB.prepare(`UPDATE assistant_token_reservations SET status='completed',actual_tokens=?,updated_at=?
    WHERE request_id=? AND status IN ('reserved','processing')`).bind(Math.max(0, actualTokens), now, requestId).run();
}

export async function failAssistantReservation(runtime: AssistantBudgetRuntime, requestId: string, errorCode: string | null, now = Date.now()) {
  await runtime.DB.prepare(`UPDATE assistant_token_reservations SET status='failed',actual_tokens=0,error_code=?,updated_at=?
    WHERE request_id=? AND status IN ('reserved','processing')`).bind(errorCode?.slice(0, 100) || 'assistant_error', now, requestId).run();
}

export async function existingReservation(runtime: AssistantBudgetRuntime, requestId: string) {
  return runtime.DB.prepare(`SELECT r.status,r.prompt_event_id AS promptEventId,p.response_text AS responseText,p.model_name AS modelName,
    p.input_tokens AS inputTokens,p.output_tokens AS outputTokens
    FROM assistant_token_reservations r LEFT JOIN prompt_events p ON p.id=r.prompt_event_id
    WHERE r.request_id=?`).bind(requestId).first<{
      status: string; promptEventId: string; responseText: string | null; modelName: string | null; inputTokens: number | null; outputTokens: number | null;
    }>();
}
