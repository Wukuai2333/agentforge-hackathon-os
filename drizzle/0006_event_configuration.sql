CREATE TABLE `event_configuration` (
	`id` text PRIMARY KEY NOT NULL,
	`event_name` text DEFAULT 'Personal Agent Hackathon' NOT NULL,
	`starts_at` integer,
	`ends_at` integer,
	`timezone` text DEFAULT 'America/New_York' NOT NULL,
	`discord_url` text,
	`registration_open` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `event_configuration` (`id`,`event_name`,`timezone`,`registration_open`,`updated_at`)
VALUES ('primary','Personal Agent Hackathon','America/New_York',1,0);
