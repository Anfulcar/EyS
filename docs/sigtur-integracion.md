# Integración SIGTUR ↔ EyS – Campañas de Formalización

Guía para el equipo técnico de SIGTUR. Describe las tres conexiones que ofrece la aplicación de campañas:

| # | Qué hace | Método y dirección |
|---|----------|--------------------|
| 1 | Un analista pide una llamada desde la ficha de un establecimiento | `POST /api/integrations/sigtur/call-requests` |
| 2 | Se crea una campaña desde el módulo de campañas de SIGTUR | `POST /api/integrations/sigtur/campaigns` |
| 3 | SIGTUR lee las interacciones (llamadas, visitas, correos) para el módulo de Servicio al Cliente | `GET /api/integrations/sigtur/interactions` |

La dirección base es la del sitio de la aplicación (por ejemplo `https://<sitio>.vercel.app`). Un administrador la ve en
el menú **Integraciones**.

## Acceso

- Un administrador crea una clave en **Integraciones → Crear clave** y la entrega al equipo de SIGTUR por un canal
  seguro. La clave empieza por `eys_` y **se muestra una sola vez**; la aplicación solo guarda una huella.
- Cada solicitud lleva la cabecera:

  ```
  Authorization: Bearer <clave>
  ```

- Guarde la clave como secreto del servidor de SIGTUR (variable de entorno o almacén de secretos). Nunca en el
  código, el navegador ni registros.
- Sin clave, con una clave equivocada o revocada, la respuesta es `404 Not found` (a propósito no se distingue).
- Si la clave se pierde o se filtra, el administrador la revoca y crea otra.
- Todo lo recibido queda en **Integraciones → Últimas solicitudes recibidas**.
- Las fechas van como `AAAA-MM-DD`; las horas se devuelven en ISO 8601 UTC (`2026-10-22T14:05:00.000Z`).
  La República Dominicana es UTC−4.

## 1. Solicitud de llamada

`POST /api/integrations/sigtur/call-requests` con cuerpo JSON.

| Campo | Obligatorio | Descripción |
|-------|:-----------:|-------------|
| `idSigtur` | Sí | ID del establecimiento en SIGTUR |
| `solicitadoPor` | Sí | Nombre del analista que pide la llamada (se muestra a quien llama) |
| `motivo` | Sí | Por qué se pide (se muestra a quien llama), hasta 1000 caracteres |
| `rut` | No | RUT |
| `nombreComercial` | No | Nombre comercial |
| `razonSocial` | No | Razón social |
| `rnc` | No | RNC o cédula (las tareas con el mismo RNC son «misma empresa») |
| `telefonos` | No | Lista de teléfonos, hasta 10 |
| `correo` | No | Correo |
| `provincia`, `municipio`, `zonaOperativa` | No | Ubicación |
| `prioridad` | No | `P1`, `P2` o `P3` |
| `estatusRnt` | No | Estatus RNT (por ejemplo `Vencida`, `Sin licencia`) |

Ejemplo:

```bash
curl -X POST "$BASE/api/integrations/sigtur/call-requests" \
  -H "Authorization: Bearer $EYS_KEY" -H "Content-Type: application/json" \
  -d '{"idSigtur":"SIG-10422","solicitadoPor":"María Pérez (Licencias)","motivo":"Confirmar si sigue operando antes de la inspección",
       "nombreComercial":"Hotel Las Palmas","rnc":"130-12345-6","telefonos":["809-555-0101"],"prioridad":"P1"}'
```

Qué pasa en la aplicación:

- Si el establecimiento ya tiene una tarea abierta en cualquier campaña, **no se crea otra**: esa tarea recibe la
  etiqueta «Solicitud SIGTUR» y vuelve a «Para hoy» de quien la tiene asignada.
- Si no, se crea la tarea en la campaña siempre abierta **«Solicitudes SIGTUR»** y se asigna sola, según la carga de
  trabajo, entre las personas elegidas en Integraciones (quien está de ausencia no recibe).

Respuesta `200`:

```json
{ "ok": true, "tarea": 381, "campana": "Solicitudes SIGTUR", "asignada": true, "tareaExistente": false }
```

Errores `400`: `{ "ok": false, "error": "Falta motivo" }` (o `Falta idSigtur`, `Falta solicitadoPor`, `JSON inválido`).

**En pausa (`503`).** Un administrador puede apagar las solicitudes de llamada. Mientras estén apagadas, la respuesta es
`503` con la cabecera `Retry-After: 3600` y:

```json
{ "ok": false, "enPausa": true, "error": "Solicitudes de llamada en pausa. Intente más tarde o comuníquese con el equipo de campañas." }
```

No se crea nada. Recomendado: mostrar el mensaje al analista y no reintentar en automático más de una vez por hora.
Las campañas (sección 2) y la lectura de interacciones (sección 3) no se ven afectadas.

## 2. Campaña creada en SIGTUR

`POST /api/integrations/sigtur/campaigns` con cuerpo JSON. La campaña llega como **«Borrador»**: un supervisor o
administrador la revisa, asigna y activa en la aplicación.

