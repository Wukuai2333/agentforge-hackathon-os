ALTER TABLE `shared_notes` ADD `attribution_json` text;
--> statement-breakpoint
ALTER TABLE `shared_notes` ADD `updated_by_id` text;
--> statement-breakpoint
ALTER TABLE `shared_notes` ADD `updated_by_name` text;
--> statement-breakpoint
ALTER TABLE `shared_notes` ADD `updated_at` integer;
--> statement-breakpoint
CREATE TABLE `shared_note_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`note_id` text NOT NULL,
	`team_id` text NOT NULL,
	`editor_id` text NOT NULL,
	`editor_name` text NOT NULL,
	`previous_content` text NOT NULL,
	`next_content` text NOT NULL,
	`attribution_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shared_note_revisions_note_idx` ON `shared_note_revisions` (`note_id`,`created_at`);
