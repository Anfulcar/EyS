ALTER TABLE `call_attempts` ADD `reviewed_at` text;--> statement-breakpoint
ALTER TABLE `call_attempts` ADD `reviewed_by` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `call_attempts` ADD `review_comment` text;--> statement-breakpoint
CREATE INDEX `attempts_called_at` ON `call_attempts` (`called_at`);