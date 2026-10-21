// In-app manual (/help). Every change that alters what people see or do must update this file in the
// same pull request, and add a dated line to WHATS_NEW (newest first). See CLAUDE.md.
import type { Lang } from "./catalog";

type Section = { id: string; roles: string[]; title: string; intro?: string; steps?: string[]; bullets?: string[] };
type L<T> = Record<Lang, T>;

export const WHATS_NEW: { date: string; es: string; en: string }[] = [
  { date: "2026-10-21", es: "Informes en PDF o PowerPoint desde «Estadísticas globales»: elija campañas, período, título, comentarios y secciones. Guarde plantillas y prográmelas (semanal, cada 2 semanas o mensual); los informes generados quedan 12 meses en el nuevo menú «Informes».", en: "PDF or PowerPoint reports from “Global statistics”: choose campaigns, period, title, comments and sections. Save templates and schedule them (weekly, every 2 weeks or monthly); generated reports are kept 12 months in the new “Reports” menu." },
  { date: "2026-10-21", es: "Guion de llamada editable por campaña. Nuevas pestañas «Resumen» (indicadores y leyenda, como en la Matriz) y «Seguimiento» (avance por persona, mover tareas, cubrir ausencias). La asignación automática puede considerar la carga actual de cada persona. Los administradores registran vacaciones, días libres y no disponibilidad en «Usuarios»; durante la ausencia otra persona cubre las tareas y vuelven solas al terminar.", en: "Editable call script per campaign. New “Summary” tab (indicators and legend, as in the Matriz) and “Follow-up” tab (progress per person, move tasks, cover absences). Automatic assignment can take each person's current workload into account. Administrators record vacations, days off and unavailability in “Users”; during the absence someone else covers the tasks, and they go back by themselves at the end." },
  { date: "2026-10-21", es: "La aplicación responde más rápido: cada pantalla aparece al instante con su contorno mientras llegan los datos, guardar una llamada tarda menos y los tableros cargan antes. En «Registro», los administradores ven dónde están la base de datos y los servidores.", en: "The app responds faster: each screen appears instantly with its outline while the data arrives, saving a call takes less time and dashboards load sooner. In “Log”, administrators see where the database and the servers are." },
  { date: "2026-10-21", es: "Nuevo «Llamadas realizadas»: cada llamada con su resumen; supervisores y administradores la marcan «Revisada» con un comentario que el agente ve en su historial. «Exportar» permite elegir hojas, columnas y filtros. En los tableros, cada número, barra y fila abre la lista de establecimientos, con descarga en Excel.", en: "New “Calls made”: every call with its summary; supervisors and administrators mark it “Reviewed” with a comment the agent sees in their history. “Export” lets you choose sheets, columns and filters. On dashboards, every number, bar and row opens the list of establishments, with an Excel download." },
  { date: "2026-10-21", es: "Mis llamadas: contador rojo en el menú y aviso con las llamadas que requieren atención; las nuevas primero y luego las que llevan más días esperando; seguimientos vencidos resaltados en amarillo; filtro por número de intentos. La hora de cada llamada se registra sola al guardar.", en: "My calls: red counter in the menu and a notice with the calls that need attention; new ones first, then those waiting longest; overdue follow-ups highlighted in yellow; filter by number of attempts. Each call's time is recorded automatically on save." },
  { date: "2026-10-20", es: "Logo y colores del Ministerio de Turismo en toda la aplicación. Tableros más claros: arriba las 4 metas del plan con su barra de avance, luego los conteos, los gráficos y las tablas de detalle en pestañas.", en: "Ministerio de Turismo logo and colours throughout the app. Clearer dashboards: the plan's 4 goals with progress bars on top, then counts, charts and detail tables in tabs." },
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
      "«Para hoy»: llamadas pendientes y seguimientos que ya tocan. Primero las nuevas (sin llamar), luego las que llevan más días esperando («Pendiente hace 3 días»). Los seguimientos vencidos se resaltan en amarillo. «Programadas»: reintentos y seguimientos de días próximos. «Pasaron a visita» y «Finalizadas»: ya no requieren llamada.",
      "El número rojo junto a «Mis llamadas» en el menú y el aviso amarillo al entrar indican cuántas llamadas requieren atención. Cada pestaña muestra su cantidad.",
      "Filtre por número de intentos (sin intentos, 1, 2, 3 o más) con los botones a la derecha de las pestañas.",
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
      "Pulse «Guardar». La fecha y la hora de la llamada se registran solas en ese momento, y la tarea pasa sola al estado que corresponde.",
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
      "«Tareas y asignación»: la lista muestra cada establecimiento con su último resultado. «Asignar tareas» abre un panel con el método (repartir equitativamente, por zona o todo a un agente); los establecimientos de la misma empresa quedan con el mismo agente. Junto a cada persona se ve su carga actual («N abiertos») y, si está ausente hoy, «Ausente» (queda sin marcar). Con «Considerar la carga actual de cada persona», al repartir equitativamente recibe más quien tiene menos trabajo abierto en las campañas activas. También puede marcar filas y usar «Asignar seleccionadas a», o cambiar el agente de una fila (se guarda solo). El filtro «Seguimiento» muestra: abiertas, para hoy, seguimiento vencido, sin actividad hace más de N días o con cobertura por ausencia.",
      "«Configuración» → «Guion de llamada» (administradores y supervisores): el texto que ven los agentes en «Guion» al abrir cada tarea de la campaña, en español y, si quiere, en inglés.",
      "«Correos»: registre la fecha de envío del correo masivo y cargue los correos rebotados.",
      "«Actualización de estatus»: cargue el estatus de SIGTUR para medir quién pasó a «En proceso».",
      "«Exportar»: marque las hojas que quiere (Matriz, Llamadas, Teléfonos, Visitas, Cambios de estatus) y, en «Elegir columnas», las columnas de cada una. Puede filtrar por fechas, agente asignado, zona, prioridad, resultado y estado de la tarea. «Descargar Excel» baja solo lo elegido; su última elección se recuerda en ese navegador. También puede bajar todas las llamadas en CSV.",
    ],
  },
  {
    id: "dashboards", roles: ["supervisor", "admin"], title: "Tableros",
    bullets: [
      "«Tablero» de cada campaña: arriba las 4 metas del plan (llamados, contacto efectivo, compromisos, vencidas → en proceso) con una barra verde si se alcanza la meta y naranja si no; la raya oscura marca la meta. Debajo: conteos y avance del periodo, otras metas, gráficos, y las tablas por agente, zona, prioridad y subsector en pestañas.",
      "Haga clic en cualquier número, barra, fila o leyenda (por ejemplo «Requieren visita») para ver la lista de establecimientos que lo forman, con el agente y el último resultado. «Descargar (Excel)» baja esa lista.",
      "«Estadísticas globales»: compara todas las campañas y suma sus resultados.",
    ],
  },
  {
    id: "reviews", roles: ["supervisor", "admin", "agent"], title: "Llamadas realizadas y revisión",
    bullets: [
      "«Llamadas realizadas» muestra cada llamada con fecha y hora, agente, establecimiento, número marcado y resultado. Filtre por campaña, fechas, agente, resultado y «Sin revisar» / «Revisada».",
      "Haga clic en la fecha para abrir el resumen: quién atendió y su cargo, las respuestas, el compromiso, el obstáculo, las notas y si se envió WhatsApp.",
      "Supervisores y administradores: escriban un comentario (opcional) y pulsen «Marcar como revisada». Pueden actualizar la revisión después.",
      "Agentes: ven solo sus propias llamadas y el comentario de revisión, también en el historial de la tarea. Una llamada guardada no se puede editar.",
    ],
  },
  {
    id: "reports", roles: ["supervisor", "admin"], title: "Informes en PDF o PowerPoint",
    steps: [
      "«Estadísticas globales» → «Generar informe».",
      "Elija las campañas (todas, solo activas o cuáles), el período de la actividad (todo, semana pasada, últimos 7 días, mes en curso, mes pasado o fechas exactas), el título y, si quiere, comentarios para la primera página.",
      "Marque las secciones: metas del plan, conteos, comparación por campaña, resultados, avance por agente, zona/prioridad/subsector, estatus SIGTUR y canal, llamadas por día, leyenda y detalle de establecimientos (sin teléfonos ni contactos).",
      "Elija PDF o PowerPoint y pulse «Descargar». El informe usa los datos del momento.",
      "«Guardar como plantilla» guarda la elección con un nombre. Con «Programación» (semanal, cada 2 semanas o mensual) se genera sola ese día a primera hora; con «Semana pasada» o «Mes pasado» el período se ajusta solo.",
      "Menú «Informes»: los informes generados (se guardan 12 meses) con un contador rojo de nuevos, y las plantillas para «Generar ahora», pausar o eliminar.",
    ],
  },
  {
    id: "summary", roles: ["supervisor", "admin"], title: "Resumen y leyenda",
    bullets: [
      "Pestaña «Resumen» de cada campaña: la tabla de indicadores de la Matriz (establecimientos a intervenir, con correo o teléfono válido, sin contacto, prioridades, empresas con 2+ establecimientos, zonas, vencidas hace más de 5 años), por Vencidas, Sin licencia y Total, calculada al momento.",
      "Debajo, la leyenda: qué significa P1, P2 y P3; cada resultado de llamada y de visita y qué pasa después; los estatus SIGTUR, los canales y los estados de la tarea.",
    ],
  },
  {
    id: "followup", roles: ["supervisor", "admin"], title: "Seguimiento del equipo",
    bullets: [
      "Pestaña «Seguimiento»: una fila por persona con tareas asignadas, abiertas, para hoy, seguimientos vencidos y sin actividad hace más de 3 días, además de su disponibilidad. Cada número abre esas tareas.",
      "«Mover sus tareas abiertas»: las pasa de forma permanente a una persona o las reparte de forma equitativa (puede considerar la carga actual).",
      "Si alguien tiene una ausencia hoy o en los próximos 14 días, aparece un aviso con sus tareas abiertas sin cubrir. «Cubrir durante la ausencia» elige quién las atiende (una persona o repartidas). Pasan a esa persona el primer día de la ausencia y vuelven solas a su dueño después del último día, si la campaña sigue abierta. Las llamadas quedan registradas a nombre de quien las hizo.",
    ],
  },
  {
    id: "absences", roles: ["admin"], title: "Ausencias (vacaciones, días libres)",
    steps: [
      "«Usuarios» → «Ausencias» en la fila de la persona.",
      "Elija desde, hasta y el tipo (Vacaciones, Día libre o No disponible); la nota es opcional. Son días completos.",
      "Mientras está ausente, la persona aparece como «Ausente» y queda fuera de la asignación automática. Si elimina la ausencia, las tareas cubiertas vuelven a ella de inmediato.",
    ],
  },
  {
    id: "admin", roles: ["admin"], title: "Administración: usuarios, seguridad y registro",
    bullets: [
      "«Usuarios»: «+ Nuevo usuario» abre una ventana (si deja la contraseña vacía será usuario + 123). «Editar» abre la misma ventana para cambiar nombre, usuario, rol, estado o contraseña.",
      "Por seguridad, eliminar una campaña, crear usuarios o cambiar rol, estado o contraseña pide confirmar su contraseña si su último ingreso fue hace más de 10 minutos.",
      "«Registro» → «Actividad»: quién hizo qué y cuándo (ingresos, cambios de usuarios, cargas, asignaciones, llamadas, visitas, descargas de datos). «Errores»: fallos de la aplicación. Se puede filtrar y descargar en CSV. Arriba, «Ubicación y velocidad» muestra dónde están la base de datos y los servidores y cuánto tarda una respuesta; si dice que están lejos, avise a soporte.",
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
      "“Due today”: pending calls and follow-ups that are due. New ones (never called) first, then those waiting longest (“Waiting for 3 days”). Overdue follow-ups are highlighted in yellow. “Scheduled”: retries and follow-ups for coming days. “Sent to visit” and “Done”: no call needed.",
      "The red number next to “My calls” in the menu and the yellow notice on entering show how many calls need attention. Each tab shows its count.",
      "Filter by number of attempts (none, 1, 2, 3 or more) with the buttons to the right of the tabs.",
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
      "Click “Save”. The date and time of the call are recorded automatically at that moment, and the task moves to the right status on its own.",
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
      "“Tasks & assignment”: the list shows each establishment with its last result. “Assign tasks” opens a panel with the method (split evenly, by zone or all to one agent); establishments of the same company stay with the same agent. Next to each person you see their current load (“N open”) and, if absent today, “Absent” (left unticked). With “Take each person's current workload into account”, an even split gives more to whoever has less open work in active campaigns. You can also tick rows and use “Assign selected to”, or change a row's agent (it saves on its own). The “Follow-up” filter shows: open, due today, overdue follow-up, no activity for more than N days, or covered for an absence.",
      "“Settings” → “Call script” (administrators and supervisors): the text agents see under “Script” when they open each task of the campaign, in Spanish and, optionally, English.",
      "“Emails”: log the mass email's send date and upload bounced emails.",
      "“Status update”: upload the SIGTUR status to measure who moved to “En proceso”.",
      "“Export”: tick the sheets you want (Matriz, Calls, Phones, Visits, Status changes) and, under “Choose columns”, the columns of each. You can filter by dates, assigned agent, zone, priority, result and task status. “Download Excel” gets only what you chose; your last choice is remembered in that browser. You can also download every call as CSV.",
    ],
  },
  {
    id: "dashboards", roles: ["supervisor", "admin"], title: "Dashboards",
    bullets: [
      "Each campaign's “Dashboard”: the plan's 4 goals on top (called, effective contact, commitments, expired → in process), with a green bar when the target is met and orange when not; the dark mark shows the target. Below: counts and period progress, other goals, charts, and the tables by agent, zone, priority and subsector in tabs.",
      "Click any number, bar, row or legend (for example “Need a visit”) to see the list of establishments behind it, with the agent and last result. “Download (Excel)” gets that list.",
      "“Global statistics”: compares every campaign and adds up their results.",
    ],
  },
  {
    id: "reviews", roles: ["supervisor", "admin", "agent"], title: "Calls made and review",
    bullets: [
      "“Calls made” shows every call with date and time, agent, establishment, number dialed and result. Filter by campaign, dates, agent, result and “Not reviewed” / “Reviewed”.",
      "Click the date to open the summary: who answered and their role, the answers, the commitment, the obstacle, the notes and whether a WhatsApp was sent.",
      "Supervisors and administrators: write a comment (optional) and press “Mark as reviewed”. You can update the review later.",
      "Agents: see only their own calls and the review comment, also in the task history. A saved call can't be edited.",
    ],
  },
  {
    id: "reports", roles: ["supervisor", "admin"], title: "PDF or PowerPoint reports",
    steps: [
      "“Global statistics” → “Generate report”.",
      "Choose the campaigns (all, active only or which ones), the activity period (everything, last week, last 7 days, this month, last month or exact dates), the title and, optionally, comments for the first page.",
      "Tick the sections: plan goals, counts, comparison by campaign, results, progress by agent, zone/priority/subsector, SIGTUR status and channel, calls per day, legend and establishment detail (no phones or contacts).",
      "Choose PDF or PowerPoint and press “Download”. The report uses the data at that moment.",
      "“Save as template” keeps the choice under a name. With “Schedule” (weekly, every 2 weeks or monthly) it is generated by itself that day early in the morning; with “Last week” or “Last month” the period adjusts by itself.",
      "“Reports” menu: the generated reports (kept 12 months) with a red counter for new ones, and the templates to “Generate now”, pause or delete.",
    ],
  },
  {
    id: "summary", roles: ["supervisor", "admin"], title: "Summary and legend",
    bullets: [
      "Each campaign's “Summary” tab: the Matriz indicator table (establishments to work on, with a valid email or phone, no contact, priorities, companies with 2+ establishments, zones, expired more than 5 years ago), by Vencidas, Sin licencia and Total, calculated live.",
      "Below, the legend: what P1, P2 and P3 mean; every call and visit result and what happens next; SIGTUR statuses, channels and task statuses.",
    ],
  },
  {
    id: "followup", roles: ["supervisor", "admin"], title: "Team follow-up",
    bullets: [
      "“Follow-up” tab: one row per person with tasks assigned, open, due today, overdue follow-ups and no activity for more than 3 days, plus their availability. Each number opens those tasks.",
      "“Move their open tasks”: hands them over permanently to one person or shares them evenly (optionally by current workload).",
      "If someone has an absence today or in the next 14 days, a notice shows their open tasks not covered. “Cover during the absence” chooses who handles them (one person or shared). They move to that person on the first absent day and go back to the owner by themselves after the last one, if the campaign is still open. Calls stay recorded under whoever made them.",
    ],
  },
  {
    id: "absences", roles: ["admin"], title: "Absences (vacations, days off)",
    steps: [
      "“Users” → “Absences” on the person's row.",
      "Choose from, to and the type (Vacation, Day off or Unavailable); the note is optional. Whole days only.",
      "While absent, the person shows as “Absent” and is left out of automatic assignment. If you delete the absence, covered tasks go back to them at once.",
    ],
  },
  {
    id: "admin", roles: ["admin"], title: "Administration: users, security and log",
    bullets: [
      "“Users”: “+ New user” opens a pop-up (an empty password becomes username + 123). “Edit” opens the same pop-up to change name, username, role, status or password.",
      "For security, deleting a campaign, creating users or changing a role, status or password asks you to confirm your password if your last sign-in was more than 10 minutes ago.",
      "“Log” → “Activity”: who did what and when (sign-ins, user changes, uploads, assignments, calls, visits, data downloads). “Errors”: app failures. Filter and download as CSV. On top, “Location and speed” shows where the database and servers are and how long a response takes; if it says they are far apart, tell support.",
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
