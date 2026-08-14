# AgentForge x ClawMax Activity Export Partner Contract

**Contract version:** `2.0.0`  
**Canonical activity schema:** `clawmax.activity-export/v1`  
**Destination ID:** `agentforge`  
**Status:** AgentForge implementation baseline  
**Date:** August 14, 2026

This document defines the technical and operational contract for exporting explicitly consented participant activity from ClawMax to AgentForge. It is based on ClawMax's `PUBLIC_ACTIVITY_EXPORT_PARTNERS_2_0.md` platform contract and keeps ClawMax's canonical field names and wire format intact.

This is an interoperability contract, not a substitute for a privacy policy, data processing agreement, institutional review, or research consent. Those documents must be approved before production use.

## 1. Contract goals

The integration lets a participant choose to share selected ClawMax activity with AgentForge so AgentForge can:

- show the participant and their team evidence of build progress;
- identify where participants struggle with sponsor tools or tutorials;
- support evidence-linked prompt coaching;
- improve event tutorials and support materials;
- queue sanitized semantic evidence for Cognee; and
- support organizer analysis without treating AI-generated interpretations as measured facts.

The integration must be simple for participants, must not slow ClawMax agent execution, and must never export activity merely because an operator configured AgentForge as a destination.

## 2. Normative language

`MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` are normative requirements.

- **ClawMax** is the source platform that captures eligible visible activity after local persistence, enforces consent and scope, performs first-pass redaction, and asynchronously delivers batches.
- **AgentForge** is the named partner destination that authenticates, validates, stores, normalizes, audits, analyzes, and deletes delivered activity according to this contract.
- **Participant** is the authenticated person whose activity may be shared.
- **Organizer** is an authorized AgentForge event administrator. Organizer access never substitutes for participant consent.

## 3. Fixed contract decisions

| Item | Decision |
|---|---|
| Partner destination | `agentforge` |
| Display name | `AgentForge` |
| Platform contract release | ClawMax `2.0.0` |
| Event payload schema | `clawmax.activity-export/v1` |
| Transport | Server-to-server HTTPS JSON |
| Authentication | Dedicated scoped bearer ingestion token |
| Delivery | Asynchronous, batched, at least once |
| Deduplication | Stable `batchId` and globally unique `eventId` |
| Participant identity | Partner-scoped pseudonymous ID by default |
| Name/email | Excluded unless separately disclosed and consented |
| Consent | Explicit, destination-specific, versioned, not preselected |
| Historical backfill | Prohibited for activity created before consent |
| Secret handling | ClawMax redacts before export; AgentForge sanitizes again |
| Raw system of record | AgentForge D1 raw-ingestion quarantine |
| Semantic memory | Cognee, reached only through AgentForge's controlled outbox |
| AI inference | Must remain distinguishable from raw facts and measured counts |

The ClawMax release is `2.0.0`, but the canonical event payload remains `clawmax.activity-export/v1`. AgentForge MUST NOT rename it to `/v2` or invent incompatible field names.

## 4. End-to-end flow

```text
Operator configures AgentForge destination and server credential
                              |
Participant sees AgentForge, purpose, scopes, identity, retention, and privacy link
                              |
Participant explicitly opts in and ClawMax creates a consent receipt
                              |
ClawMax persists normal visible activity first
                              |
Consent gate -> scope gate -> redaction -> durable ClawMax outbox
                              |
Asynchronous batch delivery with stable batchId/eventId
                              |
AgentForge authentication -> validation -> idempotent raw ingestion
                              |
202 acknowledgement with accepted, duplicate, and rejected event IDs
                              |
AgentForge normalization and evidence linkage in D1
                    /                         \
      Participant/team progress          Cognee sync outbox
                    |                         |
          rule-based measured facts       semantic retrieval/inference
                    \                         /
                Organizer review and participant transparency
```

