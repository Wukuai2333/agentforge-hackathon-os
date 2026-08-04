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
