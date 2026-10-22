# Interruptor de la campaña permanente SIGTUR — 2026-10-22

**Objetivo:** decidir cuándo se aceptan las solicitudes de llamada de SIGTUR y separar la campaña permanente de las temporales.
**Quién:** los administradores encienden/apagan; los supervisores ven el estado; los agentes siguen trabajando sus solicitudes abiertas.
**Respuestas del dueño:** 1A 2A 3A 4A.

## Cómo funciona
1. «Campañas» muestra arriba el bloque **«Campaña permanente»** (Solicitudes SIGTUR): estado, quién recibe las solicitudes, abiertas, recibidas hoy, terminadas y «Ver tareas». Debajo, **«Campañas temporales»** con las tarjetas normales.
2. Los **administradores** tienen el interruptor «Encendida / Apagada» en ese bloque, en «Integraciones» y en la configuración de la campaña. Apagar pide confirmación.
3. **Apagada:** SIGTUR recibe «Solicitudes de llamada en pausa» (no se crea nada); las tareas abiertas siguen con sus agentes y se pueden terminar; «Simular solicitud SIGTUR» también responde «en pausa».
4. El bloque muestra quién la apagó y cuándo.

## Reglas
- La campaña permanente no tiene fechas visibles, no se cierra ni se elimina (también comprobado en el servidor).
- Cada cambio queda en «Registro».

## Aprobaciones / Notificaciones
Ninguna.

## Datos existentes
La campaña «Solicitudes SIGTUR» actual pasa a ser la permanente, queda **encendida** y activa. Ninguna tarea cambia.

## Decisiones que tomé
- Apagada, SIGTUR recibe una respuesta de «no disponible temporalmente» (503) y se actualizó la guía `docs/sigtur-integracion.md`.
- La campaña permanente se crea sola al abrir «Campañas» o «Integraciones» si aún no existe.

## No incluido
- Encender/apagar por horario. Interruptores para el envío de campañas o la lectura de interacciones.

## Cambios en el manual
- «Campañas», «Solicitudes SIGTUR» e «Integraciones (SIGTUR)» actualizadas; línea en «Novedades».

## Cómo probarlo
1. Administrador → «Campañas»: bloque permanente arriba, temporales abajo.
2. Apagar → confirmar → «En pausa» con su nombre y la hora.
3. «Integraciones» → «Simular solicitud SIGTUR» responde «en pausa».
4. Agente: sus tareas SIGTUR abiertas siguen en «Mis llamadas». Supervisor: ve el estado sin interruptor.
5. Encender de nuevo: la simulación vuelve a crear la solicitud.
