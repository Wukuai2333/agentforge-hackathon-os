import { safeTokenMatch, sha256, type ClawMaxActivityEvent } from "./clawmax-ingestion.ts";

export type ClawMaxPartnerRuntime = {
  DB: D1Database;
  CLAWMAX_INGESTION_TOKEN?: string;
  CLAWMAX_DESTINATION_ID?: string;
  CLAWMAX_APP_URL?: string;
};

export const CLAWMAX_CONSENT_VERSION = "activity-export-consent/v1";
export const CLAWMAX_CONNECTION_CODE_TTL_MS = 10 * 60 * 1000;
export const CLAWMAX_SUPPORTED_SCOPES = new Set(["agent-chat", "workflow", "builder"]);

export function configuredDestination(runtime: ClawMaxPartnerRuntime) {
  return runtime.CLAWMAX_DESTINATION_ID?.trim() || "agentforge";
}

export function automaticClawMaxLaunchUrl(runtime: ClawMaxPartnerRuntime, enrollmentToken: string) {
  const configured = runtime.CLAWMAX_APP_URL?.trim() || "";
  if (!configured) return null;
  try {
    const url = new URL(configured);
    const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !localHttp) return null;
    url.hash = new URLSearchParams({ agentforge_enrollment: enrollmentToken }).toString();
    return url.toString();
  } catch {
    return null;
  }
}

export function bearerToken(request: Request) {
  return request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || "";
}

export async function partnerAuthorized(request: Request, runtime: ClawMaxPartnerRuntime) {
  const expected = runtime.CLAWMAX_INGESTION_TOKEN?.trim() || "";
  return Boolean(expected) && safeTokenMatch(bearerToken(request), expected);
}

export function randomConnectionCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export function normalizeScopes(input: unknown) {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map((scope) => String(scope).trim()).filter((scope) => CLAWMAX_SUPPORTED_SCOPES.has(scope)))].sort();
}

export type StoredClawMaxReceipt = {
  receiptId: string;
  enrollmentId: string;
  destinationId: string;
  workspaceId: string;
  userId: string;
  scopesJson: string;
  status: "active" | "revoked" | "expired";
  consentedAt: number;
  expiresAt: number | null;
  participantId: string;
  eventId: string;
};

export function authorizeEventWithReceipt(event: ClawMaxActivityEvent, receipt: StoredClawMaxReceipt | null, now = Date.now()) {
  if (!receipt) return { ok: false as const, error: "Unknown consent receipt." };
  if (receipt.status !== "active") return { ok: false as const, error: `Consent receipt is ${receipt.status}.` };
  if (receipt.destinationId !== event.destinationId) return { ok: false as const, error: "Consent receipt is bound to another destination." };
  if (receipt.workspaceId !== event.workspaceId || receipt.userId !== event.userId) return { ok: false as const, error: "Consent receipt identity does not match the event." };
  if (receipt.consentedAt > Date.parse(event.occurredAt)) return { ok: false as const, error: "Activity predates consent." };
  if (receipt.expiresAt && (receipt.expiresAt <= now || receipt.expiresAt <= Date.parse(event.occurredAt))) return { ok: false as const, error: "Consent receipt has expired." };
  let scopes: string[] = [];
  try { scopes = JSON.parse(receipt.scopesJson) as string[]; } catch { return { ok: false as const, error: "Consent receipt scopes are invalid." }; }
  if (!scopes.includes(event.source)) return { ok: false as const, error: `Consent does not include ${event.source}.` };
  return { ok: true as const, participantId: receipt.participantId, eventId: receipt.eventId, enrollmentId: receipt.enrollmentId };
}

export function splitAgentChat(content: string | undefined) {
  const value = content?.trim() || "";
  const match = value.match(/^User:\s*([\s\S]*?)\n\s*\nAssistant:\s*([\s\S]*)$/i);
  if (!match) return { prompt: value, response: "" };
  return { prompt: match[1].trim(), response: match[2].trim() };
}

export async function receiptPayloadHash(input: {
  receiptId: string;
  enrollmentId: string;
  destinationId: string;
  workspaceId: string;
  userId: string;
  scopes: string[];
  consentedAt: number;
  expiresAt: number | null;
}) {
  return sha256(JSON.stringify(input));
}
