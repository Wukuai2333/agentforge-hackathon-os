CREATE TABLE `event_announcement_history` (
	`id` text PRIMARY KEY NOT NULL,
	`announcement_text` text,
	`action` text NOT NULL,
	`active` integer NOT NULL,
	`editor_name` text DEFAULT 'Organizer' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `event_announcement_history_created_idx` ON `event_announcement_history` (`created_at`);
