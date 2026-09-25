CREATE TABLE `assistant_token_usage` (
	`scope_type` text NOT NULL,
	`scope_id` text NOT NULL,
	`used_tokens` integer NOT NULL DEFAULT 0,
	`reserved_tokens` integer NOT NULL DEFAULT 0,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`scope_type`, `scope_id`),
	CONSTRAINT `assistant_token_usage_scope_check` CHECK (`scope_type` in ('event','team','participant'))
);
--> statement-breakpoint
CREATE TABLE `assistant_token_reservations` (
	`request_id` text PRIMARY KEY NOT NULL,
	`prompt_event_id` text NOT NULL,
	`event_id` text NOT NULL,
	`participant_id` text NOT NULL,
	`team_id` text,
	`estimated_tokens` integer NOT NULL,
	`actual_tokens` integer,
	`status` text NOT NULL DEFAULT 'reserved',
	`expires_at` integer NOT NULL,
	`error_code` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `assistant_token_reservations_status_check` CHECK (`status` in ('reserved','processing','completed','failed','expired'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assistant_token_reservations_prompt_unique` ON `assistant_token_reservations` (`prompt_event_id`);
--> statement-breakpoint
CREATE INDEX `assistant_token_reservations_event_status_idx` ON `assistant_token_reservations` (`event_id`,`status`,`expires_at`);
--> statement-breakpoint
CREATE INDEX `assistant_token_reservations_team_status_idx` ON `assistant_token_reservations` (`team_id`,`status`,`expires_at`);
--> statement-breakpoint
CREATE INDEX `assistant_token_reservations_participant_status_idx` ON `assistant_token_reservations` (`participant_id`,`status`,`expires_at`);
--> statement-breakpoint
CREATE TRIGGER `assistant_reservation_created` AFTER INSERT ON `assistant_token_reservations`
BEGIN
  INSERT INTO assistant_token_usage(scope_type,scope_id,used_tokens,reserved_tokens,updated_at)
    VALUES('event',NEW.event_id,0,NEW.estimated_tokens,NEW.updated_at)
    ON CONFLICT(scope_type,scope_id) DO UPDATE SET reserved_tokens=reserved_tokens+NEW.estimated_tokens,updated_at=NEW.updated_at;
  INSERT INTO assistant_token_usage(scope_type,scope_id,used_tokens,reserved_tokens,updated_at)
    SELECT 'team',NEW.team_id,0,NEW.estimated_tokens,NEW.updated_at WHERE NEW.team_id IS NOT NULL
    ON CONFLICT(scope_type,scope_id) DO UPDATE SET reserved_tokens=reserved_tokens+NEW.estimated_tokens,updated_at=NEW.updated_at;
  INSERT INTO assistant_token_usage(scope_type,scope_id,used_tokens,reserved_tokens,updated_at)
    VALUES('participant',NEW.participant_id,0,NEW.estimated_tokens,NEW.updated_at)
    ON CONFLICT(scope_type,scope_id) DO UPDATE SET reserved_tokens=reserved_tokens+NEW.estimated_tokens,updated_at=NEW.updated_at;
END;
--> statement-breakpoint
CREATE TRIGGER `assistant_reservation_completed` AFTER UPDATE OF status ON `assistant_token_reservations`
WHEN OLD.status IN ('reserved','processing') AND NEW.status='completed'
BEGIN
  UPDATE assistant_token_usage SET reserved_tokens=MAX(0,reserved_tokens-OLD.estimated_tokens),used_tokens=used_tokens+COALESCE(NEW.actual_tokens,0),updated_at=NEW.updated_at
    WHERE scope_type='event' AND scope_id=NEW.event_id;
  UPDATE assistant_token_usage SET reserved_tokens=MAX(0,reserved_tokens-OLD.estimated_tokens),used_tokens=used_tokens+COALESCE(NEW.actual_tokens,0),updated_at=NEW.updated_at
    WHERE scope_type='team' AND scope_id=NEW.team_id;
  UPDATE assistant_token_usage SET reserved_tokens=MAX(0,reserved_tokens-OLD.estimated_tokens),used_tokens=used_tokens+COALESCE(NEW.actual_tokens,0),updated_at=NEW.updated_at
    WHERE scope_type='participant' AND scope_id=NEW.participant_id;
END;
--> statement-breakpoint
CREATE TRIGGER `assistant_reservation_released` AFTER UPDATE OF status ON `assistant_token_reservations`
WHEN OLD.status IN ('reserved','processing') AND NEW.status IN ('failed','expired')
BEGIN
  UPDATE assistant_token_usage SET reserved_tokens=MAX(0,reserved_tokens-OLD.estimated_tokens),updated_at=NEW.updated_at
    WHERE scope_type='event' AND scope_id=NEW.event_id;
  UPDATE assistant_token_usage SET reserved_tokens=MAX(0,reserved_tokens-OLD.estimated_tokens),updated_at=NEW.updated_at
    WHERE scope_type='team' AND scope_id=NEW.team_id;
  UPDATE assistant_token_usage SET reserved_tokens=MAX(0,reserved_tokens-OLD.estimated_tokens),updated_at=NEW.updated_at
    WHERE scope_type='participant' AND scope_id=NEW.participant_id;
END;
--> statement-breakpoint
ALTER TABLE `cognee_sync_outbox` ADD `claim_id` text;
--> statement-breakpoint
ALTER TABLE `cognee_sync_outbox` ADD `claimed_at` integer;
--> statement-breakpoint
CREATE INDEX `cognee_sync_claim_idx` ON `cognee_sync_outbox` (`claim_id`);
--> statement-breakpoint
CREATE INDEX `prompt_events_status_created_idx` ON `prompt_events` (`status`,`created_at`);
--> statement-breakpoint
CREATE INDEX `prompt_events_team_status_created_idx` ON `prompt_events` (`anonymous_team_id`,`status`,`created_at`);
--> statement-breakpoint
INSERT INTO assistant_token_usage(scope_type,scope_id,used_tokens,reserved_tokens,updated_at)
SELECT 'event',COALESCE((SELECT id FROM hackathon_events ORDER BY created_at LIMIT 1),'default'),COALESCE(SUM(COALESCE(input_tokens,0)+COALESCE(output_tokens,0)),0),0,CAST(strftime('%s','now') AS integer)*1000
FROM prompt_events WHERE status='success';
--> statement-breakpoint
INSERT INTO assistant_token_usage(scope_type,scope_id,used_tokens,reserved_tokens,updated_at)
SELECT 'team',anonymous_team_id,COALESCE(SUM(COALESCE(input_tokens,0)+COALESCE(output_tokens,0)),0),0,CAST(strftime('%s','now') AS integer)*1000
FROM prompt_events WHERE status='success' AND anonymous_team_id IS NOT NULL GROUP BY anonymous_team_id;
--> statement-breakpoint
INSERT INTO assistant_token_usage(scope_type,scope_id,used_tokens,reserved_tokens,updated_at)
SELECT 'participant',anonymous_participant_id,COALESCE(SUM(COALESCE(input_tokens,0)+COALESCE(output_tokens,0)),0),0,CAST(strftime('%s','now') AS integer)*1000
FROM prompt_events WHERE status='success' GROUP BY anonymous_participant_id;
