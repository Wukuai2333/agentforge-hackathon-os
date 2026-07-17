CREATE TABLE `event_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`identity_provider` text,
	`identity_subject` text,
	`email` text,
	`display_name` text NOT NULL,
	`role` text DEFAULT 'participant' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`consent_version` text NOT NULL,
	`joined_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `hackathon_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `event_participants_identity_unique` ON `event_participants` (`event_id`,`identity_provider`,`identity_subject`);--> statement-breakpoint
CREATE INDEX `event_participants_event_idx` ON `event_participants` (`event_id`);--> statement-breakpoint
CREATE TABLE `hackathon_events` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer NOT NULL,
	`retention_ends_at` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hackathon_events_slug_unique` ON `hackathon_events` (`slug`);--> statement-breakpoint
CREATE TABLE `team_invites` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`team_id` text NOT NULL,
	`code` text NOT NULL,
	`created_by_participant_id` text NOT NULL,
	`max_uses` integer,
	`use_count` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `hackathon_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by_participant_id`) REFERENCES `event_participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_invites_code_unique` ON `team_invites` (`code`);--> statement-breakpoint
CREATE INDEX `team_invites_team_idx` ON `team_invites` (`team_id`);--> statement-breakpoint
CREATE TABLE `team_membership_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`from_team_id` text,
	`to_team_id` text,
	`action` text NOT NULL,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `hackathon_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participant_id`) REFERENCES `event_participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`from_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `team_membership_events_participant_idx` ON `team_membership_events` (`participant_id`);--> statement-breakpoint
CREATE TABLE `team_memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`team_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`membership_role` text DEFAULT 'member' NOT NULL,
	`joined_at` integer NOT NULL,
	`ended_at` integer,
	`end_reason` text,
	FOREIGN KEY (`event_id`) REFERENCES `hackathon_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participant_id`) REFERENCES `event_participants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_memberships_one_active_per_person` ON `team_memberships` (`participant_id`) WHERE "team_memberships"."ended_at" IS NULL;--> statement-breakpoint
CREATE INDEX `team_memberships_team_idx` ON `team_memberships` (`team_id`);--> statement-breakpoint
CREATE INDEX `team_memberships_event_idx` ON `team_memberships` (`event_id`);--> statement-breakpoint
ALTER TABLE `teams` ADD `event_id` text REFERENCES hackathon_events(id);--> statement-breakpoint
ALTER TABLE `teams` ADD `created_by_participant_id` text REFERENCES event_participants(id);--> statement-breakpoint
ALTER TABLE `teams` ADD `invite_code` text;--> statement-breakpoint
ALTER TABLE `teams` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `teams` ADD `archived_at` integer;--> statement-breakpoint
ALTER TABLE `teams` ADD `data_expires_at` integer;--> statement-breakpoint
ALTER TABLE `teams` ADD `updated_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `teams_invite_code_unique` ON `teams` (`invite_code`);