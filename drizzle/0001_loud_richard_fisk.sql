CREATE TABLE `agent_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`anonymous_participant_id` text NOT NULL,
	`team_id` text,
	`title` text NOT NULL,
	`problem` text NOT NULL,
	`current_workflow` text,
	`data_boundaries` text,
	`success_criteria` text,
	`memory_requirements` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
