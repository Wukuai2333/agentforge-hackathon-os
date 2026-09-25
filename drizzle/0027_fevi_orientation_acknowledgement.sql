CREATE TABLE `participant_orientation_acknowledgements` (
  `participant_id` text PRIMARY KEY NOT NULL,
  `orientation_version` text NOT NULL,
  `acknowledged_at` integer NOT NULL,
  FOREIGN KEY (`participant_id`) REFERENCES `event_participants`(`id`) ON UPDATE no action ON DELETE cascade
);
