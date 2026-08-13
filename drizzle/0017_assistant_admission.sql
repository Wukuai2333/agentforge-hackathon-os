CREATE TABLE IF NOT EXISTS `assistant_active_leases` (
	`participant_id` text PRIMARY KEY NOT NULL,
	`request_id` text NOT NULL,
	`acquired_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `assistant_active_leases_request_id_unique` ON `assistant_active_leases` (`request_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `assistant_active_leases_expires_idx` ON `assistant_active_leases` (`expires_at`);
--> statement-breakpoint
ALTER TABLE `organizer_settings` ADD COLUMN `max_output_tokens` integer DEFAULT 1500 NOT NULL;
