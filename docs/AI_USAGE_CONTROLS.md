# AI usage controls

## Confirmed defaults

- Ask AI request limit: 10 requests per participant per minute.
- Ask AI request limit: 100 requests per participant per hour.
- Authentication, Ask AI, and ClawMax ingestion use independent rate-limit policies.
- A participant may have no more than two active Ask AI generations at once; the initial target is one.

## Organizer Portal controls to implement

- Event-wide token budget and remaining usage.
- Per-team token budget and remaining usage.
- Per-member token budget and remaining usage.
- Maximum output tokens for each response.
- Pause/resume Ask AI at event, team, or member scope.
- Usage, rejection, latency, and provider-error monitoring.

## Accounting requirements

- Reserve estimated capacity before starting an AI request.
- Finalize the reservation using actual provider usage after completion.
- Release the reservation when the provider call fails or is cancelled.
- Use an idempotency key so retries cannot create duplicate generations or duplicate charges.
- Keep database transactions short; never wait for the model while a D1 transaction is open.
