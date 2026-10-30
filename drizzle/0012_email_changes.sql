CREATE TABLE `data_changes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`establishment_id` integer,
	`campaign_id` integer,
	`campaign_name` text,
	`rut` text,
	`sigtur_id` text,
	`establishment` text,
	`field` text NOT NULL,
	`label` text NOT NULL,
	`from_value` text,
	`to_value` text,
	`by_user_id` integer,
	`by_name` text,
	`source` text NOT NULL,
	`at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`approximate` integer DEFAULT false NOT NULL,
	`sigtur_done_at` text,
	`sigtur_done_by` integer,
	`sigtur_done_by_name` text,
	FOREIGN KEY (`establishment_id`) REFERENCES `establishments`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`by_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`sigtur_done_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `data_changes_at` ON `data_changes` (`at`);--> statement-breakpoint
CREATE INDEX `data_changes_campaign` ON `data_changes` (`campaign_id`);--> statement-breakpoint
CREATE INDEX `data_changes_est` ON `data_changes` (`establishment_id`);--> statement-breakpoint
ALTER TABLE `call_attempts` ADD `email_received` text;--> statement-breakpoint
ALTER TABLE `establishments` ADD `correo_recibido` text;--> statement-breakpoint
-- History for «Reporte de cambios»: the changes already queued for SIGTUR (since the queue exists)…
INSERT INTO `data_changes` (`establishment_id`, `campaign_id`, `campaign_name`, `rut`, `sigtur_id`, `establishment`, `field`, `label`, `from_value`, `to_value`, `by_name`, `source`, `at`)
SELECT e.`id`, e.`campaign_id`, c.`name`,
  json_extract(o.`payload`, '$.datos.rut'), json_extract(o.`payload`, '$.datos.idSigtur'), json_extract(o.`payload`, '$.datos.nombreComercial'),
  json_extract(o.`payload`, '$.datos.campo'), json_extract(o.`payload`, '$.datos.campoTexto'),
  json_extract(o.`payload`, '$.datos.valorAnterior'), json_extract(o.`payload`, '$.datos.valorNuevo'),
  json_extract(o.`payload`, '$.datos.solicitadoPor'), coalesce(json_extract(o.`payload`, '$.datos.origen'), 'Llamada'),
  coalesce(json_extract(o.`payload`, '$.datos.fechaHora'), o.`created_at`)
FROM `sigtur_outbox` o
LEFT JOIN `establishments` e ON e.`id` = CAST(substr(o.`ref`, 8, instr(substr(o.`ref`, 8), '-') - 1) AS INTEGER)
LEFT JOIN `campaigns` c ON c.`id` = e.`campaign_id`
WHERE o.`kind` = 'change' AND json_valid(o.`payload`)
ORDER BY o.`id`;
--> statement-breakpoint
-- …and emails corrected before that, dated with the establishment's last call with contact (approximate).
INSERT INTO `data_changes` (`establishment_id`, `campaign_id`, `campaign_name`, `rut`, `sigtur_id`, `establishment`, `field`, `label`, `from_value`, `to_value`, `by_name`, `source`, `at`, `approximate`)
SELECT e.`id`, e.`campaign_id`, c.`name`, e.`rut`, e.`sigtur_id`, e.`nombre_comercial`, 'correo', 'Correo', e.`correo`, e.`correo_actualizado`, e.`responsable`, 'Histórico',
  coalesce((SELECT max(a.`called_at`) FROM `call_attempts` a WHERE a.`company_id` = e.`company_id` AND a.`contacted` = 1), c.`start_date` || 'T12:00:00.000Z'),
  1
FROM `establishments` e
JOIN `campaigns` c ON c.`id` = e.`campaign_id`
WHERE trim(coalesce(e.`correo_actualizado`, '')) <> '' AND lower(trim(e.`correo_actualizado`)) <> lower(trim(coalesce(e.`correo`, '')))
  AND NOT EXISTS (SELECT 1 FROM `data_changes` d WHERE d.`establishment_id` = e.`id` AND d.`field` = 'correo');
