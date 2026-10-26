# Eliminar RUT de una campaña en curso — 2026-10-26

**Objetivo:** sacar definitivamente un grupo de RUT de una campaña que sigue abierta.
**Quién:** solo administradores (4B). Los RUT eliminados desaparecen de las listas de todos.
**Respuestas del dueño:** 1B (borrar por completo), 2A (archivo como vía principal + filtros en la lista), 3A (no cuentan
en los números; quedan en «Eliminadas» con el motivo), 4B (solo administradores).

## Cómo funciona
1. «Actualización de estatus» → «Eliminar de esta campaña los RUT de un archivo» (columna «RUT» o «ID SIGTUR») →
   «Revisar».
2. «Tareas y asignación»: nuevos filtros (estatus RNT, subsector / tipo, prioridad, último resultado) y
   «Eliminar de la campaña…» sobre las marcadas o **todas las filtradas** → «Revisar».
3. Confirmación común: tareas, establecimientos, llamadas y visitas que se borran, solicitudes SIGTUR abiertas y RUT
   del archivo que no están; motivo obligatorio; escribir ELIMINAR; contraseña si el ingreso tiene más de 10 minutos.
4. Se borran la tarea, sus establecimientos, teléfonos, llamadas y visitas. No se puede deshacer.
5. Queda: «Eliminadas (N)» con fecha, RUT, establecimiento, motivo, llamadas y quién (descarga en Excel), una línea en
   «Registro» y los compromisos y cierres para los avisos de otras campañas.

## Reglas
- Solo administradores (comprobado en el servidor); campañas cerradas no se cambian; máximo 5 000 RUT por vez.
- Solo se eliminan los RUT del grupo; otros RUT de la misma empresa se quedan.
- Los RUT del archivo que no están en la campaña se listan y se ignoran.

## Aprobaciones / Notificaciones
Ninguna (confirmación con ELIMINAR y contraseña).

## Datos existentes
Nada cambia hasta que se use. Lo que ya estaba en espera para SIGTUR se mantiene.

## Decisiones que tomé
- «Todas las filtradas» usa exactamente los mismos filtros que la lista, comprobados de nuevo en el servidor al confirmar.
- Las solicitudes SIGTUR abiertas se pueden eliminar; se avisan en los conteos.

## No incluido
- Deshacer, campañas cerradas, eliminar una campaña entera (ya existe en «Configuración»).

## Cambios en el manual
- Nueva sección «Eliminar RUT de una campaña»; «Campañas» con los filtros nuevos; línea en «Novedades».

## Cómo probarlo
1. `demo.admin` → «Campaña demo – Región Este» → «Tareas y asignación» → Estatus RNT «Sin licencia» → «Eliminar de la
   campaña…» → «Revisar» → motivo + ELIMINAR → confirmar.
2. «Eliminadas (N)» muestra los RUT con el motivo; los números de la campaña bajan.
3. «Actualización de estatus» → archivo con dos RUT → verá los conteos y los RUT no encontrados.
4. `demo.supervisor`: no aparece la opción.
