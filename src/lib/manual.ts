// In-app manual (/help). Every change that alters what people see or do must update this file in the
// same pull request, and add a dated line to WHATS_NEW (newest first). See CLAUDE.md.
import type { Lang } from "./catalog";

type Section = { id: string; roles: string[]; title: string; intro?: string; steps?: string[]; bullets?: string[] };
type L<T> = Record<Lang, T>;

export const WHATS_NEW: { date: string; es: string; en: string }[] = [
  { date: "2026-10-20", es: "Pantallas de administración más limpias: «+ Nueva campaña» y «+ Nuevo usuario» en ventanas, lista de tareas compacta con «Asignar tareas» en un panel lateral y asignación de filas seleccionadas, configuración de campaña ordenada. Las tarjetas de campaña muestran los totales correctos.", en: "Cleaner administration screens: “+ New campaign” and “+ New user” in pop-ups, compact task list with “Assign tasks” in a side panel and assignment of ticked rows, tidier campaign settings. Campaign cards show the correct totals." },
  { date: "2026-10-20", es: "Manual de uso en la aplicación (esta página), con esta sección de novedades.", en: "In-app manual (this page), with this What's new section." },
  { date: "2026-10-20", es: "Acciones sensibles (eliminar campaña, crear usuarios, cambiar rol, estado o contraseña) piden confirmar la contraseña si el último ingreso fue hace más de 10 minutos.", en: "Sensitive actions (delete a campaign, create users, change role, status or password) ask to confirm the password if the last sign-in was more than 10 minutes ago." },
  { date: "2026-10-20", es: "Nuevo «Registro» para administradores: actividad (quién hizo qué y cuándo) y errores, con filtros y descarga.", en: "New “Log” for administrators: activity (who did what and when) and errors, with filters and download." },
  { date: "2026-10-20", es: "Sitios de prueba (vista previa) con datos ficticios y usuarios demo para cada rol.", en: "Preview (test) sites with made-up data and demo users for every role." },
  { date: "2026-10-20", es: "Mensaje claro «No se pudo conectar con el servidor» y página «No encontrado» para pantallas sin acceso.", en: "Clear “Can't reach the server” message and a “Not found” page for screens without access." },
  { date: "2026-10-20", es: "Una tarea de llamada por RUT; los establecimientos con el mismo RNC se pueden trabajar en una sola llamada.", en: "One call task per RUT; establishments with the same RNC can be handled in a single call." },
  { date: "2026-10-20", es: "Los resultados se muestran solo como texto (sin números) en la aplicación y en los Excel. Nuevo diseño.", en: "Results are shown as text only (no numbers) in the app and Excel files. New design." },
  { date: "2026-10-20", es: "Contraseña inicial «usuario123», edición de usuarios y botón «Actualizar».", en: "Starting password “username123”, user editing and “Refresh” button." },
];

