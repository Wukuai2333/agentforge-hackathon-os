import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("ships the AgentForge portal instead of the disposable starter", async () => {
  const [page, portal, layout] = await Promise.all([source("app/page.tsx"), source("app/portal.tsx"), source("app/layout.tsx")]);
  assert.match(page, /HackathonPortal/);
  assert.match(portal, /AgentForge/);
  assert.match(portal, /LIVE ORGANIZER PORTAL/);
  assert.doesNotMatch(page + portal + layout, /Codex is building the first version|Your site is taking shape|codex-preview/);
});

test("keeps learning facts separate from Cognee interpretation", async () => {
  const [portal, cognee, schema, migration] = await Promise.all([
    source("app/portal.tsx"), source("app/api/cognee/route.ts"), source("db/schema.ts"), source("drizzle/0004_cognee_learning_memory.sql"),
  ]);
  assert.match(portal, /Counts are rule-based SQL facts/);
  assert.match(portal, /Cognee adds an evidence-grounded interpretation/);
  assert.match(cognee, /never invent counts/);
  assert.match(schema, /participantModelEntries/);
  assert.match(schema, /entryKind.*fact.*inference.*confirmation/);
  assert.match(migration, /cognee_sync_outbox/);
  assert.match(migration, /learning_signals/);
});

test("keeps internal navigation in browser history", async () => {
  const portal = await source("app/portal.tsx");
  assert.match(portal, /history\.pushState/);
  assert.match(portal, /addEventListener\("hashchange", restoreFromHistory\)/);
  assert.match(portal, /addEventListener\("popstate", restoreFromHistory\)/);
});

test("lets organizers rehearse the participant workflow without changing their role", async () => {
  const portal = await source("app/portal.tsx");
  assert.match(portal, /Switch to Participant/);
  assert.match(portal, /Return to Organizer/);
  assert.match(portal, /agentforge_organizer_participant_mode/);
  assert.match(portal, /Organizer participant demo/);
});

test("links authenticated identity to consent, team, project, prompt, progress, and memory", async () => {
  const [account, me, assistant, notes, migration] = await Promise.all([
    source("app/api/account/route.ts"), source("app/api/me/route.ts"), source("app/api/assistant/route.ts"),
    source("app/api/team-notes/route.ts"), source("drizzle/0011_identity_consent_progress.sql"),
  ]);
  assert.match(account, /app_users/);
  assert.match(account, /consent_records/);
  assert.match(account, /team_memberships/);
  assert.match(assistant, /requireCurrentAccount/);
  assert.match(notes, /requireCurrentAccount/);
  assert.match(me, /Content-Disposition/);
  assert.doesNotMatch(me, /export async function DELETE/);
  assert.match(migration, /event_progress_events/);
});

test("ships real team collaboration, transparent learning models, and evidence-linked Cognee operations", async () => {
  const [portal, team, model, notes, delivery, cognee, organizer, migration] = await Promise.all([
    source("app/portal.tsx"), source("app/api/team/route.ts"), source("app/api/model/route.ts"), source("app/api/team-notes/route.ts"),
    source("lib/cognee-delivery.ts"), source("app/api/cognee/route.ts"), source("app/api/organizer/route.ts"), source("drizzle/0012_team_model_learning_signals.sql"),
  ]);
  assert.match(portal, /REAL TEAM WORKSPACE/);
  assert.match(portal, /TRANSPARENT PARTICIPANT MODEL/);
  assert.match(team, /regenerate_invite/);
  assert.match(notes, /expectedUpdatedAt/);
  assert.match(model, /participant_model_reviews/);
  assert.match(model, /superseded_by_id/);
  assert.match(delivery, /attempts<5/);
  assert.match(delivery, /participant_/);
  assert.match(cognee, /prompt_clusters/);
  assert.match(cognee, /learning_signal_evidence/);
  assert.match(organizer, /review_signal/);
  assert.match(migration, /participant_model_reviews/);
});

