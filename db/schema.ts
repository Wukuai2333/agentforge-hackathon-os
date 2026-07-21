import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const hackathonEvents = sqliteTable("hackathon_events", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp" }).notNull(),
  retentionEndsAt: integer("retention_ends_at", { mode: "timestamp" }).notNull(),
  status: text("status", { enum: ["draft", "registration", "live", "ended", "archived"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const eventParticipants = sqliteTable("event_participants", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => hackathonEvents.id),
  identityProvider: text("identity_provider"),
  identitySubject: text("identity_subject"),
  email: text("email"),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["participant", "mentor", "organizer"] }).notNull().default("participant"),
  status: text("status", { enum: ["invited", "active", "suspended", "left"] }).notNull().default("active"),
  consentVersion: text("consent_version").notNull(),
  joinedAt: integer("joined_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  uniqueIndex("event_participants_identity_unique").on(table.eventId, table.identityProvider, table.identitySubject),
  index("event_participants_event_idx").on(table.eventId),
]);

export const teams = sqliteTable("teams", {
  id: text("id").primaryKey(),
  eventId: text("event_id").references(() => hackathonEvents.id),
  createdByParticipantId: text("created_by_participant_id").references(() => eventParticipants.id),
  name: text("name").notNull(),
  inviteCode: text("invite_code").unique(),
  status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
  dataExpiresAt: integer("data_expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export const teamMemberships = sqliteTable("team_memberships", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => hackathonEvents.id),
  teamId: text("team_id").notNull().references(() => teams.id),
  participantId: text("participant_id").notNull().references(() => eventParticipants.id),
  membershipRole: text("membership_role", { enum: ["creator", "member"] }).notNull().default("member"),
  joinedAt: integer("joined_at", { mode: "timestamp" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp" }),
  endReason: text("end_reason", { enum: ["left", "switched", "team_archived", "removed"] }),
}, (table) => [
  uniqueIndex("team_memberships_one_active_per_person")
    .on(table.participantId)
    .where(sql`${table.endedAt} IS NULL`),
  index("team_memberships_team_idx").on(table.teamId),
  index("team_memberships_event_idx").on(table.eventId),
]);

export const teamInvites = sqliteTable("team_invites", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => hackathonEvents.id),
  teamId: text("team_id").notNull().references(() => teams.id),
  code: text("code").notNull().unique(),
  createdByParticipantId: text("created_by_participant_id").notNull().references(() => eventParticipants.id),
  maxUses: integer("max_uses"),
  useCount: integer("use_count").notNull().default(0),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("team_invites_team_idx").on(table.teamId)]);

export const teamMembershipEvents = sqliteTable("team_membership_events", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => hackathonEvents.id),
  participantId: text("participant_id").notNull().references(() => eventParticipants.id),
  fromTeamId: text("from_team_id").references(() => teams.id),
  toTeamId: text("to_team_id").references(() => teams.id),
  action: text("action", { enum: ["created", "joined", "left", "switched", "removed"] }).notNull(),
  occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("team_membership_events_participant_idx").on(table.participantId)]);

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

