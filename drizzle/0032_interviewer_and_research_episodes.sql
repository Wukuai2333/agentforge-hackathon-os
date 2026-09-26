CREATE TABLE `participant_interview_events` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`team_id` text,
	`event_type` text NOT NULL,
	`question_id` text NOT NULL,
	`question_version` text NOT NULL,
	`prompt_text` text,
	`required` integer DEFAULT false NOT NULL,
	`source` text NOT NULL,
	`branch_rule` text,
	`answer_value` text,
	`model_name` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`consent_version` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `event_participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `participant_interview_events_type_check` CHECK (`event_type` IN ('question_shown','answer_saved','answer_skipped','followup_generated','followup_fallback')),
	CONSTRAINT `participant_interview_events_source_check` CHECK (`source` IN ('fixed','deterministic','ai'))
);
--> statement-breakpoint
CREATE INDEX `participant_interview_events_participant_idx` ON `participant_interview_events` (`participant_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `participant_interview_events_question_idx` ON `participant_interview_events` (`participant_id`,`question_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `research_episodes` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`team_id` text,
	`episode_type` text NOT NULL,
	`scaffold_level` text NOT NULL,
	`fevi_stage` text,
	`source_page` text,
	`source_prompt_event_id` text,
	`status` text DEFAULT 'eligible' NOT NULL,
	`stimulus_json` text,
	`response_json` text,
	`started_at` integer,
	`submitted_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `event_participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`source_prompt_event_id`) REFERENCES `prompt_events`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `research_episodes_type_check` CHECK (`episode_type` IN ('scaffold','reflection','transfer')),
	CONSTRAINT `research_episodes_scaffold_check` CHECK (`scaffold_level` IN ('full','faded','none')),
	CONSTRAINT `research_episodes_status_check` CHECK (`status` IN ('eligible','shown','skipped','dismissed','submitted'))
);
--> statement-breakpoint
CREATE INDEX `research_episodes_participant_idx` ON `research_episodes` (`participant_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `research_episodes_type_idx` ON `research_episodes` (`episode_type`,`scaffold_level`,`created_at`);
