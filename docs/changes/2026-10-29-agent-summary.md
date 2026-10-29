# Resumen del agente — 2026-10-29

**Objetivo:** pasar de un agente a todo lo de sus llamadas con un clic, y abrir cualquiera.
**Quién:** supervisores y administradores abren el de cualquier persona; cada agente solo el suyo («Mi resumen»).
**Respuestas del dueño:** 1A (página de resumen), 2A (la campaña de origen + «ver todas»), 3A (agentes, solo el suyo),
4A (filtro «Desde / Hasta» para números y lista).

## Cómo funciona
1. El nombre del agente es un enlace en «Estadísticas globales» y en el «Tablero» de cada campaña (Detalle → «Por
   agente») y en «Seguimiento».
2. «Resumen del agente»: números (tareas asignadas, abiertas y para hoy, llamadas y de hoy, contactos con %,
   compromisos, sin revisar), resultados de sus llamadas, llamadas por día y todas sus llamadas con filtros de
   resultado y revisión; la fecha abre el resumen completo de la llamada.
3. Desde una campaña muestra esa campaña con «ver todas las campañas»; desde «Estadísticas globales», todas.
4. «Desde / Hasta» cambia llamadas, contactos, compromisos y resultados; las tareas se cuentan como están hoy.
5. «Mis llamadas» → «Mi resumen» para cada agente.

## Reglas
- Comprobado en el servidor: un agente que abre el resumen de otra persona recibe «No encontrado»; el resumen de cada
  llamada mantiene sus permisos.

## Aprobaciones / Notificaciones
Ninguna.

## Datos existentes
Todas las llamadas ya registradas aparecen; no cambia ningún dato.

## Decisiones que tomé
- 100 llamadas por página con «Ver más»; mismas reglas que «Estadísticas» para que los números coincidan.
- La lista es la misma de «Llamadas realizadas» (una sola pieza para las dos pantallas).

## No incluido
- Comparar dos agentes lado a lado.

## Cambios en el manual
- Nueva sección «Resumen del agente»; «Tableros», «Seguimiento» y «Mis llamadas» actualizadas; línea en «Novedades».

## Cómo probarlo
1. `demo.supervisor` → «Estadísticas globales» → «Por agente» → «Ana Agente (demo)».
2. «Ver llamada» (la fecha) en cualquier fila.
3. «Campaña demo» → «Seguimiento» → nombre → resumen de esa campaña; «ver todas las campañas».
4. Cambiar «Desde / Hasta».
5. `demo.agente1` → «Mis llamadas» → «Mi resumen».