test("annotates Prompt adequacy and episode process evidence without a holistic learner score", async () => {
  const [portal, assistant, coaching, cognee, organizer, schema, migration] = await Promise.all([
    source("app/portal.tsx"), source("app/api/assistant/route.ts"), source("app/api/coaching/route.ts"),
    source("app/api/cognee/route.ts"), source("app/api/organizer/route.ts"), source("db/schema.ts"), source("drizzle/0013_prompt_coaching_v3.sql"),
  ]);
  assert.match(portal, /Prompt Coach/);
  assert.match(portal, /Learning agency evidence/);
  assert.match(portal, /no holistic score/);
  assert.match(portal, /N\/O when unnecessary or missing/);
  assert.match(portal, /SELECTED CONTEXT · RAW PARTICIPANT-SUPPLIED EVIDENCE/);
  assert.match(portal, /HOW PROCESS COACHING WORKS/);
  assert.match(portal, /what counts as Verification 3/);
  assert.match(portal, /WHY WE CHANGED THE RUBRIC/);
  assert.match(portal, /Missing evidence is not converted into a low score/);
  assert.match(portal, /THE SYSTEM DOES NOT CLAIM/);
  assert.match(portal, /invalid server response/);
  assert.match(assistant, /parent_prompt_event_id/);
  assert.match(coaching, /recorded_outcome/);
  assert.match(coaching, /superseded/);
  assert.match(cognee, /agentforge-process-coaching-v4/);
  assert.match(cognee, /VERIFY SCORE 3 requires all three observable elements/);
  assert.match(cognee, /Length, grammar sophistication, persona wording/);
  assert.match(cognee, /not_observable/);
  assert.match(cognee, /deterministic_non_prompt_gate/);
  assert.match(organizer, /context_reference AS contextReference/);
  assert.match(schema, /promptCoachingActions/);
  assert.match(migration, /prompt_coaching_actions/);
});

test("updates a participant-controlled model from evidence-linked Cognee inference", async () => {
  const [portal, model] = await Promise.all([source("app/portal.tsx"), source("app/api/model/route.ts")]);
  assert.match(portal, /Update My Model/);
  assert.match(portal, /Participant initiated/);
  assert.match(portal, /View .* linked source record/);
  assert.match(model, /cognee_evidence_synthesis/);
  assert.match(model, /evidence_source_ids/);
  assert.match(model, /requires_participant_review/);
  assert.match(model, /Do not infer intelligence, personality, motivation/);
});

test("uses Shared Space for team collaboration without renaming Cognee concepts", async () => {
  const portal = await source("app/portal.tsx");
  assert.match(portal, />Shared Space</);
  assert.match(portal, /TEAM COLLABORATION/);
  assert.match(portal, /nothing here is shared automatically/i);
  assert.doesNotMatch(portal, />Shared Brain</);
  assert.match(portal, /COGNEE SEMANTIC MEMORY/);
});

test("uses AgentForge password authentication with audited abuse controls", async () => {
  const [portal, account, session, password, localAuth, schema] = await Promise.all([
    source("app/portal.tsx"), source("app/api/account/route.ts"), source("app/api/auth/session/route.ts"),
    source("app/api/auth/password/route.ts"), source("lib/local-auth.ts"), source("db/schema.ts"),
  ]);
  assert.match(portal, /Create account/);
  assert.match(session, /HttpOnly; Secure; SameSite=Lax/);
  assert.match(localAuth, /PBKDF2/);
  assert.match(localAuth, /PASSWORD_ITERATIONS = 100_000/);
  assert.match(schema, /passwordHash: text\("password_hash"\)/);
  assert.match(password, /SIGNUPS_PER_IP_PER_HOUR = 100/);
  assert.match(password, /LOGIN_FAILURE_LIMIT = 10/);
  assert.match(password, /LOGIN_LOCK_MS = 5 \* 60 \* 1000/);
  assert.match(account, /ORGANIZER_EMAILS/);
  assert.match(account, /OR email=\?/);
  assert.doesNotMatch(localAuth + session, /console\.log\([^)]*password/i);
});

