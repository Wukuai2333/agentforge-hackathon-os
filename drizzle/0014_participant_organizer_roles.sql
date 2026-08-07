UPDATE `app_users` SET `role`='participant' WHERE `role`='mentor';
--> statement-breakpoint
UPDATE `event_participants` SET `role`='participant' WHERE `role`='mentor';
