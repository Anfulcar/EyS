CREATE TABLE `removed_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`rut` text,
	`sigtur_id` text,
	`establishment` text,
	`rnc` text,
	`last_status` text,
	`calls` integer DEFAULT 0 NOT NULL,
	`visits` integer DEFAULT 0 NOT NULL,
	`reason` text NOT NULL,
	`removed_by` integer,
	`removed_by_name` text,
	`removed_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`removed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `removed_tasks_campaign` ON `removed_tasks` (`campaign_id`);