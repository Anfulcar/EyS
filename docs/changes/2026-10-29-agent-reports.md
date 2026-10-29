# Informes por agente — 2026-10-29

**Objetivo:** generar el informe PDF/PowerPoint de uno o varios agentes concretos.
**Quién:** supervisores y administradores (3A).
**Respuestas del dueño:** 1A (sus tareas y sus llamadas), 2A (un informe por agente), 3A (supervisores y administradores,
con botón en «Resumen del agente»).

## Cómo funciona
1. «Generar informe» («Informes» y «Estadísticas globales») tiene una sección **«Agentes»**: «Todo el equipo» (como hoy) o
   «Elegir agentes».
2. Un informe por agente: con uno, un PDF/PowerPoint; con dos o más, un .zip con un informe por persona. Cada uno queda en
   «Informes» como «Informe – Nombre».
3. Cada informe cuenta las tareas asignadas hoy a esa persona (metas, conteos, resultados, estado de operación, zona /
   prioridad / subsector, detalle) y las llamadas que hizo en el período (llamadas, contactos, compromisos, llamadas
   por día). La portada muestra «Agente: Nombre · rol».
4. Plantillas y programación recuerdan los agentes: llega un informe por persona en «Informes».
5. «Resumen del agente» → «Generar informe» abre el panel con esa persona, campaña y período ya elegidos.

## Reglas
- Solo supervisores y administradores (comprobado en el servidor). Máximo 30 agentes por descarga.
- Una tarea reasignada cuenta para quien la tiene hoy; una llamada cuenta para quien la hizo.

## Aprobaciones / Notificaciones
Ninguna; los informes programados aparecen en «Informes» con el contador de nuevos.

## Datos existentes
Plantillas e informes guardados siguen siendo «Todo el equipo».

## Decisiones que tomé
- «Avance por agente» muestra solo su fila; «Comparación por campaña» solo las campañas donde tiene tareas.
- El panel abierto desde «Resumen del agente» no cambia la última elección recordada del panel normal.

## No incluido
- Informes de visitas de inspectores; que los agentes generen su propio informe.

## Cambios en el manual
- «Informes en PDF o PowerPoint»: sección «Agentes» y botón en «Resumen del agente»; línea en «Novedades».

## Cómo probarlo
1. `demo.supervisor` → «Informes» → «Generar informe» → «Elegir agentes» → Ana y Luis → «Descargar 2 informes (.zip)».
2. Los dos aparecen en «Informes» con el nombre de cada agente.
3. «Resumen del agente» → «Generar informe»: la persona ya está marcada.
4. Guardar una plantilla semanal con un agente → «Generar ahora».
