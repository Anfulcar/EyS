CREATE TABLE `history_archive` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`rut` text,
	`rnc` text,
	`sigtur_id` text,
	`establishment` text,
	`campaign_name` text NOT NULL,
	`date` text,
	`source` text,
	`by_name` text,
	`at` text
);
--> statement-breakpoint
CREATE INDEX `history_archive_rut` ON `history_archive` (`rut`);--> statement-breakpoint
CREATE INDEX `history_archive_rnc` ON `history_archive` (`rnc`);--> statement-breakpoint
CREATE TABLE `sigtur_outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`ref` text NOT NULL,
	`sigtur_id` text,
	`summary` text,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`next_try_at` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`sent_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sigtur_outbox_ref` ON `sigtur_outbox` (`ref`);--> statement-breakpoint
CREATE INDEX `sigtur_outbox_status` ON `sigtur_outbox` (`status`,`id`);--> statement-breakpoint
ALTER TABLE `companies` ADD `request_ref` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `request_due_date` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `request_resolved_at` text;--> statement-breakpoint
ALTER TABLE `companies` ADD `request_overdue_at` text;--> statement-breakpoint
ALTER TABLE `establishments` ADD `propietario` text;--> statement-breakpoint
CREATE INDEX `establishments_rut` ON `establishments` (`rut`);