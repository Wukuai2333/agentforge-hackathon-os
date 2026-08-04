ALTER TABLE `shared_notes` ADD `revision` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE TABLE `participant_model_reviews` (
  `id` text PRIMARY KEY NOT NULL,
  `event_participant_id` text NOT NULL,
  `entry_id` text NOT NULL,
  `action` text NOT NULL,
  `replacement_entry_id` text,
  `note` text,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`event_participant_id`) REFERENCES `event_participants`(`id`),
  FOREIGN KEY (`entry_id`) REFERENCES `participant_model_entries`(`id`),
  FOREIGN KEY (`replacement_entry_id`) REFERENCES `participant_model_entries`(`id`)
);
--> statement-breakpoint
CREATE INDEX `participant_model_reviews_entry_idx` ON `participant_model_reviews` (`entry_id`,`created_at`);
--> statement-breakpoint
CREATE TABLE `learning_signal_evidence` (
  `id` text PRIMARY KEY NOT NULL,
  `signal_id` text NOT NULL,
  `prompt_event_id` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`signal_id`) REFERENCES `learning_signals`(`id`),
  FOREIGN KEY (`prompt_event_id`) REFERENCES `prompt_events`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_signal_evidence_unique` ON `learning_signal_evidence` (`signal_id`,`prompt_event_id`);
--> statement-breakpoint
CREATE INDEX `learning_signal_evidence_signal_idx` ON `learning_signal_evidence` (`signal_id`);
--> statement-breakpoint
CREATE TABLE `prompt_clusters` (
  `id` text PRIMARY KEY NOT NULL,
  `page` text NOT NULL,
  `tutorial_step` text,
  `category` text NOT NULL,
  `label` text NOT NULL,
  `prompt_count` integer NOT NULL,
  `participant_count` integer NOT NULL,
  `error_count` integer NOT NULL,
  `examples_json` text NOT NULL,
  `window_started_at` integer NOT NULL,
  `window_ended_at` integer NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `prompt_clusters_created_idx` ON `prompt_clusters` (`created_at`);
