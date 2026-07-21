CREATE TABLE `assistant_feedback_events` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt_event_id` text NOT NULL,
	`anonymous_participant_id` text NOT NULL,
	`anonymous_team_id` text,
	`participant_display_name` text NOT NULL,
	`feedback` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`prompt_event_id`) REFERENCES `prompt_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `assistant_feedback_prompt_idx` ON `assistant_feedback_events` (`prompt_event_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `assistant_feedback_participant_idx` ON `assistant_feedback_events` (`anonymous_participant_id`,`created_at`);
