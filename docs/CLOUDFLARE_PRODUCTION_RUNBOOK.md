# AgentForge Cloudflare production runbook

`https://cogniloop.space` is the production origin. Keep the `workers.dev`
hostname available as an emergency fallback and validate both after every deploy.

## 1. Create paid resources

1. Upgrade Workers to the paid plan in the Cloudflare dashboard.
2. Create `agentforge-hackathon-prod` in Eastern North America (`enam`).
3. Create queues `agentforge-cognee-sync` and `agentforge-cognee-sync-dlq`.
4. Copy `wrangler.production.example.jsonc` to the ignored file `wrangler.production.jsonc` and replace the D1 database ID.
5. Keep `cogniloop.space` and `www.cogniloop.space` as Custom Domains and keep `workers_dev` enabled as the emergency fallback.

## 2. Configure secrets

Use `npx wrangler secret put NAME --config wrangler.production.jsonc` for each secret. Required values include `OPENAI_API_KEY` or `OPENAI_API_KEYS_JSON`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `APP_ORIGIN`, and `CLAWMAX_INGESTION_TOKEN`. Cognee values are optional but required for memory delivery.

Never place secret values in the Wrangler config or commit them to Git.

## 3. Migrate and deploy

Apply all migrations to the new remote D1 database:

```powershell
npx wrangler d1 migrations apply agentforge-hackathon-prod --remote --config wrangler.production.jsonc
```

Build with the production configuration, then deploy the generated Worker:

```powershell
$env:CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH = ".\wrangler.production.jsonc"
npm run build
npx wrangler deploy --config dist/server/wrangler.json
```

The generated `dist/server/wrangler.json` points Wrangler at vinext's compiled
Worker entry, production bindings, Custom Domains, and `workers.dev` fallback.
Deploying from the source config directly will skip the generated virtual RSC
entry and fail to bundle the application.

## 4. Verify the production hostnames

- Confirm `https://cogniloop.space` and `https://www.cogniloop.space` return HTTP 200 with valid TLS.
- Confirm `https://agentforge-hackathon-os.yr2110.workers.dev` remains available as the emergency fallback.
- Set `APP_ORIGIN=https://cogniloop.space` so verification and password-reset links use the production hostname.

- Register a new participant, verify email, sign in/out, and reset the password.
- Complete consent, onboarding, solo/team assignment, Blueprint autosave, Ask AI, feedback, and ClawMax ingestion.
- Confirm Organizer Preflight shows the current schema and no stale reservations.
- Confirm Cognee outbox records move from pending to synced through the queue.
- Run `npm run load:test -- --base-url https://WORKER_URL --users 100 --duration 120`, then repeat with 200 users.
- Keep AI calls disabled in the load test unless test accounts and an explicit provider budget have been prepared.
- Export D1 using `scripts/backup-d1.ps1` and test importing the export into a disposable database.

## 5. Rollback

If error rate, p95 latency, authentication, or data writes regress, direct organizers
to the verified `workers.dev` fallback while diagnosing the same Worker version.
Preserve the D1 database and queue state for diagnosis; do not switch back to the
legacy ChatGPT Site or create a second production database.

## Capacity guardrails

- Autosave waits 2.5 seconds and does not create an analytics event for every draft write.
- Ask AI reserves event/team/participant tokens atomically before calling the provider, then reconciles actual usage.
- A five-minute cleanup expires abandoned reservations.
- Cognee delivery uses a claim-based D1 outbox and a Queue consumer; participant requests only enqueue a wake-up.
- The load test fails when error rate exceeds 1% or p95 exceeds 1.5 seconds.
- Run the 100-user test first; 200 users is the safety-margin test, not an expected attendee count.