test("enforces organizer-controlled hierarchical AI access without exposing provider keys", async () => {
  const [portal, assistant, organizer, schema, migration, envExample] = await Promise.all([
    source("app/portal.tsx"), source("app/api/assistant/route.ts"), source("app/api/organizer/route.ts"),
    source("db/schema.ts"), source("drizzle/0022_hierarchical_ai_allocation.sql"), source(".env.example"),
  ]);
  assert.match(portal, /Allocation & Usage Policy/);
  assert.match(portal, /Participants never receive provider keys/);
  assert.match(assistant, /providerKeyPool/);
  assert.match(assistant, /stableKeyIndex/);
  assert.match(assistant, /event_token_quota/);
  assert.match(assistant, /default_participant_token_quota/);
  assert.match(assistant, /SELECT COUNT\(\*\) FROM assistant_active_leases/);
  assert.match(assistant, /maximum number of AI requests running/);
  assert.match(organizer, /providerKeyCount/);
  assert.match(envExample, /OPENAI_API_KEYS_JSON=\[\]/);
  assert.match(schema, /requestId: text\("request_id"\)\.primaryKey\(\)/);
  assert.match(migration, /max_concurrent_requests/);
});

test("explains FEVI to participants and opens ClawMax through a server handoff", async () => {
  const [portal, styles] = await Promise.all([source("app/portal.tsx"), source("app/globals.css")]);
  assert.match(portal, /FEVI keeps you in control of the AI/);
  assert.match(portal, /Formulate/);
  assert.match(portal, /Engage/);
  assert.match(portal, /Verify/);
  assert.match(portal, /Integrate/);
  assert.match(portal, />Open ClawMax</);
  assert.match(portal, /\/api\/clawmax\/enrollments/);
  assert.match(styles, /\.assistant\{width:min\(520px,100%\)\}/);
  assert.match(styles, /\.answer p\{font-size:15px/);
});

test("runs a participant-reported onboarding interview before the project canvas", async () => {
  const [portal, onboarding, assistant, account, schema, migration, styles] = await Promise.all([
    source("app/portal.tsx"), source("app/api/onboarding/route.ts"), source("app/api/assistant/route.ts"),
    source("lib/account.ts"), source("db/schema.ts"), source("drizzle/0023_participant_interviewer.sql"), source("app/globals.css"),
  ]);
  assert.match(portal, /PARTICIPANT INTERVIEW/);
  assert.match(portal, /NYU Tandon student/);
  assert.match(portal, /Prior agent-building experience|agent_experience/);
  assert.match(portal, /How should Ask AI work with you/);
  assert.match(portal, /Response style/);
  assert.match(portal, /autoFocus/);
  assert.match(onboarding, /participant_reported_fact/);
  assert.match(onboarding, /onboarding_interview/);
  assert.match(onboarding, /response_length/);
  assert.match(assistant, /lengthInstruction/);
  assert.match(assistant, /modeInstruction/);
  assert.match(account, /onboardingCompleted/);
  assert.match(schema, /participantOnboardingProfiles/);
  assert.match(migration, /participant_onboarding_profiles/);
  assert.match(styles, /interviewer-breathe/);
  assert.match(styles, /prefers-reduced-motion/);
});

test("manages registered users with server roles and enforces registration state", async () => {
  const [portal, event, account, authConfig, organizer, cognee, schema, migration, envExample] = await Promise.all([
    source("app/portal.tsx"), source("app/api/event/route.ts"), source("app/api/account/route.ts"),
    source("app/api/auth/config/route.ts"), source("app/api/organizer/route.ts"), source("app/api/cognee/route.ts"),
    source("db/schema.ts"), source("drizzle/0014_participant_organizer_roles.sql"), source(".env.example"),
  ]);
  assert.match(portal, /Registered Users/);
  assert.match(portal, /LAST ACTIVE/);
  assert.match(portal, /CONSENT/);
  assert.match(portal, /option value="participant"/);
  assert.match(portal, /option value="organizer"/);
  assert.doesNotMatch(portal, /x-organizer-code|Organizer code false/);
  assert.match(event, /At least one Organizer must remain/);
  assert.match(event, /consentStatus/);
  assert.match(event, /lastActive/);
  assert.match(account, /Registration is currently closed/);
  assert.match(authConfig, /registrationOpen/);
  assert.doesNotMatch(organizer + cognee + envExample, /ORGANIZER_ACCESS_CODE|x-organizer-code/);
  assert.doesNotMatch(schema, /\["participant", "mentor", "organizer"\]/);
  assert.match(migration, /SET `role`='participant' WHERE `role`='mentor'/);
});

test("lets participants replace selected Ask AI context while the drawer stays open", async () => {
  const [portal, styles, selectionStyles] = await Promise.all([source("app/portal.tsx"), source("app/globals.css"), source("app/selection-clawmax.css")]);
  assert.match(portal, /closest\("input, textarea, button, a, \.assistant, \.selection-context-menu"\)/);
  assert.match(portal, />Ask AI</);
  assert.match(portal, /Take Notes/);
  assert.match(portal, /getRangeAt\(0\)\.getBoundingClientRect\(\)/);
  assert.match(portal, /setAssistantContext\(selectionAction\.text\)/);
  assert.doesNotMatch(portal, /setAssistantContext\(selected\); openAssistant\(\)/);
  assert.match(portal, /What should my agent remember, what should it verify, and where should I stay in control/);
  assert.match(portal, /Highlight different text on the page to replace this context/);
  assert.match(styles, /\.assistant-backdrop[^}]*pointer-events:none/);
  assert.match(styles, /\.assistant[^}]*pointer-events:auto/);
  assert.match(selectionStyles, /\.selection-context-menu\{position:fixed/);
  assert.match(selectionStyles, /never opens the assistant by itself/);
});

