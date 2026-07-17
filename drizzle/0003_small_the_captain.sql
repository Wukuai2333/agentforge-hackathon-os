CREATE TABLE `organizer_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`assistant_enabled` integer DEFAULT true NOT NULL,
	`default_team_token_quota` integer DEFAULT 100000 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shared_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`content` text NOT NULL,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`source_prompt_event_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shared_notes_team_created_idx` ON `shared_notes` (`team_id`,`created_at`);