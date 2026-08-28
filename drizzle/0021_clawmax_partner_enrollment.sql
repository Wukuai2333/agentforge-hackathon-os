CREATE TABLE IF NOT EXISTS `clawmax_enrollment_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code_hash` text NOT NULL,
	`event_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`destination_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer NOT NULL,
	CONSTRAINT `clawmax_enrollment_codes_status_check` CHECK (`status` in ('active','consumed','expired','revoked')),
	FOREIGN KEY (`event_id`) REFERENCES `hackathon_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participant_id`) REFERENCES `event_participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_clawmax_enrollment_code_hash`
ON `clawmax_enrollment_codes` (`code_hash`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_clawmax_enrollment_codes_participant`
ON `clawmax_enrollment_codes` (`participant_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `clawmax_partner_enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`destination_id` text NOT NULL,
	`event_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`external_workspace_id` text NOT NULL,
	`external_user_id` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`revoked_at` integer,
	CONSTRAINT `clawmax_partner_enrollments_status_check` CHECK (`status` in ('active','revoked')),
	FOREIGN KEY (`event_id`) REFERENCES `hackathon_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participant_id`) REFERENCES `event_participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_clawmax_enrollment_external_identity`
ON `clawmax_partner_enrollments` (`destination_id`,`external_workspace_id`,`external_user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_clawmax_enrollment_participant`
ON `clawmax_partner_enrollments` (`participant_id`,`status`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `clawmax_consent_receipts` (
	`receipt_id` text PRIMARY KEY NOT NULL,
	`enrollment_id` text NOT NULL,
	`destination_id` text NOT NULL,
	`external_workspace_id` text NOT NULL,
	`external_user_id` text NOT NULL,
	`scopes_json` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`consent_version` text NOT NULL,
	`consented_at` integer NOT NULL,
	`expires_at` integer,
	`revoked_at` integer,
	`payload_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `clawmax_consent_receipts_status_check` CHECK (`status` in ('active','revoked','expired')),
	FOREIGN KEY (`enrollment_id`) REFERENCES `clawmax_partner_enrollments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_clawmax_receipts_enrollment_status`
ON `clawmax_consent_receipts` (`enrollment_id`,`status`);
--> statement-breakpoint
ALTER TABLE `clawmax_ingestion_events` ADD `event_id_internal` text;
--> statement-breakpoint
ALTER TABLE `clawmax_ingestion_events` ADD `participant_id` text;
--> statement-breakpoint
ALTER TABLE `clawmax_ingestion_events` ADD `team_id` text;
--> statement-breakpoint
ALTER TABLE `clawmax_ingestion_events` ADD `normalization_error` text;
--> statement-breakpoint
ALTER TABLE `clawmax_ingestion_events` ADD `normalized_at` integer;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_clawmax_events_normalization_status`
ON `clawmax_ingestion_events` (`normalization_status`,`received_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_clawmax_events_participant`
ON `clawmax_ingestion_events` (`participant_id`,`occurred_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `clawmax_purge_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`receipt_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`raw_events_purged` integer DEFAULT 0 NOT NULL,
	`normalized_records_purged` integer DEFAULT 0 NOT NULL,
	`cognee_records_pending` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL,
	`completed_at` integer,
	CONSTRAINT `clawmax_purge_jobs_status_check` CHECK (`status` in ('pending','processing','completed','error')),
	FOREIGN KEY (`receipt_id`) REFERENCES `clawmax_consent_receipts`(`receipt_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_clawmax_purge_jobs_status`
ON `clawmax_purge_jobs` (`status`,`created_at`);