test("explains the temporary ClawMax SDK BYOK setup without promising the Cloud flow", async () => {
  const portal = await source("app/portal.tsx");
  assert.match(portal, /TEMPORARY SDK TEST FLOW/);
  assert.match(portal, /Open BYOK/);
  assert.match(portal, /Add your provider key/);
  assert.match(portal, /Select a default model/);
  assert.match(portal, /Test the provider connection/);
  assert.match(portal, /Start and test the agent/);
  assert.match(portal, /should not assume they will need personal keys until that workflow is confirmed/);
});

test("removes the Cognee tutorial and legacy build path from participant navigation", async () => {
  const portal = await source("app/portal.tsx");
  assert.doesNotMatch(portal, /setView\("cogneeTutorial"\)/);
  assert.doesNotMatch(portal, /RECOMMENDED BUILD PATH/);
  assert.doesNotMatch(portal, /From idea to measurable improvement/);
  assert.match(portal, /className="prompt-coach-placeholder"/);
});

test("captures three lightweight evidence check-ins without turning them into progress grades", async () => {
  const [portal, route, schema, migration, me] = await Promise.all([
    source("app/portal.tsx"), source("app/api/checkins/route.ts"), source("db/schema.ts"),
    source("drizzle/0025_learning_checkins.sql"), source("app/api/me/route.ts"),
  ]);
  assert.match(portal, /THREE SHORT RESEARCH MOMENTS/);
  assert.match(portal, /baseline/);
  assert.match(portal, /episode_reflection/);
  assert.match(portal, /transfer/);
  assert.match(portal, /No completion grade/);
  assert.doesNotMatch(portal, /Turn a busy day into visible progress/);
  assert.match(route, /scaffoldLevel/);
  assert.match(route, /The linked Prompt does not belong to this participant/);
  assert.match(schema, /learningCheckins/);
  assert.match(migration, /CREATE TABLE `learning_checkins`/);
  assert.match(me, /learningCheckins/);
});

