CREATE TABLE `learning_checkins` (
	`id` text PRIMARY KEY NOT NULL,
	`event_participant_id` text NOT NULL,
	`team_id` text,
	`checkpoint_type` text NOT NULL,
	`stage` text NOT NULL,
	`prompt_event_id` text,
	`scaffold_level` text NOT NULL,
	`response_json` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`event_participant_id`) REFERENCES `event_participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prompt_event_id`) REFERENCES `prompt_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `learning_checkins_participant_idx` ON `learning_checkins` (`event_participant_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `learning_checkins_type_idx` ON `learning_checkins` (`checkpoint_type`,`created_at`);
