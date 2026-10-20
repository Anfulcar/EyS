CREATE TABLE `call_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`company_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`phone_id` integer,
	`phone_number` text,
	`called_at` text NOT NULL,
	`attempt_no` integer NOT NULL,
	`contacted` integer NOT NULL,
	`attended` integer,
	`no_contact_code` text,
	`spoke_with` text,
	`spoke_role` text,
	`is_responsible` integer,
	`whatsapp_sent` integer DEFAULT false NOT NULL,
	`notes` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `attempts_company` ON `call_attempts` (`company_id`);--> statement-breakpoint
CREATE INDEX `attempts_campaign` ON `call_attempts` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `call_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attempt_id` integer NOT NULL,
	`campaign_id` integer NOT NULL,
	`establishment_id` integer NOT NULL,
	`code` text NOT NULL,
	`en_operacion` text,
	`commitment_date` text,
	`closed_since` text,
	`obstacle` text,
	`notes` text,
	FOREIGN KEY (`attempt_id`) REFERENCES `call_attempts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`establishment_id`) REFERENCES `establishments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `results_est` ON `call_results` (`establishment_id`);--> statement-breakpoint
CREATE INDEX `results_campaign` ON `call_results` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`followup_days` integer DEFAULT 5 NOT NULL,
	`created_by` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`key` text NOT NULL,
	`razon_social` text,
	`rnc` text,
	`assigned_user_id` integer,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`failed_attempts` integer DEFAULT 0 NOT NULL,
	`next_action_at` text,
	`last_called_at` text,
	`last_code` text,
	`priority` text,
	`zone` text,
	`whatsapp_suggested` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assigned_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_campaign_key` ON `companies` (`campaign_id`,`key`);--> statement-breakpoint
CREATE INDEX `companies_assigned` ON `companies` (`campaign_id`,`assigned_user_id`,`status`);--> statement-breakpoint
CREATE TABLE `establishments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`company_id` integer NOT NULL,
	`sigtur_id` text NOT NULL,
	`rut` text,
	`estatus_rnt` text,
	`prioridad` text,
	`nombre_comercial` text,
	`razon_social` text,
	`rnc` text,
	`subsector` text,
	`actividad` text,
	`provincia` text,
	`municipio` text,
	`zona_operativa` text,
	`zona_turistica` text,
	`direccion` text,
	`telefono` text,
	`telefono_valido` text,
	`correo` text,
	`correo_valido` text,
	`contactabilidad` text,
	`establ_misma_empresa` integer,
	`establ_mismo_correo` integer,
	`resolucion` text,
	`fecha_emision` text,
	`fecha_vencimiento` text,
	`dias_vencida` integer,
	`tiempo_vencida` text,
	`antiguedad` text,
	`correo_enviado_fecha` text,
	`correo_rebotado` text,
	`final_code` text,
	`en_operacion` text,
	`fecha_compromiso` text,
	`requiere_visita` text,
	`estatus_sigtur_actualizado` text,
	`fecha_cambio_estatus` text,
	`canal_logro` text,
	`responsable` text,
	`observaciones` text,
	`contacto_nombre` text,
	`contacto_cargo` text,
	`correo_actualizado` text,
	`cerrado_desde` text,
	`obstaculo` text,
	`extra` text,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `establishments_campaign_sigtur` ON `establishments` (`campaign_id`,`sigtur_id`);--> statement-breakpoint
CREATE INDEX `establishments_company` ON `establishments` (`company_id`);--> statement-breakpoint
CREATE TABLE `import_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer,
	`kind` text NOT NULL,
	`file_name` text,
	`rows` integer DEFAULT 0 NOT NULL,
	`inserted` integer DEFAULT 0 NOT NULL,
	`updated` integer DEFAULT 0 NOT NULL,
	`skipped` integer DEFAULT 0 NOT NULL,
	`user_id` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `phones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`company_id` integer NOT NULL,
	`number` text NOT NULL,
	`normalized` text NOT NULL,
	`source` text DEFAULT 'file' NOT NULL,
	`kind` text DEFAULT 'original' NOT NULL,
	`reason` text,
	`reason_note` text,
	`replaces_phone_id` integer,
	`active` integer DEFAULT true NOT NULL,
	`quality` text DEFAULT 'ok' NOT NULL,
	`added_by` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `phones_company` ON `phones` (`company_id`);--> statement-breakpoint
CREATE TABLE `status_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`establishment_id` integer NOT NULL,
	`old_status` text,
	`new_status` text NOT NULL,
	`changed_at` text NOT NULL,
	`user_id` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`establishment_id`) REFERENCES `establishments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'agent' NOT NULL,
	`password_hash` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`must_change_password` integer DEFAULT true NOT NULL,
	`failed_logins` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer NOT NULL,
	`establishment_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`visit_no` integer NOT NULL,
	`visit_date` text NOT NULL,
	`code` text NOT NULL,
	`commitment_date` text,
	`notes` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`establishment_id`) REFERENCES `establishments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `visits_est` ON `visits` (`establishment_id`);