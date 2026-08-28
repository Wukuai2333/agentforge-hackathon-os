# AgentForge × ClawMax Implementation Profile v1

**Status:** implemented on the AgentForge side; named ClawMax adapter and Cloud conformance test pending

**ClawMax source baseline:** dashboard `2.0.0`, compact `clawmax.activity-export/v1` envelope

**Destination ID:** environment-configured; final value must be confirmed with ClawMax

This profile describes what the running code accepts. The broader Partner Contract remains the policy/design review document; this file is the concrete interoperability checklist for the current ClawMax source.

## Participant flow

1. The signed-in AgentForge participant accepts the AgentForge event privacy consent.
2. In Settings, the participant generates a ten-minute, single-use connection code.
3. The participant enters the code in ClawMax.
4. ClawMax exchanges the code server-to-server using the Partner bearer credential.
5. ClawMax presents destination-specific sharing choices.
6. ClawMax registers the resulting receipt with AgentForge.
7. Only activity matching the active enrollment, receipt identity, scope, and time window is accepted.

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

## Still required from ClawMax

- Add the named AgentForge destination to the Partner catalog and allowed-destination list.
- Add AgentForge labels and consent copy in the ClawMax UI.
- Call enrollment exchange before creating the AgentForge consent.
- Register and revoke receipts remotely.
- Use the versioned AgentForge batch endpoint and dedicated server secret.
- Provide Cloud test access and delivery-status evidence.
- Confirm the final destination ID and production hostname.

## Remaining AgentForge production gates

- Execute and verify purge jobs against native AgentForge records and already-synced Cognee memory.
- Use separately rotatable credentials per Cloud environment or instance.
- Add production alerting and a 300-participant synthetic load test.
- Replace the prototype hostname and update Partner configuration without changing payload semantics.
