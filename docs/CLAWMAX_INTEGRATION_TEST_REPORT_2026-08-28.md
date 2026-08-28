# AgentForge × ClawMax Integration Test Report

**Date:** August 28, 2026  
**AgentForge:** public Sites deployment v60, commit `ae1a994`  
**ClawMax:** dashboard `2.0.0`, commit `5d2a0b0`  
**Wire schema:** `clawmax.activity-export/v1`  
**Temporary destination:** `clawmax-ai` until the named AgentForge adapter is added

## Result

The first real local-to-public activity delivery passed. A local ClawMax worker queued an `agent-chat` event, asynchronously delivered it to AgentForge, received acceptance, and removed it from the local outbox. AgentForge linked the event to the enrolled participant and consent receipt, normalized it into Prompt evidence, and created a pending Cognee outbox item.

## Verified behavior

- v60 deployed successfully and all four new enrollment/consent/purge tables were created in production D1.
- The authenticated receiver health endpoint returns the configured destination and canonical schema.
- A batch with an unknown receipt is rejected with `403` and is not normalized.
- A one-time AgentForge connection code can be exchanged for a ClawMax enrollment.
- A destination-specific receipt can be registered with supported scopes.
- A valid `agent-chat` event is accepted and normalized.
- Replaying the identical batch returns duplicate success and does not create duplicate evidence.
- Secrets and direct contact information are replaced with `[REDACTED]` before storage.
- Revoking a receipt immediately blocks later events with `403` and creates a pending purge job.
- A real ClawMax worker can retry a retained outbox event after a temporary delivery failure.
- Successful delivery returns the ClawMax outbox to zero pending events.

## Integration issue found

ClawMax currently stores the internal workspace path in its local consent record, but `createActivityExportEvent(...)` replaces the event's workspace field with `getOpaqueActivityWorkspaceId(...)`. If enrollment and remote receipt registration use the internal path, the delivered event carries a different identity and AgentForge correctly rejects it.

For the successful run, enrollment and receipt registration used the opaque value present on the exported event. The named AgentForge adapter should obtain and use that same opaque wire identity before it calls the enrollment and receipt endpoints.

## Questions for Max

1. Which ClawMax function or Partner API should expose the canonical opaque workspace identity during enrollment?
2. Should the local consent receipt itself store the opaque identity, or should the Partner adapter translate it only for remote registration?
3. Can AgentForge be added as a named destination instead of temporarily reusing `clawmax-ai`?
4. Where should the one-time AgentForge connection code be entered in the ClawMax Cloud UI?
5. Can the Cloud environment expose delivery status, retry evidence, and receipt revocation for the shared conformance test?

## Remaining production gates

- Finish deletion propagation for normalized AgentForge records and already-synced Cognee memory.
- Confirm named destination metadata, final hostname, privacy URL, and credential exchange.
- Add Partner-specific rate limiting and production alerting.
- Run 50-, 100-, and 300-participant load tests.
- Repeat the same test against ClawMax Cloud.
