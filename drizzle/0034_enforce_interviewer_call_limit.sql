CREATE UNIQUE INDEX `participant_interview_followup_unique`
ON `participant_interview_events` (`participant_id`,`question_id`)
WHERE `event_type` IN ('followup_generated','followup_fallback');
