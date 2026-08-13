CREATE TABLE IF NOT EXISTS `user_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `app_users`(`id`),
	`provider` text NOT NULL,
	`provider_subject` text NOT NULL,
	`provider_email` text,
	`linked_at` integer NOT NULL,
	`last_used_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_identities_provider_subject_unique` ON `user_identities` (`provider`,`provider_subject`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `user_identities_user_provider_unique` ON `user_identities` (`user_id`,`provider`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `user_identities_user_idx` ON `user_identities` (`user_id`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_credentials` (
	`user_id` text PRIMARY KEY NOT NULL REFERENCES `app_users`(`id`),
	`password_hash` text NOT NULL,
	`password_salt` text NOT NULL,
	`password_algorithm` text DEFAULT 'pbkdf2-sha256' NOT NULL,
	`password_iterations` integer NOT NULL,
	`password_updated_at` integer NOT NULL,
	`failed_attempt_count` integer DEFAULT 0 NOT NULL,
	`locked_until` integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `app_users`(`id`),
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`revoked_at` integer,
	`revoke_reason` text,
	`ip_hash` text,
	`user_agent` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `auth_sessions_token_hash_unique` ON `auth_sessions` (`token_hash`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `auth_sessions_user_active_idx` ON `auth_sessions` (`user_id`,`revoked_at`,`expires_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `auth_sessions_expires_idx` ON `auth_sessions` (`expires_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `auth_audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text REFERENCES `app_users`(`id`),
	`normalized_email_hash` text,
	`event_type` text NOT NULL,
	`result` text NOT NULL,
	`ip_hash` text,
	`session_id` text,
	`metadata_json` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `auth_audit_logs_user_created_idx` ON `auth_audit_logs` (`user_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `auth_audit_logs_type_created_idx` ON `auth_audit_logs` (`event_type`,`created_at`);