test("introduces FEVI before the portal and captures structured response feedback", async () => {
  const [portal, assistant, organizer, account, schema, feedbackMigration, orientationMigration, me] = await Promise.all([
    source("app/portal.tsx"), source("app/api/assistant/route.ts"), source("app/api/organizer/route.ts"),
    source("lib/account.ts"), source("db/schema.ts"), source("drizzle/0026_structured_assistant_feedback.sql"),
    source("drizzle/0027_fevi_orientation_acknowledgement.sql"), source("app/api/me/route.ts"),
  ]);
  assert.match(portal, /Use AI actively—not automatically/);
  assert.match(portal, /Formulate/);
  assert.match(portal, /Engage/);
  assert.match(portal, /Verify/);
  assert.match(portal, /Integrate/);
  assert.match(portal, /clearly labeled practice checks/);
  assert.match(portal, /You can skip it without losing access to help/);
  assert.match(portal, /Partly helpful/);
  assert.match(portal, /Unclear next step/);
  assert.match(assistant, /partly_helpful/);
  assert.match(assistant, /reasonCode/);
  assert.match(organizer, /reason_code AS reasonCode/);
  assert.match(account, /orientationCompleted/);
  assert.match(schema, /participantOrientationAcknowledgements/);
  assert.match(feedbackMigration, /reason_code/);
  assert.match(orientationMigration, /participant_orientation_acknowledgements/);
  assert.match(me, /assistantFeedback/);
});

test("ships a consent-gated ClawMax enrollment and normalization path", async () => {
  const [portal, receiver, enrollment, receipt, purge, migration] = await Promise.all([
    source("app/portal.tsx"), source("app/api/clawmax/activity-events/route.ts"),
    source("app/api/clawmax/enrollments/exchange/route.ts"), source("app/api/clawmax/consent-receipts/route.ts"),
    source("lib/clawmax-purge.ts"),
    source("drizzle/0021_clawmax_partner_enrollment.sql"),
  ]);
  assert.match(portal, /Open ClawMax & connect/);
  assert.match(portal, /No code, API key, or password needs to be copied/);
  assert.doesNotMatch(portal, /ONE-TIME CONNECTION CODE/);
  assert.match(portal, /Review and accept the data policy/);
  assert.match(portal, /Read and review consent/);
  assert.match(portal, /Save consent/);
  assert.match(portal, /Consent, delivery, normalization, and deletion/);
  assert.match(enrollment, /status='consumed'/);
  assert.match(receipt, /clawmax_consent_receipts/);
  assert.match(receiver, /authorizeEventWithReceipt/);
  assert.match(receiver, /source_platform: "clawmax"/);
  assert.match(purge, /DELETE FROM clawmax_ingestion_events/);
  assert.match(purge, /Remote deletion remains pending/);
  assert.match(portal, /Revocation & deletion status/);
  assert.match(migration, /clawmax_partner_enrollments/);
  assert.match(migration, /clawmax_purge_jobs/);
});

