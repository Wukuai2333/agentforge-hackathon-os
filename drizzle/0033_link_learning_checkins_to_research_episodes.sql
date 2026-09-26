ALTER TABLE `learning_checkins` ADD `research_episode_id` text REFERENCES `research_episodes`(`id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `learning_checkins_research_episode_unique` ON `learning_checkins` (`research_episode_id`);