Remote delivery MUST NOT run in the ClawMax chat, Builder, group, or workflow request path.

## 5. Partner metadata supplied to ClawMax

AgentForge will provide the following values to the ClawMax integration owner. Production secrets MUST be exchanged through a secure secret channel, never committed to either repository or pasted into participant-facing UI.

| Field | AgentForge value |
|---|---|
| `destinationId` | `agentforge` |
| Display name | `AgentForge` |
| Purpose | `Hackathon learning support, progress evidence, prompt coaching, and improvement of event tutorials.` |
| Supported schema | `clawmax.activity-export/v1` |
| Batch endpoint | `https://<agentforge-production-host>/v1/clawmax/activity-events:batch` |
| Purge endpoint | `https://<agentforge-production-host>/v1/clawmax/activity-events:purge` |
| Enrollment exchange | `https://<agentforge-production-host>/v1/clawmax/enrollments:exchange` |
| Health verification | `https://<agentforge-production-host>/v1/clawmax/activity-events:health` |
| Authentication | Dedicated bearer token scoped to `activity:write` and `activity:purge` |
| Privacy URL | `https://<agentforge-production-host>/privacy` |
| Supported initial scopes | See Section 7 |
| Default identity | Partner-scoped pseudonymous participant ID |
| Reviewer access | Authenticated AgentForge users with `organizer` role for the linked event |
| Credential owner | AgentForge event platform operator |
| Retention | Event-specific disclosure; launch default in Section 18 |

The current `chatgpt.site` URL is a prototype host and MUST NOT be treated as the final production ingestion origin. A stable production hostname will replace the placeholder without changing the path or payload contract.

## 6. Destination configuration and participant consent are separate

ClawMax MUST implement two independent gates:

1. **Destination configured:** an operator has configured the AgentForge endpoint and server-managed credential.
2. **Participant consented:** the authenticated participant accepted the AgentForge disclosure for a named event, time window, and set of scopes.

Configuring AgentForge MUST NOT begin capture. The user-facing action SHOULD read `Share activity with AgentForge`, followed by a consent review. The checkbox or confirmation control MUST NOT be preselected.

While consent is active, ClawMax SHOULD show its standard persistent state indicator:

- `Sharing with AgentForge`
- `AgentForge sharing delayed`
- `AgentForge sharing needs attention`

Stopping sharing MUST immediately block new export events and purge unsent events for the receipt. ClawMax MUST then call the AgentForge purge endpoint for data already delivered.

## 7. Supported scopes

AgentForge supports the canonical ClawMax scopes below. Each must remain independently selectable.

| Scope | AgentForge use | Launch default |
|---|---|---|
| `conversation.direct` | Participant prompts and visible agent replies used for support and prompt coaching | Offered |
| `conversation.group` | Participant turns and visible replies used for team-level learning signals | Off unless the event needs group chat |
| `workflow.instructions` | Participant run instructions used as task and progress evidence | Offered |
| `workflow.outputs` | Visible workflow outcomes and status used for progress and outcome evaluation | Offered |
| `builder.conversation` | Builder questions and visible replies used to understand agent-design friction | Separate opt-in |

The following are outside this contract and MUST NOT be exported:

- system prompts, hidden prompts, chain-of-thought, or model internals;
- agent-to-agent messages the participant did not submit or see;
- tool arguments, tool results, authorization data, or environment variables;
- API keys, passwords, cookies, bearer tokens, private keys, or connection strings;
- attachment binaries, uploaded file contents, workspace files, and local paths;
- browser history, keystrokes, unrelated navigation, or device monitoring;
- another user's private activity; and
- activity created before the applicable consent receipt.

## 8. Consent receipt

Every event MUST reference a valid, unexpired AgentForge consent receipt. ClawMax owns creation and local enforcement of the receipt; AgentForge validates its reference and stores a minimized copy for audit.

