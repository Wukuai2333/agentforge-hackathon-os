CREATE TABLE IF NOT EXISTS `participant_onboarding_profiles` (
	`participant_id` text PRIMARY KEY NOT NULL,
	`onboarding_version` text NOT NULL,
	`answers_json` text NOT NULL,
	`response_length` text DEFAULT 'brief' NOT NULL,
	`interaction_mode` text DEFAULT 'guide' NOT NULL,
	`completed_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `participant_onboarding_response_length_check` CHECK (`response_length` in ('brief','balanced','detailed')),
	CONSTRAINT `participant_onboarding_interaction_mode_check` CHECK (`interaction_mode` in ('guide','collaborate','direct')),
	FOREIGN KEY (`participant_id`) REFERENCES `event_participants`(`id`) ON UPDATE no action ON DELETE no action
);
