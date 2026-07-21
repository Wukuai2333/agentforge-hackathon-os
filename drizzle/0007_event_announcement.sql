ALTER TABLE `event_configuration` ADD `announcement_text` text;
--> statement-breakpoint
ALTER TABLE `event_configuration` ADD `announcement_active` integer DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE `event_configuration` ADD `announcement_updated_at` integer;