```json
{
  "receiptId": "consent_01J...",
  "version": "activity-export-consent/v1",
  "userId": "opaque-clawmax-user-id",
  "workspaceId": "opaque-clawmax-workspace-id",
  "destination": { "id": "agentforge", "displayName": "AgentForge" },
  "enrollment": {
    "eventId": "agentforge-event-2026-09",
    "scriptId": "personal-agent-hackathon",
    "participantId": "afp_opaque_partner_scoped_id"
  },
  "purpose": "Hackathon learning support, progress evidence, prompt coaching, and improvement of event tutorials.",
  "scopes": ["conversation.direct", "workflow.instructions", "workflow.outputs"],
  "consentedAt": "2026-09-26T12:00:00.000Z",
  "expiresAt": "2026-09-27T03:00:00.000Z",
  "privacyUrl": "https://<agentforge-production-host>/privacy"
}
```

Before consent, the participant MUST be told the receiver, event, purpose, content categories, identity mode, capture window, retention, deletion behavior, and how to stop sharing.

## 9. Participant and event mapping

Email MUST NOT be the canonical integration identifier.

- AgentForge creates or assigns a stable, opaque, partner-scoped `participantId` for one participant enrollment.
- ClawMax includes that ID under `enrollment.participantId`.
- `enrollment.eventId` maps to one AgentForge event.
- `enrollment.scriptId` optionally identifies a tutorial, exercise, or event script.
- AgentForge maps the opaque participant ID to its internal `user_id`, `registration_id`, and current `team_id` in D1.
- The same opaque participant ID MUST NOT be reused for another destination.
- Name or email MUST NOT be sent unless the consent disclosure explicitly lists that field.

If the participant changes teams, AgentForge keeps the event identity stable and resolves team membership at the activity timestamp. ClawMax does not need AgentForge's internal team ID.

### 9.1 Enrollment exchange

An authenticated AgentForge participant requests a short-lived, single-use connection code in AgentForge. The participant enters that code in ClawMax's AgentForge enrollment UI. ClawMax exchanges it server-to-server:

```http
POST /v1/clawmax/enrollments:exchange
Authorization: Bearer <server-managed-ingestion-token>
Content-Type: application/json
```

```json
{
  "destinationId": "agentforge",
  "connectionCode": "AF-7K3M-P9Q2",
  "workspaceId": "workspace_opaque",
  "instanceId": "instance_opaque"
}
```

```json
{
  "destinationId": "agentforge",
  "eventId": "agentforge-event-2026-09",
  "scriptId": "personal-agent-hackathon",
  "participantId": "afp_opaque_partner_scoped_id",
  "expiresAt": "2026-09-27T03:00:00.000Z"
}
```

The connection code expires after 10 minutes, is consumed atomically on first successful exchange, is rate-limited, and MUST NOT appear in logs. The response contains no email, password, session, or internal AgentForge user ID. Exchanging a code prepares enrollment but does not create consent or begin capture.

## 10. Canonical event payload

ClawMax sends one visible turn or workflow lifecycle item per ordered event:

```json
{
  "schemaVersion": "clawmax.activity-export/v1",
  "eventId": "evt_01J...",
  "eventType": "conversation.turn",
  "occurredAt": "2026-09-26T14:03:12.442Z",
  "recordedAt": "2026-09-26T14:03:12.451Z",
  "sequence": 12,
  "source": "agent-chat",
  "workspace": {
    "id": "workspace_opaque",
    "instanceId": "instance_opaque",
    "deploymentKind": "cloud"
  },
  "enrollment": {
    "partner": "agentforge",
    "eventId": "agentforge-event-2026-09",
    "scriptId": "personal-agent-hackathon",
    "participantId": "afp_opaque_partner_scoped_id"
  },
  "conversation": {
    "id": "conversation_opaque",
    "turnId": "turn_opaque",
    "parentTurnId": null
  },
  "actor": {
    "type": "user",
    "pseudonymousId": "actor_partner_scoped",
    "agentId": null
  },
  "content": {
    "format": "text/markdown",
    "text": "Help me design a memory test for my research agent.",
    "sha256": "content-hash",
    "truncated": false,
    "redactions": []
  },
  "execution": {
    "status": "completed",
    "model": null,
    "provider": null,
    "inputTokens": null,
    "outputTokens": null,
    "durationMs": null
  },
  "consent": {
    "receiptId": "consent_01J...",
    "version": "activity-export-consent/v1"
  }
}
```