test("verifies email and resets passwords with hashed one-time tokens", async () => {
  const [password, emailRoute, emailService, migration, portal, config] = await Promise.all([
    source("app/api/auth/password/route.ts"), source("app/api/auth/email/route.ts"), source("lib/auth-email.ts"),
    source("drizzle/0024_auth_recovery_onboarding_team.sql"), source("app/portal.tsx"), source("app/api/auth/config/route.ts"),
  ]);
  assert.match(password, /email_verification_required/);
  assert.match(password, /Registration email is not configured yet/);
  assert.match(emailService, /verify_email.*24 \* 60 \* 60 \* 1000/s);
  assert.match(emailService, /reset_password.*30 \* 60 \* 1000/s);
  assert.match(emailService, /sha256\(token\)/);
  assert.doesNotMatch(emailService, /token\s*:\s*token/);
  assert.match(emailRoute, /revoked_at=.*auth_sessions|UPDATE auth_sessions SET revoked_at/s);
  assert.match(emailRoute, /link is invalid or has expired/);
  assert.match(emailRoute, /link has already been used/);
  assert.match(migration, /auth_action_tokens/);
  assert.match(portal, /Forgot password/);
  assert.match(portal, /Resend verification email/);
  assert.match(password, /AUTH_REQUIRE_EMAIL_VERIFICATION/);
  assert.match(password, /AUTH_EMAIL_VERIFICATION_BYPASS_EMAILS/);
  assert.match(password, /temporarily_paused/);
  assert.match(config, /emailVerificationRequired/);
  assert.match(portal, /Email verification is temporarily paused for the Organizer dry run/);
});

test("saves resumable onboarding and keeps participant-controlled revision history", async () => {
  const [portal, onboarding, migration] = await Promise.all([
    source("app/portal.tsx"), source("app/api/onboarding/route.ts"), source("drizzle/0024_auth_recovery_onboarding_team.sql"),
  ]);
  assert.match(portal, /Save & continue later/);
  assert.match(portal, /Required/);
  assert.match(portal, /Optional/);
  assert.match(portal, /My profile & response preferences/);
  assert.match(portal, /participant_settings/);
  assert.match(onboarding, /participant_onboarding_drafts/);
  assert.match(onboarding, /participant_onboarding_revisions/);
  assert.match(onboarding, /Please answer every required onboarding question/);
  assert.match(migration, /participant_onboarding_drafts/);
  assert.match(migration, /participant_onboarding_revisions/);
});

test("enforces one active team and organizer-audited team moves", async () => {
  const [account, event, portal, migration] = await Promise.all([
    source("app/api/account/route.ts"), source("app/api/event/route.ts"), source("app/portal.tsx"), source("drizzle/0024_auth_recovery_onboarding_team.sql"),
  ]);
  assert.match(account, /You already have an active workspace/);
  assert.match(account, /personal workspace/);
  assert.match(event, /action === "move_team"/);
  assert.match(event, /end_reason='switched'/);
  assert.match(event, /change_reason/);
  assert.match(portal, /Create personal workspace/);
  assert.match(portal, /Earlier records stay linked to the previous team/);
  assert.match(migration, /workspace_kind/);
  assert.match(migration, /change_reason/);
});

