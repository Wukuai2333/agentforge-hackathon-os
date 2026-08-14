UPDATE `event_participants`
SET `user_id` = NULL,
    `identity_provider` = NULL,
    `identity_subject` = NULL,
    `email` = NULL,
    `role` = 'participant',
    `status` = 'left',
    `updated_at` = CAST(strftime('%s','now') AS INTEGER) * 1000;
--> statement-breakpoint
UPDATE `auth_audit_logs`
SET `user_id` = NULL;
--> statement-breakpoint
DELETE FROM `auth_sessions`;
--> statement-breakpoint
DELETE FROM `user_credentials`;
--> statement-breakpoint
DELETE FROM `user_identities`;
--> statement-breakpoint
DELETE FROM `app_users`;
--> statement-breakpoint
DELETE FROM `organizer_access_grants`;
--> statement-breakpoint
INSERT INTO `organizer_access_grants`
  (`email`,`status`,`granted_by_participant_id`,`granted_by_name`,`created_at`,`updated_at`)
VALUES
  ('elaineren211super@gmail.com','active',NULL,'Account identity reset',
   CAST(strftime('%s','now') AS INTEGER) * 1000,
   CAST(strftime('%s','now') AS INTEGER) * 1000);