Required source values are `agent-chat`, `group-chat`, `community-chat`, `workflow`, and `builder`. Supported event types are `conversation.turn`, `workflow.started`, `workflow.completed`, and `workflow.failed`.

Every identifier is opaque. Nullable execution metadata remains `null`; ClawMax MUST NOT invent model, token, duration, or status values. AgentForge preserves unknown additive fields in raw storage but rejects unsupported source or event-type values per event.

## 11. Batch ingestion endpoint

```http
POST /v1/clawmax/activity-events:batch
Authorization: Bearer <server-managed-ingestion-token>
Content-Type: application/json
Idempotency-Key: batch_01J...
X-ClawMax-Schema-Version: clawmax.activity-export/v1
```

```json
{
  "batchId": "batch_01J...",
  "destinationId": "agentforge",
  "sentAt": "2026-09-26T14:03:20.000Z",
  "events": []
}
```

Request rules:

- `Idempotency-Key` MUST equal `batchId`.
- `destinationId` MUST equal `agentforge`.
- A batch contains only AgentForge events using the named schema.
- Batches preserve sequence within each conversation.
- Initial maximum: 50 events or 256 KiB serialized JSON, whichever comes first.
- Initial maximum event body: 64 KiB serialized JSON.
- A retry reuses the same `batchId`, `eventId`, and content.

AgentForge returns `202 Accepted` only after authentication, validation, deduplication, and durable raw storage. It does not wait for normalization, Cognee, or AI analysis.

```json
{
  "batchId": "batch_01J...",
  "acceptedEventIds": ["evt_01J..."],
  "duplicateEventIds": ["evt_01H..."],
  "rejected": [
    {
      "eventId": "evt_01K...",
      "code": "unsupported_scope",
      "message": "The consent receipt does not include builder.conversation"
    }
  ]
}
```

Duplicates are successful acknowledgements and MUST NOT create another raw or normalized record. Valid events may be accepted while invalid events in the same batch are permanently rejected with a stable code and sanitized message.

## 12. Authentication and credential handling

AgentForge issues ClawMax a dedicated high-entropy ingestion token. It is not an OpenAI key, Cognee key, organizer code, user session, or participant API key.

It MUST be server-managed, stored only as a secret or one-way verifier, scoped to one environment and allowed enrollment, never sent to browsers or agents, never logged, separately issued for sandbox and production, immediately revocable, and transmitted only over HTTPS.

Least-privilege scopes are `activity:write`, `activity:purge`, `enrollment:exchange`, and optionally `activity:verify`. AgentForge SHOULD accept two token identifiers during planned rotation. Logs may contain a non-secret key ID, never the token.

ClawMax configuration follows its platform convention:

```text
CLAWMAX_ACTIVITY_EXPORT_ENDPOINT=<AgentForge batch endpoint>
CLAWMAX_ACTIVITY_EXPORT_TOKEN=<AgentForge-issued secret>
```

Missing or invalid credentials return `401`. Valid credentials without the required scope or enrollment return `403`.

## 13. Idempotency, response behavior, and retry

Delivery is at least once. AgentForge provides effectively-once ingestion by enforcing uniqueness on `(destination_id, batch_id)` and `(destination_id, event_id)`.

