ALTER TABLE `research_episodes` ADD `client_key` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `research_episodes_participant_client_unique` ON `research_episodes` (`participant_id`,`client_key`);
--> statement-breakpoint
CREATE TABLE `research_episode_events` (
	`id` text PRIMARY KEY NOT NULL,
	`research_episode_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`event_type` text NOT NULL,
	`metadata_json` text,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`research_episode_id`) REFERENCES `research_episodes`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`participant_id`) REFERENCES `event_participants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `research_episode_events_type_check` CHECK (`event_type` IN ('offered','opened','viewed','dismissed','skipped','acted_on','decision_recorded','verification_recorded','revision_linked'))
);
--> statement-breakpoint
CREATE INDEX `research_episode_events_episode_idx` ON `research_episode_events` (`research_episode_id`,`occurred_at`);
--> statement-breakpoint
CREATE INDEX `research_episode_events_participant_idx` ON `research_episode_events` (`participant_id`,`occurred_at`);
