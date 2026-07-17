# Phase 1 — Identity and Teams

## Confirmed product rules

- A participant is not required to be a student.
- Any participant may create a team.
- A person may have only one active team membership at a time.
- A person may switch teams during the event.
- Leaving, switching, or archiving a team does not immediately delete team data.
- Team data remains available until the event-day retention deadline, then enters the configured cleanup process.

## Decisions reserved for the planning meeting

- Login method: general email, event invitation, or external identity provider.
- Whether email ownership must be verified before joining an event.
- Mentor permissions.
- Organizer permissions.
- Who may remove another team member.
- Whether a team creator has additional privileges after team creation.
- Whether team size has a limit.

## Authentication boundary

Phase 1 does not trust identity values supplied by the browser. An `IdentityProvider` must return a verified provider and subject before any team write API is exposed. The provider is deliberately replaceable so the product is not tied to school email or ChatGPT sign-in.

## Team membership lifecycle

```text
Authenticated participant
        ↓
Create a team OR join with an invite code
        ↓
Exactly one active membership
        ↓
Stay / leave / switch
        ↓
Close the old membership; never rewrite history
        ↓
Retain team data until the event retention deadline
```

## Data model

- `hackathon_events`: event time window and retention deadline.
- `event_participants`: event-scoped identity, display name, consent, and provisional role.
- `teams`: event-scoped team, creator, invite code, status, and data expiration time.
- `team_memberships`: membership history with one partial unique index for the active membership.
- `team_invites`: revocable, expiring, optionally use-limited invitation codes.
- `team_membership_events`: immutable create/join/leave/switch/remove audit history.

## Retention behavior

Leaving a team closes the active membership with an `ended_at` time and reason. It does not delete projects, memories, prompts, or activity. Archiving a team similarly marks the team inactive and records `data_expires_at`. A later retention job will delete or anonymize records after the event deadline according to the final policy.

## Security invariants

1. Identity comes from a verified server-side provider, never request JSON.
2. Every team query is scoped by both `event_id` and `team_id`.
3. Every team write checks active membership on the server.
4. Switching closes the old membership and creates a new one in one database batch.
5. Invite codes expire and can be revoked.
6. Team data is soft-deleted first; retention cleanup is a separate auditable operation.