export const agentProjects = sqliteTable("agent_projects", {
  id: text("id").primaryKey(),
  anonymousParticipantId: text("anonymous_participant_id").notNull(),
  teamId: text("team_id"),
  title: text("title").notNull(),
  problem: text("problem").notNull(),
  currentWorkflow: text("current_workflow"),
  dataBoundaries: text("data_boundaries"),
  successCriteria: text("success_criteria"),
  memoryRequirements: text("memory_requirements"),
  status: text("status", { enum: ["draft", "building", "submitted"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
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

export const sharedNotes = sqliteTable("shared_notes", {
  id: text("id").primaryKey(),
  teamId: text("team_id").notNull(),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  sourceType: text("source_type", { enum: ["manual", "assistant"] }).notNull().default("manual"),
  sourcePromptEventId: text("source_prompt_event_id"),
  attributionJson: text("attribution_json"),
  updatedById: text("updated_by_id"),
  updatedByName: text("updated_by_name"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
}, (table) => [
  index("shared_notes_team_created_idx").on(table.teamId, table.createdAt),
]);

export const sharedNoteRevisions = sqliteTable("shared_note_revisions", {
  id: text("id").primaryKey(),
  noteId: text("note_id").notNull(),
  teamId: text("team_id").notNull(),
  editorId: text("editor_id").notNull(),
  editorName: text("editor_name").notNull(),
  previousContent: text("previous_content").notNull(),
  nextContent: text("next_content").notNull(),
  attributionJson: text("attribution_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [index("shared_note_revisions_note_idx").on(table.noteId, table.createdAt)]);

export const organizerSettings = sqliteTable("organizer_settings", {
  id: text("id").primaryKey(),
  assistantEnabled: integer("assistant_enabled", { mode: "boolean" }).notNull().default(true),
  defaultTeamTokenQuota: integer("default_team_token_quota").notNull().default(100000),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Durable delivery queue: operational events remain authoritative in D1 while
// sanitized semantic records are delivered to Cognee independently.
export const cogneeSyncOutbox = sqliteTable("cognee_sync_outbox", {
  id: text("id").primaryKey(),
  sourceType: text("source_type", { enum: ["prompt_event", "participant_model", "shared_note"] }).notNull(),
  sourceId: text("source_id").notNull(),
  datasetName: text("dataset_name").notNull(),
  payloadJson: text("payload_json").notNull(),
  status: text("status", { enum: ["pending", "syncing", "synced", "error"] }).notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  syncedAt: integer("synced_at", { mode: "timestamp" }),
}, (table) => [
  uniqueIndex("cognee_sync_source_unique").on(table.sourceType, table.sourceId),
  index("cognee_sync_status_idx").on(table.status, table.createdAt),
]);

export const participantModelEntries = sqliteTable("participant_model_entries", {
  id: text("id").primaryKey(),
  anonymousParticipantId: text("anonymous_participant_id").notNull(),
  anonymousTeamId: text("anonymous_team_id"),
  entryKind: text("entry_kind", { enum: ["fact", "inference", "confirmation"] }).notNull(),
  category: text("category").notNull(),
  statement: text("statement").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: text("source_id"),
  confidencePercent: integer("confidence_percent"),
  confirmedByParticipant: integer("confirmed_by_participant", { mode: "boolean" }).notNull().default(false),
  supersededById: text("superseded_by_id"),
  observedAt: integer("observed_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => [
  index("participant_model_participant_idx").on(table.anonymousParticipantId, table.createdAt),
  index("participant_model_kind_idx").on(table.entryKind),
]);

export const learningSignals = sqliteTable("learning_signals", {
  id: text("id").primaryKey(),
  page: text("page").notNull(),
  tutorialStep: text("tutorial_step"),
  windowStartedAt: integer("window_started_at", { mode: "timestamp" }).notNull(),
  windowEndedAt: integer("window_ended_at", { mode: "timestamp" }).notNull(),
  promptCount: integer("prompt_count").notNull(),
  participantCount: integer("participant_count").notNull(),
  errorCount: integer("error_count").notNull(),
  negativeFeedbackCount: integer("negative_feedback_count").notNull(),
  detectionRule: text("detection_rule").notNull(),
  cogneeSummary: text("cognee_summary"),
  suggestedAction: text("suggested_action"),
  reviewStatus: text("review_status", { enum: ["detected", "reviewing", "approved", "rejected"] }).notNull().default("detected"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
}, (table) => [index("learning_signals_created_idx").on(table.createdAt)]);

export const eventConfiguration = sqliteTable("event_configuration", {
  id: text("id").primaryKey(),
  eventName: text("event_name").notNull().default("Personal Agent Hackathon"),
  startsAt: integer("starts_at", { mode: "timestamp" }),
  endsAt: integer("ends_at", { mode: "timestamp" }),
  timezone: text("timezone").notNull().default("America/New_York"),
  discordUrl: text("discord_url"),
  registrationOpen: integer("registration_open", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
