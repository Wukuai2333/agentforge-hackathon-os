import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const participants = sqliteTable("participants", {
  id: text("id").primaryKey(),
  anonymousId: text("anonymous_id").notNull().unique(),
  teamId: text("team_id").references(() => teams.id),
  displayName: text("display_name"),
  consentVersion: text("consent_version").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const progressEvents = sqliteTable("progress_events", {
  id: text("id").primaryKey(),
  participantId: text("participant_id").notNull().references(() => participants.id),
  teamId: text("team_id").references(() => teams.id),
  milestone: text("milestone").notNull(),
  status: text("status", { enum: ["started", "completed", "verified"] }).notNull(),
  source: text("source", { enum: ["manual", "clawmax", "cognee", "organizer"] }).notNull(),
  occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
});

export const promptEvents = sqliteTable("prompt_events", {
  id: text("id").primaryKey(),
  anonymousParticipantId: text("anonymous_participant_id").notNull(),
  anonymousTeamId: text("anonymous_team_id"),
  page: text("page").notNull(),
  tutorialStep: text("tutorial_step"),
  userPrompt: text("user_prompt").notNull(),
  systemPromptVersion: text("system_prompt_version").notNull(),
  contextType: text("context_type"),
  contextReference: text("context_reference"),
  agentName: text("agent_name").notNull(),
  modelName: text("model_name"),
  datasetId: text("dataset_id"),
  responseText: text("response_text"),
  latencyMs: integer("latency_ms"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  estimatedCostMicros: integer("estimated_cost_micros"),
  status: text("status", { enum: ["success", "error", "blocked"] }).notNull(),
  errorCode: text("error_code"),
  userFeedback: text("user_feedback", { enum: ["helpful", "not_helpful"] }),
  improvementId: text("improvement_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const tutorialVersions = sqliteTable("tutorial_versions", {
  id: text("id").primaryKey(),
  tutorialSlug: text("tutorial_slug").notNull(),
  version: text("version").notNull(),
  sourceUrl: text("source_url").notNull(),
  sourceCheckedAt: integer("source_checked_at", { mode: "timestamp" }).notNull(),
  changeSummary: text("change_summary"),
  publishedAt: integer("published_at", { mode: "timestamp" }),
});
