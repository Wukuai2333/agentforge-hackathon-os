ALTER TABLE `prompt_events` ADD `parent_prompt_event_id` text;
--> statement-breakpoint
ALTER TABLE `prompt_events` ADD `conversation_id` text;
--> statement-breakpoint
ALTER TABLE `prompt_events` ADD `task_reference` text;
--> statement-breakpoint
ALTER TABLE `prompt_events` ADD `outcome_status` text;
--> statement-breakpoint
ALTER TABLE `prompt_events` ADD `outcome_evidence` text;
--> statement-breakpoint
CREATE INDEX `prompt_events_participant_created_idx` ON `prompt_events` (`anonymous_participant_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `prompt_events_parent_idx` ON `prompt_events` (`parent_prompt_event_id`);
--> statement-breakpoint
CREATE INDEX `prompt_events_conversation_idx` ON `prompt_events` (`conversation_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `prompt_coaching_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt_event_id` text NOT NULL,
	`evaluation_id` text,
	`participant_id` text NOT NULL,
	`action` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`prompt_event_id`) REFERENCES `prompt_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`evaluation_id`) REFERENCES `prompt_evaluations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `prompt_coaching_actions_prompt_idx` ON `prompt_coaching_actions` (`prompt_event_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `prompt_coaching_actions_participant_idx` ON `prompt_coaching_actions` (`participant_id`,`created_at`);
