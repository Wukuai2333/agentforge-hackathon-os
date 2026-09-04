# AgentForge x ClawMax Integration Test Status

**Observed ClawMax source:** `Maximilien-ai/clawmax` `main` at commit `39ebbb8c`, rebased into `codex/agentforge-activity-export`

**Observed:** September 4, 2026
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

The compact envelope is now the frozen initial compatibility baseline. The richer planning schema remains future design material and is not accepted by the v1 receiver.

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

The next integration layer is now implemented in the working tree: participants generate a ten-minute, single-use connection code; ClawMax exchanges it server-to-server; ClawMax registers a destination-specific consent receipt; and only events matching an active enrollment and receipt are normalized. Authorized `agent-chat` evidence becomes an AgentForge Prompt plus Cognee outbox item. Authorized Builder/workflow evidence becomes Progress plus an outbox item. Unknown, expired, revoked, identity-mismatched, pre-consent, or out-of-scope events are rejected before durable acceptance.

The public v59 transport test predates this strict authorization layer. A new Cloud end-to-end test must perform enrollment and consent registration before sending activity.

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

The follow-up ClawMax branch now adds `agentforge` to the Partner catalog, allowed-destination list, credential resolver, labels, enrollment flow, receipt lifecycle, durable delivery worker, durable purge retry, and focused tests. The public AgentForge environment must still be changed from `clawmax-ai` to `agentforge` before this branch can pass a public end-to-end run.

## September 4 local verification

- ClawMax dashboard typecheck passed.
- Partner definition, AgentForge adapter, generic Activity Export, worker edge, and UI source-contract tests passed.
- AgentForge production build and receiver contract tests passed after adding deletion status.
- AgentForge now purges receipt-linked D1 raw events, Prompt/Progress records, direct feedback/evaluation/coaching/model evidence, pending outbox records, and Assistant-derived Shared Space notes.
- A purge stays visibly incomplete when Cognee records were already synced; the implementation does not report a false success.

## Cloud test prerequisites

ClawMax Cloud cannot be tested only from the public repository. Dave or Max must provide:

- a Cloud test account or a test instance;
- the exact Cloud build/commit;
- permission to configure the Activity Export endpoint and secret, or an operator who will set them;
- confirmation whether the test uses the stock `clawmax-ai` transport slot or an AgentForge adapter build; and
- access to delivery status/log evidence without exposing raw content or the bearer token.

The same receiver URL and dedicated test token are used. No OpenAI or Cognee key is given to ClawMax for this transport.

## Production gates remaining after the first transport test

- named AgentForge adapter support inside ClawMax;
- Cloud execution of enrollment, consent registration, delivery, and revocation;
- execution of queued purge jobs across normalized AgentForge data and Cognee;
- final retention and privacy text;
- token rotation and instance allowlisting;
- final batch/event limits and retry policy;
- fine-grained raw-data reviewer access beyond the broad Organizer role; and
- a 300-participant synthetic load test.
