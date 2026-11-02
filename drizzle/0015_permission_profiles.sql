CREATE TABLE `permission_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text,
	`name` text NOT NULL,
	`description` text,
	`actions` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `permission_profiles_key_unique` ON `permission_profiles` (`key`);--> statement-breakpoint
CREATE UNIQUE INDEX `permission_profiles_name_unique` ON `permission_profiles` (`name`);--> statement-breakpoint
ALTER TABLE `users` ADD `profile_id` integer REFERENCES permission_profiles(id);