const ES: Section[] = [
  {
    id: "start", roles: ["admin", "supervisor", "agent", "inspector"], title: "Primeros pasos",
    bullets: [
      "Ingrese con el usuario que le dio el administrador. La primera vez la contraseña es su usuario seguido de 123 (por ejemplo ana123) y se le pedirá cambiarla.",
      "El menú de la izquierda (arriba en el celular) muestra solo lo que su rol puede usar.",
      "Puede cambiar el idioma con ES / EN y su contraseña en «Mi cuenta» (haciendo clic en su nombre).",
      "Si 5 intentos de contraseña fallan, la cuenta se bloquea 15 minutos.",
    ],
  },
  {
    id: "calls", roles: ["agent", "supervisor", "admin"], title: "Mis llamadas (agentes)",
    intro: "Cada tarjeta es un establecimiento (un RUT) que le asignaron.",
    bullets: [
      "«Para hoy»: llamadas pendientes y seguimientos que ya tocan. «Programadas»: reintentos y seguimientos de días próximos. «Pasaron a visita» y «Finalizadas»: ya no requieren llamada.",
      "La etiqueta «+N de la misma empresa» indica otros establecimientos con el mismo RNC.",
      "«Actualizar» recarga la lista sin salir de la página.",
    ],
  },
  {
    id: "log-call", roles: ["agent", "supervisor", "admin"], title: "Registrar una llamada",
    steps: [
      "Abra la tarjeta. Revise el guion, los teléfonos y los datos del establecimiento.",
      "Si el mismo RNC tiene otros establecimientos, puede marcarlos en «Registrar esta llamada también para» y se registrará la misma llamada para todos.",
      "Elija el número marcado y responda: ¿pudo contactar a alguien?, ¿le atendieron?",
      "Si habló con alguien: con quién, su cargo y si es el responsable.",
      "Para cada establecimiento: ¿sigue operando? y la respuesta (iniciará solicitud, ya inició, requiere asistencia, no interesado, cambió dueño). «Iniciará solicitud» exige la fecha de compromiso.",
      "Pulse «Guardar». La tarea pasa sola al estado que corresponde.",
    ],
  },
  {
    id: "rules", roles: ["agent", "supervisor", "admin"], title: "Reglas automáticas de las llamadas",
    bullets: [
      "No contesta / buzón: se reintenta el siguiente día hábil (buzón: 3 horas después). Después del 2.º intento fallido se sugiere enviar un WhatsApp.",
      "Tras 3 intentos fallidos (o si no queda ningún número que funcione) el establecimiento pasa a visita.",
      "Número equivocado o fuera de servicio: el número se marca y no se vuelve a usar.",
      "Compromiso: se programa una llamada de seguimiento 5 días hábiles después de la fecha comprometida.",
      "Se niega: pasa a visita. Requiere asistencia: seguimiento o visita, según lo que marque.",
      "Ya inició la solicitud o cerró operaciones: la tarea se da por finalizada.",
    ],
  },
  {
    id: "phones", roles: ["agent", "supervisor", "admin"], title: "Agregar o sustituir números",
    bullets: [
      "En «Teléfonos» pulse «Agregar número». Elija «Adicional» o «Sustituye al de archivo» (y cuál sustituye) e indique siempre el motivo.",
      "El número sustituido queda en el historial, tachado.",
      "Si la tarea había pasado a visita por falta de números, un número nuevo la devuelve a llamadas.",
    ],
  },
  {
    id: "visits", roles: ["inspector", "supervisor", "admin"], title: "Visitas (inspectores)",
    bullets: [
      "«Visitas» muestra los establecimientos que requieren visita. Filtre por campaña y zona operativa y descargue la ruta en Excel.",
      "Pulse «Registrar visita», indique la fecha y el resultado (solicitud iniciada, compromiso con fecha, se niega, cerrado, no localizado, responsable ausente, cambio de dirección).",
      "Solicitud iniciada, compromiso o cambio de dirección programan una llamada de seguimiento. No localizado o responsable ausente permiten una segunda visita (máximo 2).",
    ],
  },
  {
    id: "campaigns", roles: ["supervisor", "admin"], title: "Campañas: carga y asignación",
    steps: [
      "«Campañas» → «+ Nueva campaña» (administradores) abre una ventana: nombre, fechas de inicio y fin, intentos máximos y días de seguimiento.",
      "«Carga masiva»: descargue la plantilla maestra, pegue los establecimientos (mismos encabezados que la Matriz) y cárguela. Verá una vista previa antes de confirmar.",
      "«Tareas y asignación»: la lista muestra cada establecimiento con su último resultado. «Asignar tareas» abre un panel con el método (repartir equitativamente, por zona o todo a un agente); los establecimientos de la misma empresa quedan con el mismo agente. También puede marcar filas y usar «Asignar seleccionadas a», o cambiar el agente de una fila (se guarda solo).",
      "«Correos»: registre la fecha de envío del correo masivo y cargue los correos rebotados.",
      "«Actualización de estatus»: cargue el estatus de SIGTUR para medir quién pasó a «En proceso».",
      "«Exportar»: la Matriz de seguimiento completa en Excel y todas las llamadas en CSV.",
    ],
  },
  {
    id: "dashboards", roles: ["supervisor", "admin"], title: "Tableros",
    bullets: [
      "«Tablero» de cada campaña: llamados, contacto efectivo, compromisos, cumplimiento, cerrados, visitas, y desgloses por agente, zona, prioridad y subsector, con las metas del plan.",
      "«Estadísticas globales»: compara todas las campañas y suma sus resultados.",
    ],
  },
  {
    id: "admin", roles: ["admin"], title: "Administración: usuarios, seguridad y registro",
    bullets: [
      "«Usuarios»: «+ Nuevo usuario» abre una ventana (si deja la contraseña vacía será usuario + 123). «Editar» abre la misma ventana para cambiar nombre, usuario, rol, estado o contraseña.",
      "Por seguridad, eliminar una campaña, crear usuarios o cambiar rol, estado o contraseña pide confirmar su contraseña si su último ingreso fue hace más de 10 minutos.",
      "«Registro» → «Actividad»: quién hizo qué y cuándo (ingresos, cambios de usuarios, cargas, asignaciones, llamadas, visitas, descargas de datos). «Errores»: fallos de la aplicación. Se puede filtrar y descargar en CSV.",
    ],
  },
  {
    id: "messages", roles: ["admin", "supervisor", "agent", "inspector"], title: "Mensajes que puede ver",
    bullets: [
      "«No se pudo conectar con el servidor»: revise su internet y pulse «Intentar de nuevo». Lo que estaba guardando no se guardó.",
      "«No encontrado»: la página no existe o su rol no tiene acceso a ella.",
      "Barra amarilla «Sitio de demostración»: está en un sitio de prueba con datos ficticios que se recargan en cada despliegue.",
    ],
  },
];

