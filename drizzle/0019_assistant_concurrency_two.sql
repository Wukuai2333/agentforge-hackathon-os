CREATE TABLE `assistant_active_leases_next` (
	`request_id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`acquired_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
INSERT OR IGNORE INTO `assistant_active_leases_next` (`request_id`,`participant_id`,`acquired_at`,`expires_at`)
SELECT `request_id`,`participant_id`,`acquired_at`,`expires_at` FROM `assistant_active_leases`;
--> statement-breakpoint
DROP TABLE `assistant_active_leases`;
--> statement-breakpoint
ALTER TABLE `assistant_active_leases_next` RENAME TO `assistant_active_leases`;
--> statement-breakpoint
CREATE INDEX `assistant_active_leases_participant_expires_idx` ON `assistant_active_leases` (`participant_id`,`expires_at`);
--> statement-breakpoint
CREATE INDEX `assistant_active_leases_expires_idx` ON `assistant_active_leases` (`expires_at`);
