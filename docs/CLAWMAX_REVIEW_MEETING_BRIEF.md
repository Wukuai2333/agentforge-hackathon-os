# AgentForge x ClawMax v2.0 Review Meeting Brief

**Purpose:** Confirm the shared technical and data boundary before either side implements or enables production activity export.

**Working document:** [`AGENTFORGE_CLAWMAX_PARTNER_CONTRACT_V2.md`](./AGENTFORGE_CLAWMAX_PARTNER_CONTRACT_V2.md)

**Current status:** AgentForge has drafted a proposed implementation profile based on ClawMax Public Activity Export v2.0. It is not yet a mutually accepted contract. No production receiver, partner credential, consent receipt integration, or ClawMax activity export is enabled.

## Opening brief

AgentForge is proposing an opt-in ClawMax partner destination for the NYU hackathon. A participant would explicitly choose AgentForge and select what activity may be shared. ClawMax would persist normal activity first, enforce consent and scope, redact sensitive content, and deliver events asynchronously. AgentForge would authenticate and validate the events, store evidence with participant and consent provenance, acknowledge retries idempotently, and queue only sanitized evidence for Cognee. Revocation must stop capture and propagate deletion through AgentForge and Cognee.

For this meeting, we only need to align on the interface between the two systems. AgentForge's D1 schema, Cognee outbox, dashboards, and learning-analysis logic are internal implementation details unless they change the behavior ClawMax can observe.

## Suggested starting question

> Does this proposed flow match the partner adapter lifecycle already implemented in ClawMax v2.0, especially for enrollment and consent receipt synchronization? If not, which existing ClawMax extension points and payloads should AgentForge adopt instead?

## Decisions to confirm with Max

Record the answer and owner beside every item. Do not treat silence as approval.

### 1. Partner identity and adapter

- [ ] What destination ID format does ClawMax require?
- [ ] Use `NYU_agentforge`, `nyu-agentforge`, or another registered value: __________
- [ ] Where should the AgentForge partner manifest or adapter live?
- [ ] Can Max point us to the closest existing partner implementation and fixtures?
- [ ] Which ClawMax v2.0 commit/build should be the shared compatibility baseline?

### 2. Enrollment and participant mapping

- [ ] Does ClawMax support the proposed short-lived AgentForge connection-code exchange?
- [ ] If not, what existing enrollment API or adapter hook should we use?
- [ ] Confirm that ClawMax sends only a partner-scoped pseudonymous participant ID by default.
- [ ] Confirm that email/name are excluded unless separately disclosed and consented.
- [ ] Confirm how `workspaceId`, `instanceId`, `eventId`, and `scriptId` are generated and persisted.

### 3. Consent receipt lifecycle — highest priority

- [ ] How does ClawMax deliver the full minimized consent state before the first event?
- [ ] Can ClawMax call the proposed receipt registration endpoint, or does v2.0 already define another mechanism?
- [ ] How are scope expansion, scope reduction, renewal, expiry, and revocation represented?
- [ ] Does ClawMax sign receipts, or is the authenticated server channel the integrity boundary?
- [ ] Confirm that revocation immediately stops capture and removes unsent events.
- [ ] Confirm whether removing one scope also purges already-delivered data from that scope.

### 4. Canonical schema and content integrity

- [ ] Confirm canonical schema name: `clawmax.activity-export/v1`.
- [ ] Exchange a machine-readable JSON Schema, not only example JSON.
- [ ] Confirm required/nullable fields, enum values, maximum sizes, and unknown-field behavior.
- [ ] Confirm UTC RFC 3339 timestamps and allowed clock skew.
- [ ] Confirm exactly how `content.sha256` and the batch request hash are computed.
- [ ] Confirm these rules:
  - same ID + same hash = duplicate success;
  - same ID + different hash = permanent mismatch and alert;
  - different event IDs may contain identical text and hashes.

### 5. Batch acknowledgement and retry

