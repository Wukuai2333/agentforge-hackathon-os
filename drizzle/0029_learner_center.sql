CREATE TABLE IF NOT EXISTS `learner_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`event_participant_id` text NOT NULL,
	`event_id` text NOT NULL,
	`content` text NOT NULL,
	`selected_text` text,
	`source_type` text DEFAULT 'manual' NOT NULL,
	`source_page` text,
	`source_prompt_event_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`event_participant_id`) REFERENCES `event_participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `hackathon_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_prompt_event_id`) REFERENCES `prompt_events`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `learner_notes_source_check` CHECK (`source_type` in ('manual','selection','assistant'))
);
CREATE INDEX IF NOT EXISTS `learner_notes_participant_idx` ON `learner_notes` (`event_participant_id`,`updated_at`);
CREATE INDEX IF NOT EXISTS `learner_notes_prompt_idx` ON `learner_notes` (`source_prompt_event_id`);
