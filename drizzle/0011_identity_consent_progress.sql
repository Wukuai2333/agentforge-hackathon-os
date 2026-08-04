CREATE TABLE `app_users` (
	`id` text PRIMARY KEY NOT NULL,
	`identity_provider` text NOT NULL,
	`identity_subject` text NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'participant' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_identity_unique` ON `app_users` (`identity_provider`,`identity_subject`);
--> statement-breakpoint
CREATE UNIQUE INDEX `app_users_email_unique` ON `app_users` (`email`);
--> statement-breakpoint
ALTER TABLE `event_participants` ADD `user_id` text REFERENCES app_users(id);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_participants_user_event_unique` ON `event_participants` (`event_id`,`user_id`);
--> statement-breakpoint
CREATE TABLE `consent_records` (
	`id` text PRIMARY KEY NOT NULL,
	`event_participant_id` text NOT NULL,
	`policy_version` text NOT NULL,
	`status` text NOT NULL,
	`choices_json` text NOT NULL,
	`recorded_at` integer NOT NULL,
	FOREIGN KEY (`event_participant_id`) REFERENCES `event_participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `consent_records_participant_idx` ON `consent_records` (`event_participant_id`,`recorded_at`);
--> statement-breakpoint
CREATE TABLE `event_progress_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_participant_id` text NOT NULL,
	`team_id` text,
	`milestone` text NOT NULL,
	`status` text NOT NULL,
	`source` text NOT NULL,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`event_participant_id`) REFERENCES `event_participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `event_progress_participant_idx` ON `event_progress_events` (`event_participant_id`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `event_progress_team_idx` ON `event_progress_events` (`team_id`,`occurred_at`);