test("builds a resumable participant-authored Agent Blueprint with optional inspiration", async () => {
  const [portal, canvas, schema, migration, me, styles] = await Promise.all([
    source("app/portal.tsx"), source("app/api/canvas/route.ts"), source("db/schema.ts"),
    source("drizzle/0028_agent_design_blueprint.sql"), source("app/api/me/route.ts"), source("app/globals.css"),
  ]);
  assert.match(portal, /Design Your Agent/);
  assert.match(portal, /one question at a time/i);
  assert.match(portal, /PARTICIPANT AGENT BLUEPRINT/);
  assert.match(portal, /I need an example/);
  assert.doesNotMatch(portal, /docs\.google\.com\/document\/d\/1Y7Cfkbg5sqrW9xliJhMAlbSepcigFmvqMp9TxrEhSrM/);
  assert.match(portal, /Use Case Illustrations/);
  assert.match(portal, /ILLUSTRATIONS · NOT TEMPLATES/);
  assert.match(portal, /WHAT WOULD COUNT AS EVIDENCE/);
  assert.match(portal, /No ready-made prompt/);
  assert.match(portal, /Daily GTM Brief/);
  assert.match(portal, /Import POs into QuickBooks/);
  assert.match(portal, /Human checkpoints/);
  assert.match(portal, /Success & failure test/);
  assert.match(portal, /Select one or more settings/);
  assert.match(portal, /OTHER SETTINGS · UP TO 3/);
  assert.match(portal, /customOther\.length < 3/);
  assert.match(portal, /OPTIONAL AI SCAFFOLD/);
  assert.match(portal, /Clarify this question/);
  assert.match(portal, /Give me two directions/);
  assert.match(portal, /Challenge my answer/);
  assert.match(portal, /Support is fading/);
  assert.match(portal, /Draft first · critique only/);
  assert.match(portal, /Review gaps with AI/);
  assert.doesNotMatch(portal, /Other or mixed/);
  assert.doesNotMatch(portal, /DRAFT BUILD BRIEF/);
  assert.match(canvas, /draft_autosave/);
  assert.match(canvas, /example_opened/);
  assert.match(canvas, /answer_revisited/);
  assert.match(canvas, /ai_scaffold_opened/);
  assert.match(canvas, /scaffoldAction/);
  assert.match(canvas, /supportLevel/);
  assert.match(canvas, /customOther/);
  assert.match(canvas, /blueprint_revised/);
  assert.match(canvas, /superseded_by_id/);
  assert.match(schema, /agentDesignBlueprints/);
  assert.match(schema, /agentDesignEvents/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `agent_design_blueprints`/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `agent_design_events`/);
  assert.match(me, /agentDesignEvents/);
  assert.match(styles, /\.agent-design-workspace/);
  assert.match(styles, /\.agent-blueprint-live/);
  assert.match(styles, /\.blueprint-ai-scaffold/);
});

