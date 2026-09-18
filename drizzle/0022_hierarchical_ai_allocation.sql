ALTER TABLE `organizer_settings` ADD COLUMN `event_token_quota` integer DEFAULT 5000000 NOT NULL;
--> statement-breakpoint
ALTER TABLE `organizer_settings` ADD COLUMN `default_participant_token_quota` integer DEFAULT 25000 NOT NULL;
--> statement-breakpoint
ALTER TABLE `organizer_settings` ADD COLUMN `per_minute_request_limit` integer DEFAULT 10 NOT NULL;
--> statement-breakpoint
ALTER TABLE `organizer_settings` ADD COLUMN `per_hour_request_limit` integer DEFAULT 100 NOT NULL;
--> statement-breakpoint
ALTER TABLE `organizer_settings` ADD COLUMN `max_concurrent_requests` integer DEFAULT 2 NOT NULL;