| Campo | Obligatorio | Descripción |
|-------|:-----------:|-------------|
| `nombre` | Sí | Nombre de la campaña (mínimo 3 letras) |
| `fechaInicio`, `fechaFin` | Sí | `AAAA-MM-DD`, `fechaFin` ≥ `fechaInicio` |
| `creadoPor` | Sí | Quién la creó en SIGTUR |
| `establecimientos` | Sí | Lista de establecimientos (ver abajo), hasta 20 000 por envío |
| `descripcion` | No | Descripción |
| `intentosMaximos` | No | Intentos fallidos antes de pasar a visita (1–10, por defecto 3) |
| `diasSeguimiento` | No | Días para el seguimiento (1–30, por defecto 5) |
| `guion` | No | Guion de llamada |
| `referencia` | No | ID de la campaña en SIGTUR, para relacionarlas |

Cada establecimiento es un objeto cuyas claves son los **mismos encabezados de la plantilla de la Matriz**. Obligatorios:
`"ID SIGTUR"` y `"Nombre comercial"`. Los demás reconocidos: `"RUT"`, `"Estatus RNT"`, `"Prioridad"`, `"Razón social"`,
`"RNC / Cédula"`, `"Subsector"`, `"Actividad"`, `"Provincia"`, `"Municipio"`, `"Zona operativa"`,
`"Zona turística (SIGTUR)"`, `"Dirección"`, `"Teléfono"` (varios separados por `/`), `"Teléfono válido"`, `"Correo"`,
`"Correo válido"`, `"Contactabilidad"`, `"Resolución"`, `"Fecha emisión"`, `"Fecha vencimiento"`, `"Días vencida"`,
`"Tiempo vencida"`, `"Antigüedad"`, `"Correo enviado (fecha)"`, `"Correo rebotado"`. Las claves no reconocidas se ignoran.

```json
{
  "nombre": "Vencidas Bávaro – noviembre",
  "fechaInicio": "2026-11-01", "fechaFin": "2026-11-30",
  "creadoPor": "Juan Gómez", "referencia": "CAMP-2026-118",
  "establecimientos": [
    { "ID SIGTUR": "SIG-20001", "Nombre comercial": "Restaurante El Muelle", "RNC / Cédula": "131-99887-1",
      "Teléfono": "809-555-0111 / 829-555-0112", "Prioridad": "P2", "Estatus RNT": "Vencida", "Zona operativa": "Bávaro" }
  ]
}
```

Respuesta `200`:

```json
{ "ok": true, "campana": 12, "estado": "Borrador", "establecimientos": 1, "tareas": 1, "omitidos": 0, "errores": [] }
```

`errores` lista hasta 20 filas omitidas con su motivo. Errores `400` como en la sección 1.

### Qué necesita el formulario de campañas en SIGTUR

1. Nombre, fecha de inicio y fecha de fin.
2. Descripción y guion de llamada (opcionales).
3. Intentos máximos y días de seguimiento (opcionales; valores por defecto 3 y 5).
4. Selección de establecimientos (filtros de SIGTUR) que se envían con los encabezados de arriba.
5. Botón «Enviar a campañas» que hace el `POST` y muestra el número de establecimientos recibidos y los omitidos.

## 3. Interacciones

`GET /api/integrations/sigtur/interactions`

| Parámetro | Descripción |
|-----------|-------------|
| `desde`, `hasta` | Período `AAAA-MM-DD` (opcional) |
| `idSigtur` | Solo un establecimiento (opcional) |
| `limite` | Hasta 1000 por página (por defecto 500) |
| `desplazamiento` | Para pedir la página siguiente |

Una interacción por cada **llamada** (una por establecimiento de la llamada), **visita** y **correo enviado**.

```json
{
  "interacciones": [
    {
      "id": "llamada-5521", "idSigtur": "SIG-10422", "rut": "RUT-889", "nombreComercial": "Hotel Las Palmas",
      "fechaHora": "2026-10-22T14:05:00.000Z", "canal": "Llamada", "direccion": "Saliente",
      "realizadoPor": "Ana Rodríguez", "numeroMarcado": "809-555-0101",
      "personaContactada": "Luis Marte", "cargo": "Gerente",
      "resultado": "En operación – iniciará solicitud (compromiso)", "fechaCompromiso": "2026-11-05",
      "obstaculo": null, "notas": "Pidió el enlace del formulario",
      "campana": "Solicitudes SIGTUR", "solicitudSigtur": true, "solicitadoPor": "María Pérez (Licencias)"
    }
  ],
  "hayMas": false,
  "siguienteDesplazamiento": null
}
```

- `id` es estable (`llamada-…`, `visita-…`, `correo-…`): úselo para no registrar dos veces la misma interacción.
- `canal`: `Llamada`, `Visita` o `Correo`. `resultado` siempre va en texto.
- Visitas y correos solo tienen fecha; su hora se fija a las 12:00 de la República Dominicana.
- Recomendado: leer una vez al día con `desde` = día anterior y seguir pidiendo con `siguienteDesplazamiento` mientras
  `hayMas` sea `true`.

## Pruebas

En **Integraciones → Simular solicitud SIGTUR** un administrador crea una solicitud igual a la de la sección 1, para ver
el recorrido completo antes de conectar SIGTUR.