| HTTP status | ClawMax action |
|---|---|
| `200` / `202` | Acknowledge accepted and duplicate IDs; retry only transient rejections |
| `400` | Do not retry an unchanged malformed request |
| `401` / `403` | Pause destination and show `needs attention` |
| `409` | Treat a recognized idempotency conflict as accepted |
| `413` | Split the batch and retry within limits |
| `429` | Honor `Retry-After` |
| `5xx` / timeout | Exponential backoff with jitter |

Suggested transient schedule is 5 seconds, 15 seconds, 45 seconds, 2 minutes, 5 minutes, then bounded exponential backoff with jitter. ClawMax's undelivered queue initially MUST NOT retain content longer than 24 hours.

Stable rejection codes include `invalid_batch`, `invalid_event`, `unsupported_schema`, `invalid_destination`, `unsupported_source`, `unsupported_event_type`, `unsupported_scope`, `unknown_enrollment`, `expired_consent`, `revoked_consent`, `content_too_large`, `rate_limited`, and `temporarily_unavailable`. Error messages MUST NOT echo raw content or credentials.

## 14. Purge endpoint

```http
POST /v1/clawmax/activity-events:purge
Authorization: Bearer <server-managed-ingestion-token>
Content-Type: application/json
X-ClawMax-Schema-Version: clawmax.activity-export/v1
Idempotency-Key: purge_01J...
```

```json
{
  "purgeId": "purge_01J...",
  "destinationId": "agentforge",
  "workspaceId": "workspace_opaque",
  "receiptId": "consent_01J...",
  "requestedAt": "2026-09-26T18:03:20.000Z"
}
```

AgentForge returns `202` with `{ "purgeId": "purge_01J...", "status": "accepted" }`. Purge is idempotent and moves through `accepted`, `processing`, `completed`, or `failed`.

ClawMax or an authorized operator may inspect a purge without receiving deleted content:

```http
GET /v1/clawmax/activity-events:purge/purge_01J...
Authorization: Bearer <server-managed-ingestion-token>
```

```json
{
  "purgeId": "purge_01J...",
  "status": "completed",
  "completedAt": "2026-09-26T18:04:11.000Z",
  "affectedRecords": 17
}
```

A completed purge removes or irreversibly anonymizes ClawMax raw content, normalized prompts/responses/progress/feedback, pending Cognee outbox records, Cognee memory and derived inferences linked only to the receipt, and user-facing copies derived only from that content. AgentForge may retain a content-free audit tombstone with the purge ID, timestamps, basis, counts, and status.

**Implementation gate:** purge propagation is required for production but is not implemented in the current AgentForge prototype. ClawMax export MUST remain disabled in production until the endpoint and Cognee deletion path pass conformance testing.

## 15. AgentForge D1 ingestion model

AgentForge stores the canonical payload unchanged in a quarantine layer before deriving product records. Raw payloads are untrusted data, never executable instructions.

Required D1 entities:

| Entity | Purpose |
|---|---|
| `partner_destinations` | Partner metadata and enabled state |
| `partner_credentials` | Non-secret key metadata and verifier |
| `partner_enrollments` | Opaque ClawMax-to-AgentForge event/user mapping |
| `partner_consent_receipts` | Minimized receipt, scopes, expiry, revoke state |
| `partner_ingestion_batches` | Batch audit and acknowledgement |
| `partner_raw_events` | Canonical raw event quarantine |
| `partner_event_normalizations` | Raw-to-domain processing state |
| `partner_purge_requests` | Idempotent purge state machine |
| `cognee_sync_outbox` | Existing controlled semantic-memory queue |

Raw event state:

```text
accepted -> pending_normalization -> normalized
                               \-> normalization_failed -> retry/dead_letter

accepted/normalized -> purge_pending -> purged
```

Canonical mapping:

