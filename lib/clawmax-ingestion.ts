export const CLAWMAX_ACTIVITY_SCHEMA = "clawmax.activity-export/v1";
export const CLAWMAX_MAX_BATCH_EVENTS = 50;
export const CLAWMAX_MAX_REQUEST_BYTES = 1024 * 1024;
export const CLAWMAX_MAX_EVENT_BYTES = 256 * 1024;

const ALLOWED_SOURCES = new Set(["agent-chat", "group-chat", "community-chat", "workflow", "builder"]);

export type ClawMaxActivityEvent = {
  eventId: string;
  version: string;
  destinationId: string;
  consentReceiptId: string;
  source: string;
  occurredAt: string;
  workspaceId: string;
  userId: string;
  sessionId?: string;
  subjectId?: string;
  content?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type ClawMaxBatch = {
  batchId: string;
  destinationId: string;
  sentAt?: string;
  events: ClawMaxActivityEvent[];
};

const SECRET_PATTERNS = [
  /\b(?:bearer\s+)?[a-z0-9_-]*(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret)\s*[:=]\s*[^\s,;]+/gi,
  /\b(?:sk|ghp|gho|github_pat|xai|AIza)[a-z0-9_-]{8,}\b/gi,
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/gi,
  /\b(?:authorization|proxy-authorization)\s*:\s*[^\s,;]+/gi,
];

const DIRECT_PII_PATTERNS = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /(?<!\w)\+?\d[\d .()/-]{7,}\d(?!\w)/g,
];

export function sanitizeClawMaxText(value: string | undefined) {
  if (typeof value !== "string") return value;
  let sanitized = value;
  for (const pattern of SECRET_PATTERNS) sanitized = sanitized.replace(pattern, "[REDACTED]");
  for (const pattern of DIRECT_PII_PATTERNS) sanitized = sanitized.replace(pattern, "[REDACTED]");
  return sanitized.slice(0, 12000);
}

function bounded(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function sanitizeClawMaxEvent(value: unknown): ClawMaxActivityEvent | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const metadataInput = input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
    ? input.metadata as Record<string, unknown>
    : undefined;
  const metadata = metadataInput ? Object.fromEntries(Object.entries(metadataInput).slice(0, 50).map(([key, item]) => {
    if (typeof item === "string") return [key.slice(0, 100), sanitizeClawMaxText(item)?.slice(0, 1000) || ""];
    if (typeof item === "number" || typeof item === "boolean" || item === null) return [key.slice(0, 100), item];
    return [key.slice(0, 100), "[OMITTED]"];
  })) as Record<string, string | number | boolean | null> : undefined;
  return {
    eventId: bounded(input.eventId),
    version: bounded(input.version, 100),
    destinationId: bounded(input.destinationId, 100),
    consentReceiptId: bounded(input.consentReceiptId),
    source: bounded(input.source, 100),
    occurredAt: bounded(input.occurredAt, 100),
    workspaceId: bounded(input.workspaceId),
    userId: bounded(input.userId),
    sessionId: bounded(input.sessionId) || undefined,
    subjectId: bounded(input.subjectId) || undefined,
    content: sanitizeClawMaxText(typeof input.content === "string" ? input.content : undefined),
    metadata,
  };
}

export function validateClawMaxBatch(batch: unknown, expectedDestination: string): { ok: true; batch: ClawMaxBatch } | { ok: false; error: string } {
  if (!batch || typeof batch !== "object" || Array.isArray(batch)) return { ok: false, error: "A JSON batch object is required." };
  const input = batch as Record<string, unknown>;
  const batchId = bounded(input.batchId);
  const destinationId = bounded(input.destinationId, 100);
  const sentAt = bounded(input.sentAt, 100) || undefined;
  if (!batchId) return { ok: false, error: "batchId is required." };
  if (destinationId !== expectedDestination) return { ok: false, error: "This credential is not authorized for that destination." };
  if (sentAt && Number.isNaN(Date.parse(sentAt))) return { ok: false, error: "sentAt must be an RFC 3339 timestamp." };
  if (!Array.isArray(input.events) || input.events.length === 0) return { ok: false, error: "At least one event is required." };
  if (input.events.length > CLAWMAX_MAX_BATCH_EVENTS) return { ok: false, error: `A batch cannot contain more than ${CLAWMAX_MAX_BATCH_EVENTS} events.` };
  const ids = new Set<string>();
  const events: ClawMaxActivityEvent[] = [];
  for (const value of input.events) {
    const event = sanitizeClawMaxEvent(value);
    if (!event) return { ok: false, error: "Every event must be an object." };
    if (JSON.stringify(event).length > CLAWMAX_MAX_EVENT_BYTES) return { ok: false, error: `Event ${event.eventId || "unknown"} exceeds the size limit.` };
    if (!event.eventId || !event.consentReceiptId || !event.workspaceId || !event.userId) return { ok: false, error: "Every event requires eventId, consentReceiptId, workspaceId, and userId." };
    if (event.version !== CLAWMAX_ACTIVITY_SCHEMA) return { ok: false, error: `Unsupported event schema: ${event.version || "missing"}.` };
    if (event.destinationId !== destinationId) return { ok: false, error: `Event ${event.eventId} has a different destination.` };
    if (!ALLOWED_SOURCES.has(event.source)) return { ok: false, error: `Unsupported event source: ${event.source || "missing"}.` };
    if (Number.isNaN(Date.parse(event.occurredAt))) return { ok: false, error: `Event ${event.eventId} has an invalid occurredAt timestamp.` };
    if (ids.has(event.eventId)) return { ok: false, error: `Duplicate eventId inside batch: ${event.eventId}.` };
    ids.add(event.eventId);
    events.push(event);
  }
  return { ok: true, batch: { batchId, destinationId, sentAt, events } };
}

export async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, "0")).join("");
}

export async function safeTokenMatch(supplied: string, expected: string) {
  if (!supplied || !expected) return false;
  const [left, right] = await Promise.all([sha256(supplied), sha256(expected)]);
  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}
