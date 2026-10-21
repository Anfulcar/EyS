CREATE TABLE `generated_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`template_id` integer,
	`name` text NOT NULL,
	`period_label` text,
	`format` text NOT NULL,
	`file_name` text NOT NULL,
	`content` blob NOT NULL,
	`source` text NOT NULL,
	`created_by` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `generated_reports_at` ON `generated_reports` (`created_at`);--> statement-breakpoint
CREATE TABLE `report_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`options` text NOT NULL,
	`frequency` text DEFAULT 'none' NOT NULL,
	`run_day` integer,
	`next_run_on` text,
	`paused` integer DEFAULT false NOT NULL,
	`created_by` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `users` ADD `reports_seen_at` text;