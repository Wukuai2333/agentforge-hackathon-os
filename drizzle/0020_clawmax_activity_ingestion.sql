CREATE TABLE IF NOT EXISTS `clawmax_ingestion_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`destination_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`request_hash` text NOT NULL,
	`schema_version` text NOT NULL,
	`sent_at` text,
	`received_at` integer NOT NULL,
	`status` text DEFAULT 'accepted' NOT NULL,
	`event_count` integer DEFAULT 0 NOT NULL,
	`accepted_count` integer DEFAULT 0 NOT NULL,
	`duplicate_count` integer DEFAULT 0 NOT NULL,
	CONSTRAINT `clawmax_ingestion_batches_status_check` CHECK (`status` in ('accepted','duplicate','rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_clawmax_batches_destination_batch`
ON `clawmax_ingestion_batches` (`destination_id`,`batch_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_clawmax_batches_received`
ON `clawmax_ingestion_batches` (`received_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `clawmax_ingestion_events` (
	`id` text PRIMARY KEY NOT NULL,
	`destination_id` text NOT NULL,
	`event_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`event_hash` text NOT NULL,
	`schema_version` text NOT NULL,
	`source` text NOT NULL,
	`occurred_at` text NOT NULL,
	`external_workspace_id` text NOT NULL,
	`external_user_id` text NOT NULL,
	`session_id` text,
	`subject_id` text,
	`consent_receipt_id` text NOT NULL,
	`content_text` text,
	`metadata_json` text,
	`sanitized_event_json` text NOT NULL,
	`normalization_status` text DEFAULT 'quarantined' NOT NULL,
	`received_at` integer NOT NULL,
	CONSTRAINT `clawmax_ingestion_events_normalization_check` CHECK (`normalization_status` in ('quarantined','mapped','normalized','rejected'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `idx_clawmax_events_destination_event`
ON `clawmax_ingestion_events` (`destination_id`,`event_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_clawmax_events_receipt`
ON `clawmax_ingestion_events` (`consent_receipt_id`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_clawmax_events_external_user`
ON `clawmax_ingestion_events` (`destination_id`,`external_user_id`,`occurred_at`);