const EN: Section[] = [
  {
    id: "start", roles: ["admin", "supervisor", "agent", "inspector"], title: "Getting started",
    bullets: [
      "Sign in with the username your administrator gave you. The first time, the password is your username followed by 123 (e.g. ana123) and you will be asked to change it.",
      "The menu on the left (top on phones) shows only what your role can use.",
      "Switch language with ES / EN, and change your password in “My account” (click your name).",
      "After 5 wrong passwords the account is locked for 15 minutes.",
    ],
  },
  {
    id: "calls", roles: ["agent", "supervisor", "admin"], title: "My calls (agents)",
    intro: "Each card is one establishment (one RUT) assigned to you.",
    bullets: [
      "“Due today”: pending calls and follow-ups that are due. “Scheduled”: retries and follow-ups for coming days. “Sent to visit” and “Done”: no call needed.",
      "The “+N of the same company” tag shows other establishments with the same RNC.",
      "“Refresh” reloads the list without leaving the page.",
    ],
  },
  {
    id: "log-call", roles: ["agent", "supervisor", "admin"], title: "Logging a call",
    steps: [
      "Open the card. Check the script, the phone numbers and the establishment's details.",
      "If the same RNC has other establishments, tick them under “Also log this call for” and the same call is logged for all of them.",
      "Choose the number dialed and answer: did you reach anyone? did they attend the call?",
      "If you spoke with someone: who, their role, and whether they are the person in charge.",
      "For each establishment: is it still operating? and the response (will apply, already applied, needs help, not interested, changed owner). “Will apply” requires the commitment date.",
      "Click “Save”. The task moves to the right status on its own.",
    ],
  },
  {
    id: "rules", roles: ["agent", "supervisor", "admin"], title: "Automatic call rules",
    bullets: [
      "No answer / voicemail: retried the next business day (voicemail: 3 hours later). After the 2nd failed attempt a WhatsApp message is suggested.",
      "After 3 failed attempts (or when no working number is left) the establishment is sent to a visit.",
      "Wrong or out-of-service number: the number is flagged and not used again.",
      "Commitment: a follow-up call is scheduled 5 business days after the committed date.",
      "Refuses: sent to visit. Needs help: follow-up or visit, as you choose.",
      "Already applied or closed down: the task is done.",
    ],
  },
  {
    id: "phones", roles: ["agent", "supervisor", "admin"], title: "Adding or replacing numbers",
    bullets: [
      "Under “Phone numbers” click “Add number”. Choose “Additional” or “Replaces number on file” (and which one), and always give the reason.",
      "The replaced number stays in the history, struck through.",
      "If the task had gone to visit for lack of numbers, a new number brings it back to calls.",
    ],
  },
  {
    id: "visits", roles: ["inspector", "supervisor", "admin"], title: "Visits (inspectors)",
    bullets: [
      "“Visits” lists establishments that need a visit. Filter by campaign and operating zone, and download the route in Excel.",
      "Click “Log visit”, enter the date and the result (application started, commitment with date, refuses, closed, not found, person absent, changed address).",
      "Application started, commitment or changed address schedule a follow-up call. Not found or person absent allow a second visit (2 at most).",
    ],
  },
  {
    id: "campaigns", roles: ["supervisor", "admin"], title: "Campaigns: upload and assignment",
    steps: [
      "“Campaigns” → “+ New campaign” (administrators) opens a pop-up: name, start and end dates, max attempts and follow-up days.",
      "“Bulk upload”: download the master template, paste the establishments (same headers as the Matriz) and upload it. You see a preview before confirming.",
      "“Tasks & assignment”: the list shows each establishment with its last result. “Assign tasks” opens a panel with the method (split evenly, by zone or all to one agent); establishments of the same company stay with the same agent. You can also tick rows and use “Assign selected to”, or change a row's agent (it saves on its own).",
      "“Emails”: log the mass email's send date and upload bounced emails.",
      "“Status update”: upload the SIGTUR status to measure who moved to “En proceso”.",
      "“Export”: the full tracking Matriz in Excel and every call in CSV.",
    ],
  },
  {
    id: "dashboards", roles: ["supervisor", "admin"], title: "Dashboards",
    bullets: [
      "Each campaign's “Dashboard”: called, effective contact, commitments, compliance, closed, visits, and breakdowns by agent, zone, priority and subsector, with the plan's targets.",
      "“Global statistics”: compares every campaign and adds up their results.",
    ],
  },
  {
    id: "admin", roles: ["admin"], title: "Administration: users, security and log",
    bullets: [
      "“Users”: “+ New user” opens a pop-up (an empty password becomes username + 123). “Edit” opens the same pop-up to change name, username, role, status or password.",
      "For security, deleting a campaign, creating users or changing a role, status or password asks you to confirm your password if your last sign-in was more than 10 minutes ago.",
      "“Log” → “Activity”: who did what and when (sign-ins, user changes, uploads, assignments, calls, visits, data downloads). “Errors”: app failures. Filter and download as CSV.",
    ],
  },
  {
    id: "messages", roles: ["admin", "supervisor", "agent", "inspector"], title: "Messages you may see",
    bullets: [
      "“Can't reach the server”: check your internet and click “Try again”. What you were saving was not saved.",
      "“Not found”: the page doesn't exist or your role can't use it.",
      "Yellow “Demo site” bar: you are on a test site with made-up data that reloads on every deployment.",
    ],
  },
];

export const MANUAL: L<Section[]> = { es: ES, en: EN };
