CREATE TABLE `qr_cases` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`number` text NOT NULL,
	`year` integer NOT NULL,
	`seq` integer NOT NULL,
	`type` text NOT NULL,
	`topic` text,
	`channel` text NOT NULL,
	`priority` text DEFAULT 'Media' NOT NULL,
	`status` text DEFAULT 'recibida' NOT NULL,
	`assigned_user_id` integer,
	`created_by` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`first_due` text NOT NULL,
	`due` text NOT NULL,
	`first_done_at` text,
	`subject` text NOT NULL,
	`description` text NOT NULL,
	`solution` text,
	`party_sigtur` integer DEFAULT false NOT NULL,
	`party_rut` text,
	`party_sigtur_id` text,
	`party_name` text NOT NULL,
	`party_razon` text,
	`party_rnc` text,
	`party_rnt_status` text,
	`party_province` text,
	`party_municipality` text,
	`party_address` text,
	`party_phone` text,
	`party_email` text,
	`complainant_anonymous` integer DEFAULT false NOT NULL,
	`complainant_name` text,
	`complainant_doc` text,
	`complainant_nationality` text,
	`complainant_phone` text,
	`complainant_email` text,
	`close_proposed_by` integer,
	`close_proposed_at` text,
	`close_note` text,
	`closed_by` integer,
	`closed_at` text,
	`source_ref` text,
	`sender_hash` text,
	FOREIGN KEY (`assigned_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`close_proposed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`closed_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `qr_cases_number_unique` ON `qr_cases` (`number`);--> statement-breakpoint
CREATE INDEX `qr_cases_status` ON `qr_cases` (`status`);--> statement-breakpoint
CREATE INDEX `qr_cases_assigned` ON `qr_cases` (`assigned_user_id`);--> statement-breakpoint
CREATE INDEX `qr_cases_rut` ON `qr_cases` (`party_rut`);--> statement-breakpoint
CREATE INDEX `qr_cases_created` ON `qr_cases` (`created_at`);--> statement-breakpoint
CREATE TABLE `qr_file_parts` (
	`file_id` integer NOT NULL,
	`idx` integer NOT NULL,
	`data` blob NOT NULL,
	FOREIGN KEY (`file_id`) REFERENCES `qr_files`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `qr_file_parts_pk` ON `qr_file_parts` (`file_id`,`idx`);--> statement-breakpoint
CREATE TABLE `qr_files` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`name` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`parts` integer NOT NULL,
	`complete` integer DEFAULT false NOT NULL,
	`uploaded_by` integer,
	`uploaded_by_name` text,
	`at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`replaced_at` text,
	FOREIGN KEY (`case_id`) REFERENCES `qr_cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `qr_files_case` ON `qr_files` (`case_id`);--> statement-breakpoint
CREATE TABLE `qr_referrals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`institution` text NOT NULL,
	`sent_on` text NOT NULL,
	`due_on` text,
	`note` text,
	`response` text,
	`responded_at` text,
	`created_by` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `qr_cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `qr_referrals_case` ON `qr_referrals` (`case_id`);--> statement-breakpoint
CREATE TABLE `qr_reports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`version` integer NOT NULL,
	`origin` text NOT NULL,
	`by_name` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`pdf` blob NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `qr_cases`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `qr_reports_case` ON `qr_reports` (`case_id`);--> statement-breakpoint
CREATE TABLE `qr_steps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`case_id` integer NOT NULL,
	`at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`user_id` integer,
	`by_name` text,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	FOREIGN KEY (`case_id`) REFERENCES `qr_cases`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `qr_steps_case` ON `qr_steps` (`case_id`);