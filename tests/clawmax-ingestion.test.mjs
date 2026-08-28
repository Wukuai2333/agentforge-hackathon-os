import assert from "node:assert/strict";
import test from "node:test";
import {
  CLAWMAX_ACTIVITY_SCHEMA,
  safeTokenMatch,
  sanitizeClawMaxText,
  validateClawMaxBatch,
} from "../lib/clawmax-ingestion.ts";

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
