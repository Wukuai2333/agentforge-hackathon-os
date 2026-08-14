# AgentForge platform contracts

This document is the implementation boundary for identity, AI usage control,
and ClawMax Activity Export. It distinguishes confirmed decisions from items
that still require production configuration or partner confirmation.

## 1. Internal identity contract

AgentForge owns one canonical user record. Authentication methods are linked
identities and never become the application's primary user model.

Supported identity types:

- `password`: AgentForge-managed email and password.
- `google`: Google OpenID Connect subject, when configured.
- `chatgpt`: Sites-provided Sign in with ChatGPT subject, when available.

Rules:

- One user may link multiple identities.
- Provider subjects, not email addresses, are the stable external identifiers.
- Users cannot assign their own role.
- Roles are `participant` and `organizer` only.
- Authorization is checked on every server route.
- Browser sessions use an opaque, random token in an `HttpOnly`, `Secure`,
  `SameSite=Lax` cookie; D1 stores only its hash.
- Passwords are stored only as salted hashes created by a vetted adaptive
  password-hashing implementation; plaintext passwords never enter D1 or logs.

Still to configure before public registration:

- Transactional email provider and sender domain.
- Email-verification requirement and account-recovery policy.
- Google production OAuth client.
- Availability of Sites-provided Sign in with ChatGPT for this project.

## 2. Request-admission and accounting contract

Authentication, Ask AI, and ClawMax ingestion have separate policies.

- Edge rate limiting rejects obvious bursts cheaply.
- Exact concurrency and budget reservation use serialized state or an atomic
  conditional database update.
- D1 is authoritative for users, configured budgets, AI request state, actual
  provider usage, and audit history.
- Rate-limiter counters are not billing or budget records.

Confirmed Ask AI defaults:

- 10 requests per participant per minute.
- 100 requests per participant per hour.
- Initially one active generation per participant.
- Every logical request has a unique idempotency key.
- Event, team, member, and per-response output limits are organizer-controlled.

AI request state machine:

```text
pending -> reserved -> processing -> completed
                            |            |
                            v            v
                          failed      reconciled
                            |
                            v
                          unknown
```

The database never waits inside an open transaction for Cognee or OpenAI.
Capacity is reserved in a short atomic operation, the provider call occurs
outside the transaction, and actual usage is finalized in another short
operation.

## 3. Token reservation contract

The initial budget unit is total provider tokens (`input + output`). The
response limit separately controls maximum output tokens.

Before a provider call:

1. Estimate input tokens after context assembly.
2. Add the configured maximum output tokens.
3. Atomically reserve that amount against the most specific applicable member,
   team, and event budgets.
4. Reject without calling the provider when any required budget cannot reserve.

After a successful call:

1. Record provider-reported input and output tokens.
2. Convert the reservation into actual usage.
3. Release unused capacity.

After a confirmed pre-provider failure, release the full reservation. When the
provider outcome cannot be established, keep the request `unknown` for
reconciliation rather than immediately retrying and risking duplicate cost.

## 4. ClawMax partner boundary

The complete AgentForge implementation baseline is documented in
[`AGENTFORGE_CLAWMAX_PARTNER_CONTRACT_V2.md`](./AGENTFORGE_CLAWMAX_PARTNER_CONTRACT_V2.md).
It follows ClawMax's public Activity Export `2.0.0` platform contract while
preserving the canonical `clawmax.activity-export/v1` wire schema.

AgentForge is a direct, consented Activity Export destination.

Target partner metadata:

- `destinationId`: `NYU_agentforge`
- Schema target: `clawmax.activity-export/v1`
- Delivery: authenticated HTTPS batch ingestion
- Authentication: deployment-managed Bearer token
- Required behaviors: idempotency, per-event acknowledgement, redaction,
  retry-safe ingestion, auditability, and consent-linked purge

AgentForge endpoints:

```text
POST /v1/clawmax/activity-events:batch
POST /v1/clawmax/activity-events:purge
```

ClawMax activity first enters immutable raw-ingestion tables. A separate
normalizer maps accepted evidence into AgentForge prompt, response, progress,
feedback, and Cognee-outbox records. Every normalized record retains its raw
source event ID.

Items to confirm with the ClawMax implementation:

- Whether the production payload uses the documented nested canonical event or
  the current smaller implementation event.
- `schemaVersion` versus `version`.
- Canonical scope names versus current implementation scope names.
- Partner-scoped participant enrollment mapping.
- Per-event acknowledgement handling.
- Remote purge behavior for delivered data.

## 5. Required operational controls

- Turnstile on signup and adaptive high-risk authentication flows.
- Independent auth, Ask AI, and ingestion rate limits.
- Account-linking and duplicate-account recovery.
- Session revocation and password-change session invalidation.
- Privacy/consent versioning.
- Audit events for role changes, authentication failures, budget changes,
  provider calls, ClawMax ingestion, and purge.
- Load tests for registration, login, Ask AI admission, and ClawMax batches.
- Reconciliation for AI requests whose provider outcome is unknown.

## Deferred privacy TODO (not implemented in the current phase)

Deletion propagation must eventually cover D1 raw facts, Prompt/Response
records, ClawMax raw ingestion, Cognee-derived memory, and an audit record that
proves the workflow ran without retaining the deleted content. This remains a
design and meeting item until retention, legal, Cognee, and ClawMax behavior are
agreed; the current implementation does not claim to perform it.