test("gives Ask AI one participant context while fading Blueprint support", async () => {
  const [portal, assistant] = await Promise.all([
    source("app/portal.tsx"), source("app/api/assistant/route.ts"),
  ]);
  assert.match(portal, /scaffoldSupportForStep/);
  assert.match(portal, /guided/);
  assert.match(portal, /reduced/);
  assert.match(portal, /independent/);
  assert.match(portal, /Shared participant context/);
  assert.match(assistant, /participant_onboarding_profiles/);
  assert.match(assistant, /agent_design_blueprints/);
  assert.match(assistant, /learner_notes/);
  assert.match(assistant, /learning_checkins/);
  assert.match(assistant, /sharedParticipantContext/);
  assert.match(assistant, /Critique the participant's existing draft only/);
  assert.match(assistant, /sharedParticipantContextUsed: true/);
});

test("keeps a private Learner Center for notes and Ask AI history", async () => {
  const [portal, api, schema, migration, me, styles] = await Promise.all([
    source("app/portal.tsx"), source("app/api/learning-center/route.ts"), source("db/schema.ts"),
    source("drizzle/0029_learner_center.sql"), source("app/api/me/route.ts"), source("app/globals.css"),
  ]);
  assert.match(portal, /Learner Center/);
  assert.match(portal, /YOUR PRIVATE LEARNING RECORD/);
  assert.match(portal, /My Notes/);
  assert.match(portal, /Ask AI History/);
  assert.match(portal, /Save to Learner Center/);
  assert.match(api, /requireCurrentAccount/);
  assert.match(api, /WHERE event_participant_id=\?/);
  assert.match(api, /sourceType === "selection"/);
  assert.match(schema, /learnerNotes/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS `learner_notes`/);
  assert.match(me, /learnerNotes/);
  assert.match(styles, /\.learner-center-page/);
  assert.match(styles, /\.selection-coach/);
});

test("enforces the 35-workspace event capacity at the database boundary", async () => {
  const [migration, account, event, portal] = await Promise.all([
    source("drizzle/0031_team_capacity_and_submissions.sql"), source("app/api/account/route.ts"),
    source("app/api/event/route.ts"), source("app/portal.tsx"),
  ]);
  assert.match(migration, /max_active_teams/);
  assert.match(migration, /CREATE TRIGGER `teams_active_capacity_guard`/);
  assert.match(migration, /RAISE\(ABORT,'TEAM_CAP_REACHED'\)/);
  assert.match(account, /teamCapacityResponse/);
  assert.match(event, /maxActiveTeams/);
  assert.match(portal, /target 25–30 at kickoff/);
});

test("stores one team artifact and a later shareable demo link", async () => {
  const [migration, api, portal, config, schema] = await Promise.all([
    source("drizzle/0031_team_capacity_and_submissions.sql"), source("app/api/submissions/route.ts"),
    source("app/portal.tsx"), source("wrangler.production.example.jsonc"), source("db/schema.ts"),
  ]);
  assert.match(migration, /CREATE TABLE `team_submissions`/);
  assert.match(migration, /team_submissions_event_team_unique/);
  assert.match(api, /MAX_FILE_BYTES = 25 \* 1024 \* 1024/);
  assert.match(api, /submit_link/);
  assert.match(api, /submit_file/);
  assert.match(api, /submit_demo/);
  assert.match(api, /AgentForge does not store the large video file|Google Drive, YouTube, Loom/);
  assert.match(portal, /Submit the build now/);
  assert.match(portal, /One record per active Team or Personal Workspace/);
  assert.match(portal, /Google Drive, YouTube, Loom/);
  assert.match(config, /agentforge-submissions-prod/);
  assert.match(schema, /teamSubmissions/);
  assert.match(schema, /maxActiveTeams/);
});

test("prioritizes a usable dry run with audited organizer fallbacks", async () => {
  const [portal, eventApi, organizerApi, assistantApi, selectionStyles, styles] = await Promise.all([
    source("app/portal.tsx"), source("app/api/event/route.ts"), source("app/api/organizer/route.ts"),
    source("app/api/assistant/route.ts"), source("app/selection-clawmax.css"), source("app/globals.css"),
  ]);
  const navBlock = portal.match(/const nav:[\s\S]*?\n\];/)?.[0] || "";
  assert.doesNotMatch(navBlock, /id: "coach"/);
  assert.match(portal, /Verify manually/);
  assert.match(portal, /Every override is audited/);
  assert.match(eventApi, /action === "verify_email"/);
  assert.match(eventApi, /organizer_override/);
  assert.match(eventApi, /UPDATE auth_action_tokens SET consumed_at/);
  assert.match(assistantApi, /under 160 words/);
  assert.match(assistantApi, /Math\.min\(configuredMaxOutputTokens, 900\)/);
  assert.match(organizerApi, /scheduleConfigured/);
  assert.match(organizerApi, /clawmaxConfigured/);
  assert.match(portal, /Email provider configured/);
  assert.match(portal, /ClawMax Cloud waiting for Max/);
  assert.match(selectionStyles, /min-height:46px/);
  assert.match(styles, /waiting-for-baseline/);
  assert.match(styles, /Team changes are Organizer-managed/);
});

test("labels Settings correctly in the shared Ask AI context", async () => {
  const portal = await source("app/portal.tsx");
  assert.match(portal, /view === "settings" \? "Settings"/);
});

test("separates organizer operations, evidence, submissions, and system health", async () => {
  const [portal, organizer, styles] = await Promise.all([
    source("app/portal.tsx"), source("app/api/organizer/route.ts"), source("app/globals.css"),
  ]);
  assert.match(portal, /AI Access & Usage/);
  assert.match(portal, /Prompt Evidence/);
  assert.match(portal, /Submissions/);
  assert.match(portal, /Systems & Privacy/);
  assert.match(portal, /participantDisplayName/);
  assert.match(portal, /feedbackByPrompt/);
  assert.match(organizer, /COALESCE\(ep\.display_name,p\.display_name,'Unknown participant'\)/);
  assert.match(organizer, /FROM team_submissions s LEFT JOIN teams/);
  assert.match(organizer, /downloadSubmission/);
  assert.match(styles, /organizer-section-tabs/);
  assert.match(styles, /evidence-row/);
});