- [ ] Confirm 50 events, 256 KiB per batch, and 64 KiB per event as launch limits.
- [ ] Confirm partial acceptance response fields and stable rejection codes.
- [ ] For transient event rejection, does ClawMax resend the identical batch or create a child batch?
- [ ] Confirm behavior for `400`, `401`, `403`, `409`, `413`, `429`, `5xx`, and timeout.
- [ ] Confirm that delivery can arrive out of order and `sequence` is reconstruction metadata, not an ingestion lock.
- [ ] Confirm outbox retention ends at the earliest of 24 hours, receipt expiry, event end, or revocation.

### 6. Group conversations

- [ ] Keep `conversation.group` disabled for the initial launch?
- [ ] If later enabled, may we export only the consenting user's own turn and its directly paired assistant reply?
- [ ] How will ClawMax remove quoted or embedded content from non-consenting participants?
- [ ] Approve mixed-consent group fixtures before enabling this scope.

### 7. Redaction and raw storage

- [ ] Confirm ClawMax performs first-pass secret and scope redaction before its durable outbox.
- [ ] Confirm AgentForge may run a second scan before durable content storage.
- [ ] Confirm that wire hashes and audit metadata can be retained even when unsafe content is rejected.
- [ ] Agree that rejected/high-risk content is never normalized, displayed, or sent to Cognee.

### 8. Revocation, purge, and derived Cognee data

- [ ] Confirm purge request and status endpoint shapes.
- [ ] Confirm immediate access restriction followed by asynchronous physical/semantic deletion.
- [ ] Confirm how ClawMax displays pending or failed purge state.
- [ ] Confirm that multi-source inferences remove only the revoked evidence edge, then recompute or withdraw the inference.
- [ ] Agree that `purgeSupported` remains false until D1 and Cognee deletion conformance passes.
- [ ] Agree on the purge completion deadline and content-free audit tombstone.

### 9. Credential and environment setup

- [ ] Separate sandbox and production credentials.
- [ ] Bind each credential to the destination, environment, and allowed ClawMax deployment/instance.
- [ ] Agree on credential rotation, overlap, emergency revocation, and secure delivery channel.
- [ ] Exchange sandbox hostname, health URL, privacy URL, and technical contacts.
- [ ] Never put partner tokens in GitHub, browser settings, participant UI, or meeting chat.

### 10. Testing and launch gate

- [ ] Exchange valid, duplicate, mismatch, malformed, expired, revoked, partial-failure, and secret-redaction fixtures.
- [ ] Test receiver outage, retry, queue saturation, recovery, and purge failure.
- [ ] Test 50, 100, and 300 synthetic participants.
- [ ] Define the launch latency/error target and dead-letter review owner.
- [ ] Keep production export disabled until consent, retry, redaction, isolation, and purge tests pass.

## What AgentForge will own after agreement

- Partner credentials and authenticated receiver endpoints.
- Enrollment and consent-receipt mappings in D1.
- Hash-aware idempotent ingestion and acknowledgements.
- Receiver-side redaction, quarantine, normalization, and provenance.
- D1 facts, Organizer monitoring, and Cognee outbox processing.
- Purge propagation across raw data, normalized records, and Cognee-derived memory.
- Sandbox fixtures, conformance results, and load-test evidence.

## What we need from ClawMax after agreement

- The correct partner adapter/manifest extension point.
- Consent, enrollment, canonical-event, retry, and purge behavior matching the agreed contract.
- The supported v2.0 build and representative fixtures.
- A sandbox instance or test path with a securely configured AgentForge destination.
- Accurate participant-facing sharing, delayed, attention, and revoked states.

## Meeting exit criteria

The meeting is successful if we leave with:

1. a confirmed destination and adapter path;
2. a confirmed enrollment and consent receipt lifecycle;
3. agreed hash, acknowledgement, partial retry, and group-scope rules;
4. agreed purge behavior;
5. named technical owners and sandbox exchange steps; and
6. a short list of unresolved items with owners and dates.