| ClawMax field | AgentForge use |
|---|---|
| `eventId` | External evidence ID and idempotency key |
| `occurredAt`, `recordedAt` | Learning-event and capture time |
| `sequence` | Conversation/workflow ordering |
| `source` | Tool/page/tutorial attribution input |
| `enrollment.eventId` | AgentForge event registration |
| `enrollment.scriptId` | Tutorial, exercise, or build-step context |
| `enrollment.participantId` | Internal user lookup through mapping table |
| conversation fields | Turn grouping and iteration chain |
| `actor.type` | Prompt versus assistant response classification |
| `content` | Sanitized raw evidence and completeness metadata |
| `execution` | Outcome and observed usage evidence |
| `consent.receiptId` | Authorization and purge linkage |

Normalization may create prompt/response records, iteration links, progress evidence, errors/blockers, tutorial-step questions, coaching candidates, and sanitized Cognee memory events. Every derived record MUST preserve provenance to raw `eventId` and receipt.

## 16. Facts, rules, Cognee, and AI inference

AgentForge separates four layers:

1. **Raw evidence:** the consented export after redaction.
2. **Normalized facts:** deterministic source, timestamp, actor, status, token, and tutorial mappings.
3. **Rule-based measurements:** counts, failure streaks, inactivity windows, completion rates, and limits calculated from D1.
4. **AI/Cognee inference:** semantic clusters, likely causes, coaching suggestions, and tutorial-improvement proposals.

Cognee MUST NOT invent counts. `38 participants asked about cognify in 42 minutes` is a D1 calculation. `The questions appear to reflect uncertainty about completion status` may be a Cognee interpretation linked to those events. `Add a status-verification checkpoint` is an AI suggestion requiring organizer review.

Every inference MUST include evidence references, generation time, model/rubric version, confidence where supported, and review status. Participant-model facts, observations, AI inferences, and participant confirmations remain visibly separate.

## 17. Retention and data use

Before production, organizers MUST publish an explicit retention window. The proposed AgentForge launch default is:

- raw activity and normalized hackathon evidence: event end plus 30 days;
- content-free operational delivery logs: 90 days;
- ClawMax undelivered outbox content: no more than 24 hours; and
- valid purge completion: within 7 calendar days, with immediate access restriction.

These defaults require policy approval and may be shortened. Extending hackathon data into a longitudinal student model requires new, specific consent; hackathon consent is not sufficient.

AgentForge MUST NOT use delivered activity for unrelated model training, advertising, employee surveillance, or participant grading without separate authorization and disclosure.

## 18. Defense-in-depth redaction

ClawMax gates scope and redacts before its durable outbox. AgentForge sanitizes again before normalization, display, logging, or Cognee delivery.

Both sides MUST redact authorization values, common API-key patterns, private keys, password fields, cookies, and connection strings; omit tool internals, environment details, local paths, attachments, and files; bound content size; avoid routine raw-body logging; fail closed for export when redaction fails; and let normal ClawMax activity continue when export fails.

AgentForge MUST NOT interpolate untrusted event text into system instructions, SQL, HTML, logs, or shell commands without appropriate parameterization and escaping.

## 19. Rate limits and backpressure

Partner ingestion limits are separate from participant login and Ask AI limits.

- 60 batch requests per minute per ingestion credential;
- 50 events per batch;
- 256 KiB per batch;
- 64 KiB per event; and
- 10 concurrent batch requests per credential.

AgentForge returns `429` with `Retry-After` when temporarily exhausted. If AgentForge is unavailable, ClawMax shows delayed state and retains bounded data. If its queue is full, ClawMax stops accepting new AgentForge export events, records loss, and shows `needs attention`; it MUST NOT claim healthy sharing.

## 20. Health verification

ClawMax may verify configuration without participant activity:

```http
GET /v1/clawmax/activity-events:health
Authorization: Bearer <server-managed-ingestion-token>
```

```json
{
  "destinationId": "agentforge",
  "status": "ready",
  "contractVersion": "2.0.0",
  "schemaVersions": ["clawmax.activity-export/v1"],
  "maxBatchEvents": 50,
  "maxBatchBytes": 262144,
  "maxEventBytes": 65536,
  "purgeSupported": true
}
```

