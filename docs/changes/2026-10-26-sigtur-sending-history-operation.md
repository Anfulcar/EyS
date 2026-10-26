# Envío a SIGTUR, avisos de otras campañas, estado de operación y registro completo — 2026-10-26

**Objetivo:** dejar listo el envío automático a SIGTUR (apagado hasta completar la conexión), avisar a los agentes de lo
que pasó con un establecimiento en otras campañas, medir el estado de operación y registrar todas las acciones.
**Quién:** administradores encienden/apagan el envío y ven la cola; agentes ven los avisos y actualizan datos;
supervisores ven solicitudes vencidas y el estado de operación.
**Respuestas del dueño:** 1A con interruptor encendido/apagado; 2 = todo lo que decide una persona cuenta, nada de lo
que decide la aplicación; 3A; 4A. **Condición:** no cambiar el diseño de la pantalla de llamada (campaña en curso).

## Cómo funciona
1. **Envío automático a SIGTUR** (Integraciones): interruptor apagado por defecto. Interacciones, solicitudes de cambio y
   «Solicitud resuelta» quedan en «Pendientes de envío»; al encender salen en orden, con reintentos. Solo se puede
   encender con la dirección de SIGTUR y su clave (en Vercel, `SIGTUR_PUSH_KEY`).
2. **Solicitudes de cambio:** teléfonos agregados/sustituidos/marcados como equivocados, «¿En operación?», fecha de
   cierre, correo actualizado y, con el resultado 06 (o en la visita), nuevo nombre, dirección y dueño/responsable.
3. **Plazos SIGTUR:** 2 días laborables o el plazo de SIGTUR; «vence», «Vence mañana», «Vencida»; las más urgentes
   primero; «Solicitudes SIGTUR vencidas» en «Seguimiento». Resuelta = contacto (01–06) o pasa a visita.
4. **Misma empresa:** cada RUT con estatus RNT y estado en la campaña.
5. **Avisos de otras campañas:** «Compromiso anterior» (01, V2) y «Encontrado cerrado» (05, V4, «¿En operación? No»),
   por RUT; cierres también por RNC («misma empresa»). En la tarea, en «Misma empresa» (una línea) y en el resumen de
   la llamada.
6. **Estado de operación:** En operación / No opera o cerrado / No sabe / Sin dato en Resumen, Estadísticas (con
   listas), informes PDF/PowerPoint, filtro de tareas y exportación.
7. **Registro:** decisiones de la aplicación con autor «Aplicación» y las acciones de usuario que faltaban.

## Reglas
- Solo administradores encienden/apagan el envío, guardan la dirección y reintentan (comprobado en el servidor).
- Los agentes solo actualizan datos de tareas que pueden trabajar.
- Los avisos se conservan aunque se elimine la campaña anterior.

## Aprobaciones / Notificaciones
Ninguna en la aplicación (SIGTUR aprueba los cambios). Avisos solo en pantalla.

## Datos existentes
- Compromisos y cierres ya registrados cuentan para los avisos desde el primer día.
- La cola empieza con lo que ocurra después de este cambio; SIGTUR puede seguir leyendo lo anterior.
- Solicitudes SIGTUR abiertas: plazo contado desde su llegada.

## Decisiones que tomé
- Sin feriados en el plazo (lunes a viernes).
- Cada envío tiene un identificador único para que SIGTUR ignore repetidos.
- Diseño de la llamada intacto: los campos nuevos solo aparecen con el resultado 06 y los avisos de «Misma empresa» son
  de una línea.
- En la base de datos local de pruebas se espera un momento si dos trabajos escriben a la vez (no afecta a Turso).
- La demo trae una campaña anterior cerrada para ver los avisos.

## No incluido
- Aprobación de cambios (en SIGTUR), correos al solicitante, calendario de feriados, envío retroactivo.

## Cambios en el manual
- Nuevas: «Envío automático a SIGTUR», «Actualizar datos del establecimiento», «Avisos de otras campañas», «Estado de
  operación». Actualizadas: «Solicitudes SIGTUR» (plazos), «Administración… registro». Línea en «Novedades».

## Cómo probarlo
1. `demo.admin` → «Integraciones»: envío apagado; «Pendientes de envío» se llena al registrar llamadas.
2. Llamada con resultado 06 y nueva dirección → «Solicitud de cambio» en la cola.
3. Tareas «Bar Marlin…» / «Tours Marlin…» de la campaña demo: avisos de la «Campaña demo – Q3 2026 (cerrada)».
4. «Simular solicitud SIGTUR» → etiqueta «vence …»; registrar contacto → «Solicitud resuelta» en la cola.
5. «Resumen» y «Estadísticas» → «Estado de operación»; informe PDF con la nueva sección.
6. «Registro» → líneas con «Aplicación».
