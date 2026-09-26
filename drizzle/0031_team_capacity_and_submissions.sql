ALTER TABLE `event_configuration` ADD `max_active_teams` integer DEFAULT 35 NOT NULL;
--> statement-breakpoint
CREATE TABLE `team_submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`team_id` text NOT NULL,
	`submitted_by_participant_id` text NOT NULL,
	`updated_by_participant_id` text NOT NULL,
	`artifact_kind` text NOT NULL,
	`artifact_url` text,
	`artifact_object_key` text,
	`artifact_filename` text,
	`artifact_mime_type` text,
	`artifact_size_bytes` integer,
	`notes` text,
	`artifact_submitted_at` integer NOT NULL,
	`demo_video_url` text,
	`demo_submitted_at` integer,
	`demo_due_at` integer NOT NULL,
	`status` text DEFAULT 'artifact_submitted' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `hackathon_events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`team_id`) REFERENCES `teams`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`submitted_by_participant_id`) REFERENCES `event_participants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by_participant_id`) REFERENCES `event_participants`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `team_submissions_artifact_kind_check` CHECK (`artifact_kind` IN ('file','link')),
	CONSTRAINT `team_submissions_status_check` CHECK (`status` IN ('artifact_submitted','complete')),
	CONSTRAINT `team_submissions_artifact_check` CHECK (
		(`artifact_kind`='link' AND `artifact_url` IS NOT NULL AND `artifact_object_key` IS NULL)
		OR (`artifact_kind`='file' AND `artifact_object_key` IS NOT NULL)
	)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_submissions_event_team_unique` ON `team_submissions` (`event_id`,`team_id`);
--> statement-breakpoint
CREATE INDEX `team_submissions_status_idx` ON `team_submissions` (`event_id`,`status`,`updated_at`);
--> statement-breakpoint
CREATE TRIGGER `teams_active_capacity_guard`
BEFORE INSERT ON `teams`
WHEN NEW.`status`='active'
AND (
	SELECT COUNT(*) FROM `teams`
	WHERE `event_id`=NEW.`event_id` AND `status`='active'
) >= COALESCE((
	SELECT `max_active_teams` FROM `event_configuration` WHERE `id`='primary'
),35)
BEGIN
	SELECT RAISE(ABORT,'TEAM_CAP_REACHED');
END;