The endpoint exposes no secrets, participants, queues, database details, or provider configuration.

## 21. Audit and observability

AgentForge records request/batch IDs, destination, non-secret credential ID, times, latency, status, byte size, schema, redaction count, accepted/duplicate/rejected/normalized/dead-letter/purged counts, normalization status, Cognee outbox status, and purge status. Routine logs do not contain raw content.

Raw content access requires an authorized event organizer, an audit entry, and the approved retention window.

## 22. Versioning and compatibility

- This agreement uses semantic versioning.
- ClawMax's wire schema remains `clawmax.activity-export/v1`.
- Additive optional fields are backward compatible and preserved in raw storage.
- New required fields, changed meanings, or removed fields require a new schema and parallel compatibility window.
- Unsupported major schemas are rejected rather than guessed.
- A consent receipt can never be silently repointed to another destination.

## 23. Receiver conformance suite

Before production, both sides test valid batches; duplicate batch/event; stable retry; malformed batch/event; unsupported schema/source/type/scope; unknown enrollment; expired/revoked consent; partial rejection; `401`, `403`, `413`, `429`, `5xx`, and timeout; batch splitting/restart; secret redaction sentinels; purge across D1 and Cognee; cross-user isolation; no pre-consent capture; no backfill; and cloud deployment at hackathon load.

## 24. Hackathon acceptance criteria

1. AgentForge appears as a named ClawMax destination with the correct purpose and privacy link.
2. Declining consent sends nothing.
3. Selected scopes send only eligible activity.
4. ClawMax sharing status is accurate.
5. AgentForge authenticates and idempotently acknowledges batches.
6. Raw records link to event, participant mapping, receipt, and source event.
7. Normalized prompts and progress attach to the correct participant/team.
8. Cognee receives only sanitized, explicitly queued events.
9. Organizer counts come from D1 facts; AI interpretations show evidence.
10. Revocation stops capture and starts delivered-data purge.
11. No credential appears in content or logs.
12. A 300-participant synthetic load test does not block ClawMax or duplicate AgentForge evidence.

## 25. Implementation ownership

### AgentForge owns

- ingestion, health, and purge endpoints;
- partner credentials and enrollment mapping;
- D1 raw ingestion, receipt linkage, idempotency, normalization, and audit;
- second-pass redaction and Cognee routing;
- organizer authorization, retention, and deletion propagation;
- receiver conformance fixtures and load tests; and
- privacy, retention, incident, and reviewer-access documentation.

### ClawMax owns

- AgentForge catalog metadata and consent copy;
- server-side endpoint and credential configuration;
- configuration separate from individual consent;
- consent, scope gate, status UI, expiry, and stop sharing;
- canonical capture after normal persistence;
- first-pass redaction, outbox, batch delivery, retry, and dead letter;
- acknowledgement and purge handling; and
- cloud/on-prem ClawMax conformance tests.

### Shared responsibilities

- freeze launch hostnames, privacy URL, retention, IDs, and contacts;
- run common fixtures and security/privacy review;
- rehearse consent, outage, retry, revoke, and purge; and
- maintain a versioned change log.

## 26. Current AgentForge implementation status

| Capability | Current state | Launch requirement |
|---|---|---|
| Users, sessions, participant/organizer roles | Implemented in D1 | Security/load verification |
| Event registration, consent, team, project | Implemented for native flow | Add ClawMax enrollment mapping |
| Ask AI prompt/response tracking | Implemented | Preserve ClawMax provenance |
| Prompt coaching and learning signals | Prototype | Use normalized evidence and reviewed inference |
| Cognee sync outbox | Implemented | Add source/event/receipt linkage |
| ClawMax batch receiver | Not implemented | Required |
| Partner credential management | Not implemented | Required |
| Raw-ingestion quarantine | Not implemented | Required |
| ClawMax receipt mapping | Not implemented | Required |
| Purge and Cognee deletion propagation | Not implemented | Required before production |
| Receiver conformance fixtures | Not implemented | Required |
| 300-participant load test | Not run | Required |

