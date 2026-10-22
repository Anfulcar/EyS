# Eliminar informes, campañas desde resultados y conexión con SIGTUR — 2026-10-22

**Objetivo:** limpiar informes, reutilizar los resultados de una campaña en otra y conectar la aplicación con SIGTUR
(solicitudes de llamada, campañas e interacciones).
**Quién:** administradores (todo), supervisores (nueva campaña, descarga de interacciones), agentes (solicitudes SIGTUR
en su lista).

## Cómo funciona
1. **Eliminar informes generados:** solo los administradores ven «Eliminar» junto a cada informe en «Informes»; pide
   confirmación y queda en el «Registro».
2. **Nueva campaña con estas tareas** (respuesta 1A): en la lista de tareas de una campaña se eligen estados y filtros
   (resultado, zona, prioridad, persona) con el conteo al momento. La nueva campaña queda en «Borrador», copia
   establecimientos y teléfonos con la nota «Viene de «X»: último resultado …». En la original esas tareas quedan
   cerradas como «Transferida», con enlace a la nueva, y ya no se pueden llamar allí.
3. **Interacciones para SIGTUR** (respuesta 3A): cada llamada (una por establecimiento), visita y correo enviado genera
   un registro de interacción. Se ve en el resumen de la llamada («Registro para SIGTUR»), se descarga en Excel desde
   «Informes» → «Descargar interacciones» y SIGTUR lo lee por la conexión.
4. **Solicitudes de llamada desde SIGTUR** (respuesta 2A): llegan a la campaña siempre abierta «Solicitudes SIGTUR» y
   se asignan solas por carga de trabajo entre las personas marcadas (respetando ausencias). Llevan la etiqueta morada
   «Solicitud SIGTUR» con quién la pidió y por qué, y salen primero en «Para hoy». Si ya había una tarea abierta para
   ese establecimiento, se marca esa en vez de duplicar.
5. **Campañas desde SIGTUR** (respuesta 4A): llegan como «Borrador» con sus establecimientos.
6. **Integraciones** (administradores): crear y revocar la clave de SIGTUR (se muestra una sola vez), elegir quién
   recibe solicitudes, «Simular solicitud SIGTUR» y la lista de lo último recibido.
7. Guía técnica para el equipo de SIGTUR: `docs/sigtur-integracion.md`.

## Decisiones que tomé
- La clave de SIGTUR se crea dentro de la aplicación y solo se guarda su huella; no va en Vercel ni en el repositorio.
- Una dirección sin clave válida responde «no encontrado», sin dar pistas.
- Al transferir, la nueva campaña empieza sin resultados (los de la campaña anterior quedan en la nota de cada tarea).
- Visitas y correos solo tienen fecha; en las interacciones su hora se fija a las 12:00.

## Cambios en el manual
- Nuevas secciones «Nueva campaña con resultados de otra», «Solicitudes SIGTUR», «Interacciones para SIGTUR» e
  «Integraciones (SIGTUR)»; «Informes» actualizada; línea en «Novedades».

## Cómo probarlo
1. Como administrador: «Informes» → «Eliminar» en un informe generado.
2. Campaña → «Tareas» → «Nueva campaña con estas tareas» → elegir estados → «Crear campaña y transferir».
3. «Integraciones» → marcar personas → «Simular solicitud SIGTUR»; el agente la ve primero en «Para hoy» con la
   etiqueta morada.
4. Abrir el resumen de una llamada: recuadro «Registro para SIGTUR». «Informes» → «Descargar interacciones».
