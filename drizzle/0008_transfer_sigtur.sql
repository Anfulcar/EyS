CREATE TABLE `api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`prefix` text NOT NULL,
	`hash` text NOT NULL,
	`created_by` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_hash_unique` ON `api_keys` (`hash`);--> statement-breakpoint
CREATE TABLE `integration_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`key_id` integer,
	`kind` text NOT NULL,
	`ok` integer NOT NULL,
	`summary` text
);
--> statement-breakpoint
CREATE INDEX `integration_log_at` ON `integration_log` (`at`);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `kind` text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `source` text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `source_ref` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `auto_assignees` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `transferred_to_campaign_id` integer;--> statement-breakpoint
ALTER TABLE `companies` ADD `origin_note` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `sigtur_request` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `requested_by` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `request_reason` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `requested_at` text;