## 27. Implementation order

1. Add D1 migrations for destinations, credentials, connection codes, enrollments, receipts, batches, raw events, normalization state, and purge requests.
2. Implement token issuance/verification, one-time enrollment exchange, and health verification.
3. Implement batch limits, schema validation, enrollment/receipt checks, idempotency, and `202` acknowledgement.
4. Implement asynchronous normalization and provenance links into existing Prompt, Progress, Feedback, and Cognee outbox records.
5. Implement purge and deletion propagation through D1 and Cognee.
6. Add organizer delivery-health, rejection, dead-letter, and purge views.
7. Publish fixtures and run conformance tests.
8. Give Max the sandbox endpoint, token, metadata, privacy copy, and test report.
9. Add the AgentForge catalog/adapter PR to ClawMax without production secrets.
10. Test 50, 100, and 300 synthetic participants, then rotate to a production token.

## 28. Launch configuration record

| Value | Owner | Launch value |
|---|---|---|
| Production hostname | AgentForge | `TBD` |
| Sandbox hostname | AgentForge | `TBD` |
| Privacy URL | AgentForge | `TBD` |
| Privacy/data-processing approval | Shared | `TBD` |
| Event/script ID format | Shared | `TBD` |
| Production credential key ID | AgentForge | Secret value never recorded here |
| ClawMax operator contact | ClawMax | `TBD` |
| AgentForge incident contact | AgentForge | `TBD` |
| Approved retention | Shared | Proposed event + 30 days |
| Reviewer authorization owner | AgentForge | `TBD` |
| Data residency | AgentForge | `TBD` |
| Breach notification process | Shared | `TBD` |

These are operational values, not reasons to fork the canonical schema.

## 29. Partner handoff checklist

AgentForge sends Max:

- [ ] this contract and version;
- [ ] destination ID, display name, logo, purpose, scopes, and privacy URL;
- [ ] sandbox batch, purge, and health URLs;
- [ ] sandbox credential through a secure channel;
- [ ] credential rotation and revocation process;
- [ ] batch/event size and rate limits;
- [ ] retention, deletion, reviewer, and incident terms;
- [ ] request/acknowledgement/purge examples;
- [ ] conformance results; and
- [ ] technical contact.

ClawMax sends AgentForge:

- [ ] proposed catalog entry and consent copy;
- [ ] supported ClawMax `2.0.0` build/commit;
- [ ] direct-chat, workflow, and Builder fixtures;
- [ ] enrollment mapping procedure;
- [ ] redaction sentinel results;
- [ ] retry, indicator, revoke, and purge results;
- [ ] cloud/on-prem configuration procedure; and
- [ ] technical contact.

## 30. Explicit non-goals

- Surveillance without participant consent.
- Exporting all activity because AgentForge is configured.
- A generic conversation-read capability.
- Hidden reasoning, system prompts, internal agent traffic, tools, files, or browsing.
- Blocking ClawMax while AgentForge processes data.
- Using hackathon consent for a longitudinal student model.
- Treating prompt-coaching scores as grades.
- Treating Cognee summaries as measured counts.
- Shipping production tokens in GitHub, browsers, agents, or participant settings.

## 31. Upstream source

This agreement follows `Maximilien-ai/clawmax/SYSTEM/docs/planning/PUBLIC_ACTIVITY_EXPORT_PARTNERS_2_0.md`, last updated August 12, 2026.

If this document conflicts with the upstream canonical event or transport format, AgentForge adapts internally while preserving the upstream wire contract. Any privacy or security conflict fails closed and must be resolved before production enablement.
