CREATE TABLE IF NOT EXISTS `agent_design_blueprints` (
	`event_participant_id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`team_id` text,
	`blueprint_version` text NOT NULL,
	`answers_json` text NOT NULL,
	`current_step` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`project_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`event_participant_id`) REFERENCES `event_participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `hackathon_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `agent_projects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `agent_design_blueprints_status_check` CHECK (`status` in ('draft','completed'))
);
CREATE INDEX IF NOT EXISTS `agent_design_blueprints_event_idx` ON `agent_design_blueprints` (`event_id`,`updated_at`);
CREATE INDEX IF NOT EXISTS `agent_design_blueprints_team_idx` ON `agent_design_blueprints` (`team_id`,`updated_at`);

CREATE TABLE IF NOT EXISTS `agent_design_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_participant_id` text NOT NULL,
	`event_id` text NOT NULL,
	`team_id` text,
	`event_type` text NOT NULL,
	`question_id` text,
	`payload_json` text NOT NULL,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`event_participant_id`) REFERENCES `event_participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `hackathon_events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `agent_design_events_type_check` CHECK (`event_type` in ('draft_autosave','answer_saved','example_opened','answer_revisited','blueprint_completed','blueprint_revised'))
);
CREATE INDEX IF NOT EXISTS `agent_design_events_participant_idx` ON `agent_design_events` (`event_participant_id`,`occurred_at`);
CREATE INDEX IF NOT EXISTS `agent_design_events_event_idx` ON `agent_design_events` (`event_id`,`event_type`,`occurred_at`);
