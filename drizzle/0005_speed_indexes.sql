CREATE INDEX `attempts_user` ON `call_attempts` (`user_id`);--> statement-breakpoint
CREATE INDEX `results_attempt` ON `call_results` (`attempt_id`);--> statement-breakpoint
CREATE INDEX `companies_user` ON `companies` (`assigned_user_id`);--> statement-breakpoint
CREATE INDEX `phones_campaign` ON `phones` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `status_changes_campaign` ON `status_changes` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `visits_campaign` ON `visits` (`campaign_id`);