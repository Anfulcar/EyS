ALTER TABLE `campaigns` ADD `requests_paused` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `paused_by` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `paused_at` text;--> statement-breakpoint
UPDATE `campaigns` SET `status` = 'active' WHERE `kind` = 'sigtur_requests';