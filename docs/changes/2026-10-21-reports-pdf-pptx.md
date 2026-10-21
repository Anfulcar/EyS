# Informes en PDF o PowerPoint, con plantillas e informes programados — 2026-10-21

**Objetivo:** sacar un informe entregable cuando se necesite ("on demand"), o que se genere solo cada semana o cada mes.
**Quién:** administradores y supervisores generan y ven los informes; los agentes e inspectores no tienen acceso.

## Cómo funciona
1. «Estadísticas globales» → **«Generar informe»** abre un panel con:
   - campañas: todas, solo activas o elegir cuáles;
   - período de la actividad: todo, semana pasada, últimos 7 días, mes en curso, mes pasado o fechas exactas;
   - título y comentarios;
   - secciones: metas del plan, conteos, comparación por campaña, resultados por tipificación, avance por agente, zona/prioridad/subsector, estatus SIGTUR y canal, llamadas por día, leyenda y detalle de establecimientos (sin teléfonos ni contactos, con un filtro);
   - **formato: PDF o PowerPoint.**
2. «Descargar» genera el archivo con los datos del momento: logo y colores del Ministerio, páginas numeradas. En PowerPoint los gráficos se pueden editar.
3. **«Guardar como plantilla»** guarda la elección con un nombre y, si se quiere, una **programación**: semanal o cada 2 semanas (día de la semana), o mensual (día del mes).
4. Los informes programados se generan solos ese día, entre las 7 y las 8 a. m., y quedan en el nuevo menú **«Informes»**. Ese menú muestra un contador rojo de nuevos y conserva los informes 12 meses. Allí se puede «Generar ahora», pausar o eliminar cada plantilla.

## Reglas
- El universo y las metas se muestran completos. Con un período, cada meta indica cuánto se logró en ese período, y las llamadas, contactos, resultados, agentes y gráfico usan solo esas fechas.
- Los resultados se muestran como texto, sin códigos.
- Las plantillas y los informes generados son compartidos entre administradores y supervisores.
- Al reanudar una plantilla en pausa, no se recuperan los informes perdidos; sigue en la próxima fecha.

## Decisiones que tomé
- El informe se genera en el servidor y se descarga directo, siempre igual en cualquier equipo.
- Entrega solo dentro de la aplicación (sin correo).
- Diseño vertical A4 como la muestra aprobada; PowerPoint en 16:9.
- La programación diaria usa una tarea automática de Vercel con una clave CRON_SECRET. Si la clave falta, los informes pendientes se generan igual la primera vez que alguien abre «Estadísticas globales» o «Informes».

## No incluido
- Envío por correo.
- Informe de una sola campaña en PDF: dentro de cada campaña sigue la exportación a Excel.

## Cambios en el manual
- Nueva sección «Informes en PDF o PowerPoint» y línea en «Novedades».

## Cómo probarlo en el sitio de prueba
1. `demo.admin` → «Estadísticas globales» → «Generar informe» → «Semana pasada» → «Descargar PDF».
2. Cambie a PowerPoint → «Descargar PowerPoint».
3. «Guardar como plantilla»: nombre y «Semanal · lunes».
4. Menú «Informes» → «Generar ahora» → descargue el informe de la lista.
