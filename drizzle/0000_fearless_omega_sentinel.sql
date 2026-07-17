CREATE TABLE `participants` (
	`id` text PRIMARY KEY NOT NULL,
	`anonymous_id` text NOT NULL,
	`team_id` text,
	`display_name` text,
	`consent_version` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `participants_anonymous_id_unique` ON `participants` (`anonymous_id`);--> statement-breakpoint
CREATE TABLE `progress_events` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`team_id` text,
	`milestone` text NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `prompt_events` (
	`id` text PRIMARY KEY NOT NULL,
	`anonymous_participant_id` text NOT NULL,
	`anonymous_team_id` text,
	`page` text NOT NULL,
	`tutorial_step` text,
	`user_prompt` text NOT NULL,
	`system_prompt_version` text NOT NULL,
	`context_type` text,
	`context_reference` text,
	`agent_name` text NOT NULL,
	`model_name` text,
	`dataset_id` text,
	`response_text` text,
	`latency_ms` integer,
	`input_tokens` integer,
	`output_tokens` integer,
	`estimated_cost_micros` integer,
	`status` text NOT NULL,
	`error_code` text,
	`user_feedback` text,
	`improvement_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tutorial_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`tutorial_slug` text NOT NULL,
	`version` text NOT NULL,
	`source_url` text NOT NULL,
	`source_checked_at` integer NOT NULL,
	`change_summary` text,
	`published_at` integer
);
