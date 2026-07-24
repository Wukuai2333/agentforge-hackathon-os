CREATE TABLE `prompt_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`prompt_event_id` text NOT NULL,
	`rubric_version` text NOT NULL,
	`evaluator` text NOT NULL,
	`evaluation_json` text NOT NULL,
	`total_score` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`prompt_event_id`) REFERENCES `prompt_events`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prompt_evaluations_prompt_rubric_unique` ON `prompt_evaluations` (`prompt_event_id`,`rubric_version`);
--> statement-breakpoint
CREATE INDEX `prompt_evaluations_created_idx` ON `prompt_evaluations` (`created_at`);
