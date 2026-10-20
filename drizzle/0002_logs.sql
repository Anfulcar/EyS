CREATE TABLE `activity_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`user_id` integer,
	`user_name` text,
	`action` text NOT NULL,
	`campaign_id` integer,
	`entity` text,
	`entity_id` text,
	`summary` text,
	`ip` text
);
--> statement-breakpoint
CREATE INDEX `activity_at` ON `activity_log` (`at`);--> statement-breakpoint
CREATE INDEX `activity_action` ON `activity_log` (`action`);--> statement-breakpoint
CREATE TABLE `error_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`source` text NOT NULL,
	`user_id` integer,
	`path` text,
	`message` text NOT NULL,
	`digest` text,
	`detail` text
);
--> statement-breakpoint
CREATE INDEX `errors_at` ON `error_log` (`at`);