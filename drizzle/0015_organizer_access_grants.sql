CREATE TABLE IF NOT EXISTS `organizer_access_grants` (
	`email` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`granted_by_participant_id` text,
	`granted_by_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `organizer_access_grants_status_idx` ON `organizer_access_grants` (`status`,`updated_at`);
