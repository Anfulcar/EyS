ALTER TABLE `users` ADD `calls_access` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `qr_level` text DEFAULT 'none' NOT NULL;