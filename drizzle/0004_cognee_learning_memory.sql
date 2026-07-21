CREATE TABLE `cognee_sync_outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`dataset_name` text NOT NULL,
	`payload_json` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`created_at` integer NOT NULL,
	`synced_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cognee_sync_source_unique` ON `cognee_sync_outbox` (`source_type`,`source_id`);
--> statement-breakpoint
CREATE INDEX `cognee_sync_status_idx` ON `cognee_sync_outbox` (`status`,`created_at`);
--> statement-breakpoint
CREATE TABLE `participant_model_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`anonymous_participant_id` text NOT NULL,
	`anonymous_team_id` text,
	`entry_kind` text NOT NULL,
	`category` text NOT NULL,
	`statement` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text,
	`confidence_percent` integer,
	`confirmed_by_participant` integer DEFAULT false NOT NULL,
	`superseded_by_id` text,
	`observed_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `participant_model_participant_idx` ON `participant_model_entries` (`anonymous_participant_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `participant_model_kind_idx` ON `participant_model_entries` (`entry_kind`);
--> statement-breakpoint
CREATE TABLE `learning_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`page` text NOT NULL,
	`tutorial_step` text,
	`window_started_at` integer NOT NULL,
	`window_ended_at` integer NOT NULL,
	`prompt_count` integer NOT NULL,
	`participant_count` integer NOT NULL,
	`error_count` integer NOT NULL,
	`negative_feedback_count` integer NOT NULL,
	`detection_rule` text NOT NULL,
	`cognee_summary` text,
	`suggested_action` text,
	`review_status` text DEFAULT 'detected' NOT NULL,
	`created_at` integer NOT NULL,
	`reviewed_at` integer
);
--> statement-breakpoint
CREATE INDEX `learning_signals_created_idx` ON `learning_signals` (`created_at`);
