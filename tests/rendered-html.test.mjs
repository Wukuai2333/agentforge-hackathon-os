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
