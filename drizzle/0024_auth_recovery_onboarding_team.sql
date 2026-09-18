ALTER TABLE `app_users` ADD COLUMN `email_verified_at` integer;
UPDATE `app_users` SET `email_verified_at`=COALESCE(`email_verified_at`, unixepoch() * 1000);

CREATE TABLE IF NOT EXISTS `auth_action_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`purpose` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `app_users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT `auth_action_tokens_purpose_check` CHECK (`purpose` in ('verify_email','reset_password'))
);
CREATE UNIQUE INDEX IF NOT EXISTS `auth_action_tokens_hash_unique` ON `auth_action_tokens` (`token_hash`);
CREATE INDEX IF NOT EXISTS `auth_action_tokens_user_purpose_idx` ON `auth_action_tokens` (`user_id`,`purpose`,`created_at`);
CREATE INDEX IF NOT EXISTS `auth_action_tokens_expires_idx` ON `auth_action_tokens` (`expires_at`);

CREATE TABLE IF NOT EXISTS `participant_onboarding_drafts` (
	`participant_id` text PRIMARY KEY NOT NULL,
	`onboarding_version` text NOT NULL,
	`answers_json` text NOT NULL,
	`current_step` integer DEFAULT 0 NOT NULL,
	`response_length` text DEFAULT 'brief' NOT NULL,
	`interaction_mode` text DEFAULT 'guide' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `event_participants`(`id`) ON UPDATE no action ON DELETE no action
);

CREATE TABLE IF NOT EXISTS `participant_onboarding_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`participant_id` text NOT NULL,
	`answers_json` text NOT NULL,
	`response_length` text NOT NULL,
	`interaction_mode` text NOT NULL,
	`change_source` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`participant_id`) REFERENCES `event_participants`(`id`) ON UPDATE no action ON DELETE no action
);
CREATE INDEX IF NOT EXISTS `participant_onboarding_revisions_participant_idx` ON `participant_onboarding_revisions` (`participant_id`,`created_at`);

ALTER TABLE `teams` ADD COLUMN `workspace_kind` text DEFAULT 'team' NOT NULL;
ALTER TABLE `teams` ADD COLUMN `invite_rotated_at` integer;
ALTER TABLE `team_membership_events` ADD COLUMN `change_reason` text;

INSERT OR IGNORE INTO `team_invites` (`id`,`event_id`,`team_id`,`code`,`created_by_participant_id`,`expires_at`,`created_at`)
SELECT 'migrated:' || t.id,t.event_id,t.id,t.invite_code,t.created_by_participant_id,
       COALESCE(t.data_expires_at, unixepoch() * 1000 + 31536000000),t.created_at
FROM teams t WHERE t.invite_code IS NOT NULL AND t.event_id IS NOT NULL AND t.created_by_participant_id IS NOT NULL;
