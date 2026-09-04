# AgentForge × ClawMax Implementation Profile v1

**Status:** frozen compact-v1 profile; AgentForge receiver and named ClawMax adapter implemented; public deployment and Cloud conformance test pending

**ClawMax source baseline:** dashboard `2.0.0`, compact `clawmax.activity-export/v1` envelope

**Destination ID:** `agentforge`

**Purpose:** Provide event-scoped learning support, progress evidence, prompt coaching, and improvement of hackathon tutorials.

**Retention:** Event window plus up to 30 days, subject to the final reviewed participant disclosure.

**Latest conformance run:** August 28, 2026 — local ClawMax `2.0.0` worker delivered an authorized `agent-chat` event to the public AgentForge v60 receiver and the event normalized successfully.

This profile describes what the running code accepts. The broader Partner Contract remains the policy/design review document; this file is the concrete interoperability checklist for the current ClawMax source.

## Participant flow

1. The signed-in AgentForge participant accepts the AgentForge event privacy consent.
2. In Settings, the participant generates a ten-minute, single-use connection code.
3. The participant enters the code in ClawMax.
4. ClawMax exchanges the code server-to-server using the Partner bearer credential.
5. ClawMax presents destination-specific sharing choices.
6. ClawMax registers the resulting receipt with AgentForge.
7. Only activity matching the active enrollment, receipt identity, scope, and time window is accepted.

The enrollment exchange and remote consent receipt MUST use the same partner-facing opaque `workspaceId` and `userId` that ClawMax writes into exported events. Internal filesystem paths or other local workspace identifiers are not valid wire identities.

No AgentForge password, Session token, email, internal user ID, or Partner bearer credential is returned to ClawMax.

## Endpoints

| Purpose | Method and path | Authentication |
|---|---|---|
| Participant connection status | `GET /api/clawmax/enrollments` | AgentForge Session |
| Create one-time code | `POST /api/clawmax/enrollments` | AgentForge Session |
| Participant disconnect | `DELETE /api/clawmax/enrollments` | AgentForge Session |
| Exchange one-time code | `POST /api/v1/clawmax/enrollments/exchange` | Partner bearer token |
| Register consent receipt | `POST /api/v1/clawmax/consent-receipts` | Partner bearer token |
| Revoke receipt / request purge | `DELETE /api/v1/clawmax/consent-receipts` | Partner bearer token |
| Receipt and purge status | `GET /api/v1/clawmax/consent-receipts?receiptId=...` | Partner bearer token |
| Deliver activity | `POST /api/v1/clawmax/activity-events` | Partner bearer token |
| Receiver health/counts | `GET /api/v1/clawmax/activity-events` | Partner bearer token |

The unversioned `/api/clawmax/...` transport paths remain available as compatibility aliases during integration.

## Enrollment exchange

```http
POST /api/v1/clawmax/enrollments/exchange
Authorization: Bearer <partner-token>
Content-Type: application/json
```

```json
{
  "connectionCode": "7K3MP9Q2AB",
  "destinationId": "agentforge",
  "workspaceId": "opaque-clawmax-workspace",
  "userId": "opaque-clawmax-user"
}
```

Successful response:

```json
{
  "enrollmentId": "partner-scoped-id",
  "partnerParticipantId": "partner-scoped-id",
  "destinationId": "agentforge",
  "status": "active"
}
```

## Consent registration

The `Idempotency-Key` header equals `receiptId`.

```json
{
  "receiptId": "consent_opaque",
  "enrollmentId": "partner-scoped-id",
  "destinationId": "agentforge",
  "workspaceId": "opaque-clawmax-workspace",
  "userId": "opaque-clawmax-user",
  "scopes": ["agent-chat", "workflow", "builder"],
  "consentVersion": "activity-export-consent/v1",
  "consentedAt": "2026-09-26T13:00:00.000Z",
  "expiresAt": "2026-09-27T03:00:00.000Z"
}
```

Initial-launch scopes are exactly `agent-chat`, `workflow`, and `builder`. `group-chat` and `community-chat` are rejected until mixed-consent behavior is reviewed.

For revocation, send `DELETE` with `{ "receiptId": "consent_opaque" }` and `Idempotency-Key: consent_opaque:revoke`.

## Authorization and normalization

AgentForge rejects a new batch unless every event:

- uses the configured destination and compact v1 schema;
- references an active known receipt;
- matches the receipt's ClawMax workspace and user;
- is covered by the receipt scope;
- occurred after consent and before expiry; and
- passes size, source, redaction, and idempotency checks.

Accepted activity is normalized as follows:

| ClawMax source | AgentForge record | Cognee queue |
|---|---|---|
| `agent-chat` | Prompt plus visible assistant response | `prompt_event` |
| `workflow` | Progress evidence | `progress_event` |
| `builder` | Progress evidence | `progress_event` |

Team membership is resolved at the activity timestamp. Sanitized raw evidence remains linked to its source event, receipt, participant, native AgentForge record, normalization result, and request hash.

## Implemented in the ClawMax follow-up branch

- Named `agentforge` destination, Partner setup, and consent/status UI.
- Opaque workspace and user IDs reused consistently for enrollment, receipt, and exported events.
- Server-side connection-code exchange and receipt registration/revocation.
- Versioned batch delivery with durable retry and a dedicated credential.
- Durable remote deletion retry after local revoke.

## Still required from ClawMax / joint deployment

- Merge the approved catalog/branding PR, then review and merge the stacked Activity Export follow-up.
- Provide a Cloud test account or operator-assisted instance.
- Configure the production AgentForge hostname and dedicated server secret.
- Capture receiver-conformance and delivery-status evidence from the same Cloud build used for the event.

## Remaining AgentForge production gates

- Deploy the receiver with `CLAWMAX_DESTINATION_ID=agentforge` (the current public environment still reports the older `clawmax-ai` value).
- Verify local purge of raw and normalized records. Already-synced Cognee memory remains an explicit incomplete deletion state until record-addressable remote deletion is available.
- Use separately rotatable credentials per Cloud environment or instance.
- Add production alerting and a 300-participant synthetic load test.
- Replace the prototype hostname and update Partner configuration without changing payload semantics.
