CREATE TABLE `absences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`from_date` text NOT NULL,
	`to_date` text NOT NULL,
	`kind` text NOT NULL,
	`note` text,
	`created_by` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `absences_user` ON `absences` (`user_id`);--> statement-breakpoint
ALTER TABLE `campaigns` ADD `script_es` text;--> statement-breakpoint
ALTER TABLE `campaigns` ADD `script_en` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `cover_from_user_id` integer;--> statement-breakpoint
ALTER TABLE `companies` ADD `cover_user_id` integer;--> statement-breakpoint
ALTER TABLE `companies` ADD `cover_absence_id` integer;