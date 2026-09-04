import assert from "node:assert/strict";
import test from "node:test";
import {
  CLAWMAX_ACTIVITY_SCHEMA,
  safeTokenMatch,
  sanitizeClawMaxText,
  validateClawMaxBatch,
} from "../lib/clawmax-ingestion.ts";
import {
  automaticClawMaxLaunchUrl,
  authorizeEventWithReceipt,
  normalizeScopes,
  splitAgentChat,
} from "../lib/clawmax-partner.ts";

test("creates an automatic ClawMax handoff without exposing a code in the page", () => {
  const launchUrl = automaticClawMaxLaunchUrl({ DB: {}, CLAWMAX_APP_URL: "https://clawmax.example/builder" }, "TOKEN123");
  assert.equal(launchUrl, "https://clawmax.example/builder#agentforge_enrollment=TOKEN123");
  assert.equal(automaticClawMaxLaunchUrl({ DB: {}, CLAWMAX_APP_URL: "http://unsafe.example/builder" }, "TOKEN123"), null);
});

function batch(overrides = {}) {
  return {
    batchId: "batch_test_001",
    destinationId: "agentforge",
    sentAt: "2026-08-27T17:00:00.000Z",
    events: [{
      eventId: "evt_test_001",
      version: CLAWMAX_ACTIVITY_SCHEMA,
      destinationId: "agentforge",
      consentReceiptId: "consent_test_001",
      source: "agent-chat",
      occurredAt: "2026-08-27T16:59:59.000Z",
      workspaceId: "ws_opaque",
      userId: "user_opaque",
      content: "Help me design a personal research agent.",
    }],
    ...overrides,
  };
}

test("accepts the compact envelope emitted by current ClawMax main", () => {
  const result = validateClawMaxBatch(batch(), "agentforge");
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.batch.events[0].source, "agent-chat");
});

test("binds a credential to one destination", () => {
  const result = validateClawMaxBatch(batch({ destinationId: "another-partner" }), "agentforge");
  assert.deepEqual(result, { ok: false, error: "This credential is not authorized for that destination." });
});

test("rejects unsupported scopes before durable storage", () => {
  const value = batch();
  value.events[0].source = "tool-internals";
  const result = validateClawMaxBatch(value, "agentforge");
  assert.equal(result.ok, false);
  assert.match(result.error, /Unsupported event source/);
});

test("redacts common secrets and direct identifiers a second time", () => {
  const sanitized = sanitizeClawMaxText("email me at person@example.com; api_key=sk-testsecret123456789");
  assert.equal(sanitized?.includes("person@example.com"), false);
  assert.equal(sanitized?.includes("sk-testsecret123456789"), false);
  assert.match(sanitized || "", /\[REDACTED\]/);
});

test("compares scoped ingestion tokens without a plain-text early exit", async () => {
  assert.equal(await safeTokenMatch("partner-token", "partner-token"), true);
  assert.equal(await safeTokenMatch("partner-token", "different-token"), false);
});

test("authorizes only events covered by a matching active consent receipt", () => {
  const event = batch().events[0];
  const receipt = {
    receiptId: event.consentReceiptId,
    enrollmentId: "enrollment_test",
    destinationId: event.destinationId,
    workspaceId: event.workspaceId,
    userId: event.userId,
    scopesJson: JSON.stringify(["agent-chat"]),
    status: "active",
    consentedAt: Date.parse("2026-08-27T16:00:00.000Z"),
    expiresAt: Date.parse("2026-08-28T16:00:00.000Z"),
    participantId: "participant_test",
    eventId: "hackathon_test",
  };
  assert.equal(authorizeEventWithReceipt(event, receipt, Date.parse("2026-08-27T17:00:00.000Z")).ok, true);
  assert.match(authorizeEventWithReceipt({ ...event, source: "workflow" }, receipt, Date.parse("2026-08-27T17:00:00.000Z")).error, /does not include workflow/);
  assert.match(authorizeEventWithReceipt(event, { ...receipt, status: "revoked" }, Date.parse("2026-08-27T17:00:00.000Z")).error, /revoked/);
});

test("keeps group activity disabled and normalizes current supported scopes", () => {
  assert.deepEqual(normalizeScopes(["builder", "agent-chat", "group-chat", "agent-chat"]), ["agent-chat", "builder"]);
});

test("splits the current ClawMax visible chat transcript into Prompt and response", () => {
  assert.deepEqual(splitAgentChat("User:\nHow do I test recall?\n\nAssistant:\nCreate a retrieval case."), {
    prompt: "How do I test recall?",
    response: "Create a retrieval case.",
  });
});
