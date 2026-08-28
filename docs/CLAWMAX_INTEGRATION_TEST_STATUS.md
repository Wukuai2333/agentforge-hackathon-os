# AgentForge x ClawMax Integration Test Status

**Observed ClawMax source:** `Maximilien-ai/clawmax` `main` at commit `5d2a0b0aa683d5095623d48c3fd9b1b5a9b12bb6`  
**Observed:** August 27, 2026  
**ClawMax dashboard package version:** `2.0.0`  
**Wire schema advertised by ClawMax:** `clawmax.activity-export/v1`

## What is ready in ClawMax

Current `main` already implements the generic Activity Export host path:

- per-destination user consent and revoke;
- scope gating for agent chat, group/community chat, workflow, and Builder;
- first-pass secret and direct-identifier redaction;
- a durable local outbox;
- asynchronous delivery and manual flush;
- a background delivery worker;
- bearer authentication, schema and idempotency headers; and
- visible delivery status.

This means AgentForge should implement a receiver and a small AgentForge destination adapter. It should not add a second transcript hook inside ClawMax chat or workflow routes.

## Important implementation variance

The planning document contains a richer illustrative canonical event with nested `workspace`, `enrollment`, `actor`, `content`, `execution`, and `consent` objects. The code currently emitted by `main` uses a smaller envelope:

```json
{
  "eventId": "activity_...",
  "version": "clawmax.activity-export/v1",
  "destinationId": "agentforge",
  "consentReceiptId": "consent_...",
  "source": "agent-chat",
  "occurredAt": "2026-08-27T17:00:00.000Z",
  "workspaceId": "ws_opaque",
  "userId": "opaque-user",
  "sessionId": "optional",
  "subjectId": "optional",
  "content": "redacted visible text",
  "metadata": {}
}
```

AgentForge's first receiver intentionally accepts the implemented compact envelope. Before production, the parties must freeze whether the compact envelope or the richer planning schema is the compatibility baseline and publish a JSON Schema fixture.

The current ClawMax delivery function recreates `sentAt` on a retry while retaining the same `batchId`. AgentForge therefore computes batch idempotency from `batchId`, `destinationId`, and sanitized event content, excluding `sentAt`. This permits legitimate current retries while still rejecting a reused batch ID with changed events.

## AgentForge receiver behavior

The test receiver is:

```text
POST /api/clawmax/activity-events
GET  /api/clawmax/activity-events
```

Both calls require the dedicated server-to-server bearer token. The receiver:

1. authenticates the dedicated ingestion credential;
2. binds it to one configured destination;
3. verifies the schema and idempotency headers;
4. validates batch/event bounds and supported sources;
5. applies a second redaction pass;
6. rejects batch/event ID reuse with changed content;
7. stores sanitized evidence in a D1 quarantine; and
8. returns accepted and duplicate event IDs.

Quarantined events do **not** automatically become native AgentForge prompts or Cognee memory. That requires an explicit ClawMax-to-AgentForge participant enrollment mapping and an active AgentForge consent record.

## Local SDK/source test

The stock ClawMax source currently hard-codes `clawmax-ai` and `digo` as allowed destinations. There are two test levels:

### Transport compatibility, no ClawMax source change

Point the stock `clawmax-ai` reference destination at the AgentForge receiver. AgentForge temporarily binds its test credential to `clawmax-ai`. The ClawMax UI will still say “ClawMax.ai”; this proves consent, capture, redaction, outbox, delivery, authentication, and retry transport only.

```env
CLAWMAX_ACTIVITY_EXPORT_ENDPOINT=https://agentforge-hackathon-os.yr2110.chatgpt.site/api/clawmax/activity-events
CLAWMAX_ACTIVITY_EXPORT_TOKEN=<dedicated AgentForge test token>
CLAWMAX_ACTIVITY_EXPORT_INTERVAL_MS=1000
```

### Named AgentForge destination

Add `agentforge` to the ClawMax partner catalog, allowed-destination list, credential resolver, labels, and tests. Then bind the AgentForge receiver to destination `agentforge`. This is the correct user-facing end-to-end test and the patch that should become a ClawMax PR.

## Cloud test prerequisites

ClawMax Cloud cannot be tested only from the public repository. Dave or Max must provide:

- a Cloud test account or a test instance;
- the exact Cloud build/commit;
- permission to configure the Activity Export endpoint and secret, or an operator who will set them;
- confirmation whether the test uses the stock `clawmax-ai` transport slot or an AgentForge adapter build; and
- access to delivery status/log evidence without exposing raw content or the bearer token.

The same receiver URL and dedicated test token are used. No OpenAI or Cognee key is given to ClawMax for this transport.

## Production gates not covered by the first transport test

- participant enrollment/identity mapping;
- registration of complete consent receipt details with AgentForge;
- purge propagation into normalized AgentForge data and Cognee;
- final retention and privacy text;
- token rotation and instance allowlisting;
- final batch/event limits and retry policy;
- Organizer reviewer access; and
- a 300-participant synthetic load test.
