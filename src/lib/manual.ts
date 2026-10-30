// In-app manual (/help). Every change that alters what people see or do must update this file in the
// same pull request, and add a dated line to WHATS_NEW (newest first). See CLAUDE.md.
import type { Lang } from "./catalog";

type Section = { id: string; roles: string[]; title: string; intro?: string; steps?: string[]; bullets?: string[] };
type L<T> = Record<Lang, T>;

export const WHATS_NEW: { date: string; es: string; en: string }[] = [
  { date: "2026-10-30", es: "Correo: en la llamada el correo aparece ya escrito y se puede corregir, con la nueva pregunta «¿Recibió el correo?»; en la visita, «Nuevo correo». Filtro «¿Recibió el correo?» en «Tareas y asignación» y dos botones: «Nueva campaña de llamadas con estas tareas» y «Nueva campaña de correo con estas tareas» (sin llamadas; las tareas originales siguen). Nuevo «Reporte de cambios» en «Informes»: cada dato cambiado, con su historia, para actualizar SIGTUR a mano y marcarlo como hecho.", en: "Email: in the call the email is already filled in and can be corrected, with the new question “Did they receive the email?”; in the visit, “New email”. “Did they receive the email?” filter in “Tasks and assignment” and two buttons: “New call campaign from these tasks” and “New email campaign from these tasks” (no calls; the original tasks keep going). New “Change report” in “Reports”: every changed detail, with its history, to update SIGTUR by hand and mark it done." },
  { date: "2026-10-30", es: "Pantallas más cómodas: el menú lateral se puede plegar a solo iconos («Plegar menú») y queda a la vista al bajar; todos los filtros aceptan varias opciones, que se ven como etiquetas que se quitan con ×; en «Tareas y asignación» la barra para asignar o eliminar aparece abajo al marcar filas; las confirmaciones usan una ventana propia de la aplicación y «Guardado» aparece como aviso verde arriba a la derecha; en el celular el menú se abre con ☰; «?» explica cada indicador y «↑ Arriba» vuelve al inicio en páginas largas.", en: "Easier screens: the side menu folds down to icons (“Collapse menu”) and stays in view when scrolling; every filter accepts several choices, shown as labels you remove with ×; in “Tasks and assignment” the bar to assign or remove appears at the bottom when rows are ticked; confirmations use the app's own window and “Saved” appears as a green notice at the top right; on phones the menu opens with ☰; “?” explains each indicator and “↑ Top” goes back up on long pages." },
  { date: "2026-10-29", es: "Informes por agente: en «Generar informe», «Elegir agentes» crea un informe por persona (sus tareas y sus llamadas), también programado. Botón «Generar informe» en «Resumen del agente».", en: "Reports per agent: in “Generate report”, “Choose agents” makes one report per person (their tasks and their calls), also scheduled. “Generate report” button in “Agent summary”." },
  { date: "2026-10-29", es: "Nuevo «Resumen del agente»: al pulsar el nombre de una persona en «Estadísticas», «Tablero» o «Seguimiento» se ven sus números, resultados, llamadas por día y todas sus llamadas, cada una con su detalle. Los agentes ven el suyo con «Mi resumen».", en: "New “Agent summary”: pressing a person's name in “Statistics”, “Dashboard” or “Follow-up” shows their numbers, results, calls per day and all their calls, each with its detail. Agents see their own with “My summary”." },
  { date: "2026-10-26", es: "Los administradores pueden eliminar RUT de una campaña en curso, desde un archivo («Actualización de estatus») o con los filtros de «Tareas y asignación» (nuevos filtros: estatus RNT, subsector / tipo, prioridad y último resultado). Antes de borrar se ven los conteos; queda el motivo en «Eliminadas».", en: "Administrators can remove RUTs from a running campaign, from a file (“Status update”) or with the “Tasks and assignment” filters (new filters: RNT status, subsector / type, priority and last result). Counts are shown before deleting; the reason stays in “Removed”." },
  { date: "2026-10-26", es: "Avisos de otras campañas (compromiso anterior o encontrado cerrado), estatus RNT en «Misma empresa», «Actualizar datos» en llamadas y visitas, plazos en las solicitudes SIGTUR, «Estado de operación» en Resumen, Estadísticas, informes y filtros, «Registro» con las decisiones de la aplicación y «Envío automático a SIGTUR» listo (apagado hasta completar la conexión).", en: "Warnings from other campaigns (earlier commitment or found closed), RNT status in “Same company”, “Update details” in calls and visits, deadlines on SIGTUR requests, “Operating status” in Summary, Statistics, reports and filters, “Log” with the app's own decisions and “Automatic sending to SIGTUR” ready (off until the connection is complete)." },
  { date: "2026-10-22", es: "«Campañas» separa la «Campaña permanente» (Solicitudes SIGTUR) de las «Campañas temporales». Los administradores pueden encender o poner en pausa las solicitudes de llamada de SIGTUR; las tareas abiertas siguen en curso.", en: "“Campaigns” separates the “Permanent campaign” (Solicitudes SIGTUR) from the “Temporary campaigns”. Administrators can switch SIGTUR call requests on or pause them; open tasks keep going." },
  { date: "2026-10-22", es: "Nuevo: «Nueva campaña con estas tareas» (crea una campaña en borrador con las tareas elegidas de otra campaña), conexión con SIGTUR (solicitudes de llamada con la etiqueta morada «Solicitud SIGTUR», campañas enviadas desde SIGTUR y un registro de interacción por cada llamada, visita y correo), el menú «Integraciones» para administradores y «Descargar interacciones» en «Informes». Los administradores pueden eliminar informes generados.", en: "New: “New campaign from these tasks” (creates a draft campaign with the chosen tasks of another campaign), connection with SIGTUR (call requests with the purple “SIGTUR request” tag, campaigns sent from SIGTUR and an interaction record for every call, visit and email), the “Integrations” menu for administrators and “Download interactions” in “Reports”. Administrators can delete generated reports." },
  { date: "2026-10-22", es: "«Informes» tiene su propio botón «Generar informe» (el mismo panel que en «Estadísticas globales») y un botón «Editar» en cada plantilla. La lista se actualiza sola después de descargar.", en: "“Reports” has its own “Generate report” button (the same panel as in “Global statistics”) and an “Edit” button on each template. The list updates by itself after downloading." },
  { date: "2026-10-21", es: "Los servidores de la aplicación ahora están junto a la base de datos (Ohio): cada pantalla y cada guardado responden más rápido.", en: "The app's servers now sit next to the database (Ohio): every screen and every save responds faster." },
  { date: "2026-10-21", es: "Todo informe descargado desde «Generar informe» también queda guardado en «Informes».", en: "Every report downloaded from “Generate report” is also kept in “Reports”." },
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
      "El menú de la izquierda muestra solo lo que su rol puede usar y queda a la vista al bajar por la página. «Plegar menú» (abajo) lo deja en solo iconos; la elección se recuerda en esa computadora. En el celular el menú se abre con el botón ☰.",
      "Todos los filtros aceptan varias opciones: marque las que quiera y pulse «Filtrar». Dentro de un mismo filtro se muestra lo que cumpla cualquiera de las marcadas; entre filtros distintos, lo que cumpla todos. Cada opción elegida aparece como una etiqueta que se quita con ×; «Quitar todos» limpia los filtros.",
      "Al guardar aparece un aviso verde arriba a la derecha que se va solo. Antes de borrar o apagar algo, la aplicación pregunta en su propia ventana. El «?» junto a un indicador explica qué mide, y en páginas largas «↑ Arriba» vuelve al inicio.",
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
      "«Mi resumen» (arriba a la derecha) abre su propio resumen: sus números, resultados, llamadas por día y todas sus llamadas.",
    ],
  },
  {
    id: "log-call", roles: ["agent", "supervisor", "admin"], title: "Registrar una llamada",
    steps: [
      "Abra la tarjeta. Revise el guion, los teléfonos y los datos del establecimiento.",
      "Si el mismo RNC tiene otros establecimientos, puede marcarlos en «Registrar esta llamada también para» y se registrará la misma llamada para todos.",
      "Elija el número marcado y responda: ¿pudo contactar a alguien?, ¿le atendieron?",
      "Si habló con alguien: con quién, su cargo y si es el responsable. El «Correo» aparece ya escrito: corríjalo si cambió. Responda «¿Recibió el correo?» (Sí / No).",
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
      "«Tareas y asignación»: la lista muestra cada establecimiento con su último resultado. «Asignar tareas» abre un panel con el método (repartir equitativamente, por zona o todo a un agente); los establecimientos de la misma empresa quedan con el mismo agente. Junto a cada persona se ve su carga actual («N abiertos») y, si está ausente hoy, «Ausente» (queda sin marcar). Con «Considerar la carga actual de cada persona», al repartir equitativamente recibe más quien tiene menos trabajo abierto en las campañas activas. También puede marcar filas: abajo aparece una barra con «Asignar seleccionadas a» (y «Eliminar…» para administradores); la × la cierra y desmarca todo. O cambie el agente de una fila (se guarda solo). El filtro «Seguimiento» muestra: abiertas, para hoy, seguimiento vencido, sin actividad hace más de N días o con cobertura por ausencia.",
      "«Configuración» → «Guion de llamada» (administradores y supervisores): el texto que ven los agentes en «Guion» al abrir cada tarea de la campaña, en español y, si quiere, en inglés.",
      "«Correos»: registre la fecha de envío del correo masivo y cargue los correos rebotados. La lista para combinar correspondencia usa el correo corregido cuando lo hay.",
      "«Actualización de estatus»: cargue el estatus de SIGTUR para medir quién pasó a «En proceso».",
      "Filtros extra en «Tareas y asignación»: estatus RNT, subsector / tipo, prioridad y último resultado. Todos aceptan varias opciones (por ejemplo «Sin llamar» y «Reintentar» a la vez).",
      "«Exportar»: marque las hojas que quiere (Matriz, Llamadas, Teléfonos, Visitas, Cambios de estatus) y, en «Elegir columnas», las columnas de cada una. Puede filtrar por fechas, agente asignado, zona, prioridad, resultado y estado de la tarea. «Descargar Excel» baja solo lo elegido; su última elección se recuerda en ese navegador. También puede bajar todas las llamadas en CSV.",
      "La pantalla «Campañas» tiene dos bloques: arriba la «Campaña permanente» (Solicitudes SIGTUR, sin fechas, con su interruptor) y debajo las «Campañas temporales».",
    ],
  },
  {
    id: "dashboards", roles: ["supervisor", "admin"], title: "Tableros",
    bullets: [
      "«Tablero» de cada campaña: arriba las 4 metas del plan (llamados, contacto efectivo, compromisos, vencidas → en proceso) con una barra verde si se alcanza la meta y naranja si no; la raya oscura marca la meta. Debajo: conteos y avance del periodo, otras metas, gráficos, y las tablas por agente, zona, prioridad y subsector en pestañas.",
      "Haga clic en cualquier número, barra, fila o leyenda (por ejemplo «Requieren visita») para ver la lista de establecimientos que lo forman, con el agente y el último resultado. «Descargar (Excel)» baja esa lista.",
      "«Estadísticas globales»: compara todas las campañas y suma sus resultados.",
      "En «Por agente», el nombre de cada persona abre su «Resumen del agente».",
    ],
  },
  {
    id: "agent-summary", roles: ["supervisor", "admin", "agent"], title: "Resumen del agente",
    bullets: [
      "Se abre al pulsar el nombre de una persona en «Estadísticas globales» o en el «Tablero» de una campaña («Por agente»), en «Seguimiento», o con «Mi resumen» en «Mis llamadas».",
      "Arriba: tareas asignadas, abiertas y para hoy, llamadas (y de hoy), contactos con %, compromisos y llamadas sin revisar. Debajo: resultados de sus llamadas (cada uno filtra la lista) y llamadas por día.",
      "Al final, todas sus llamadas con filtros de resultado y revisión; la fecha abre el resumen completo de la llamada, donde se puede revisar o abrir la tarea.",
      "Desde una campaña muestra esa campaña («ver todas las campañas» para el resto). «Desde / Hasta» cambia las llamadas, contactos, compromisos y resultados; las tareas se cuentan como están hoy.",
      "Supervisores y administradores ven el de cualquier persona; cada agente solo el suyo.",
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
      "«Estadísticas globales» o «Informes» → «Generar informe» (el mismo panel en los dos lugares).",
      "Elija las campañas (todas, solo activas o cuáles), el período de la actividad (todo, semana pasada, últimos 7 días, mes en curso, mes pasado o fechas exactas), el título y, si quiere, comentarios para la primera página.",
      "Marque las secciones: metas del plan, conteos, comparación por campaña, resultados, avance por agente, zona/prioridad/subsector, estatus SIGTUR y canal, llamadas por día, leyenda y detalle de establecimientos (sin teléfonos ni contactos).",
      "Elija PDF o PowerPoint y pulse «Descargar». El informe usa los datos del momento y también queda guardado en «Informes».",
      "«Guardar como plantilla» guarda la elección con un nombre. Con «Programación» (semanal, cada 2 semanas o mensual) se genera sola ese día a primera hora; con «Semana pasada» o «Mes pasado» el período se ajusta solo.",
      "Menú «Informes»: los informes generados (se guardan 12 meses) con un contador rojo de nuevos, y las plantillas para «Editar» (abre el panel con la plantilla cargada), «Generar ahora», pausar o eliminar.",
      "Solo los administradores ven «Eliminar» junto a cada informe generado (pide confirmación y queda en el «Registro»).",
      "«Descargar interacciones»: elija las fechas y descargue un Excel con cada llamada, visita y correo del período, con los campos de interacción de SIGTUR.",
      "«Agentes»: «Todo el equipo» (como siempre) o «Elegir agentes»: un informe por persona, con las tareas asignadas hoy a esa persona y las llamadas que hizo en el período. Con 2 o más se descarga un .zip; cada informe queda en «Informes» con el nombre del agente. Las plantillas y la programación recuerdan los agentes elegidos. En «Resumen del agente», «Generar informe» abre el panel con esa persona, la campaña y el período ya elegidos.",
    ],
  },
  {
    id: "transfer", roles: ["supervisor", "admin"], title: "Nueva campaña con resultados de otra",
    steps: [
      "En la lista de tareas de una campaña pulse «Nueva campaña de llamadas con estas tareas» o «Nueva campaña de correo con estas tareas». Puede filtrar también por «¿Recibió el correo?».",
      "«Campaña de correo»: no tiene llamadas ni agentes y no aparece en «Mis llamadas». Sus pestañas son «Correos» (lista para combinar correspondencia con el correo corregido, marcar enviados, cargar rebotados), «Tareas», «Exportar» y «Configuración». Las tareas de la campaña original siguen en curso.",
      "Marque los estados que quiere llevar (por ejemplo En seguimiento, Reintentar, Visita) y, si quiere, filtre por resultado, zona, prioridad o persona. El número de tareas se actualiza al momento.",
      "Complete el nombre, fechas, intentos y días de seguimiento de la nueva campaña y pulse «Crear campaña y transferir».",
      "Campaña de llamadas: la nueva campaña queda en «Borrador», con los establecimientos y teléfonos copiados, el guion de la original y una nota en cada tarea: «Viene de «…»: último resultado …». Revísela, asígnela y actívela.",
      "En la campaña original esas tareas quedan cerradas como «Transferida», con un enlace a la nueva; ya no se pueden llamar allí.",
    ],
  },
  {
    id: "sigtur-requests", roles: ["agent", "supervisor", "admin"], title: "Solicitudes SIGTUR",
    bullets: [
      "Otros analistas pueden pedir una llamada desde SIGTUR. Llega a la campaña «Solicitudes SIGTUR» (siempre abierta) y se asigna sola, según la carga de trabajo, a las personas elegidas en «Integraciones» (quien está de ausencia no recibe).",
      "Estas tareas llevan la etiqueta morada «Solicitud SIGTUR» con quién la pidió y por qué, y salen primero en «Para hoy».",
      "Si la empresa ya tenía una tarea abierta, no se crea otra: esa tarea recibe la etiqueta y vuelve a «Para hoy».",
      "Plazo: 2 días laborables (lunes a viernes) desde que llega, o la fecha que mande SIGTUR. La etiqueta muestra «vence dd/mm», luego «Vence mañana» (naranja) y «Vencida hace N días» (rojo); las más urgentes salen primero. «Seguimiento» cuenta las «Solicitudes SIGTUR vencidas» por persona.",
      "Queda resuelta cuando alguien contesta (resultados 01–06) o la tarea pasa a visita; entonces se avisa a SIGTUR con el resultado («Solicitud resuelta»).",
      "Un administrador puede apagar o encender las solicitudes con el interruptor del bloque «Campaña permanente» (en «Campañas» o «Integraciones»). Apagada, SIGTUR recibe «Solicitudes de llamada en pausa» y no llegan llamadas nuevas; las tareas abiertas siguen con sus agentes y se pueden terminar. Los supervisores ven si está encendida o en pausa. Esta campaña no se cierra ni se elimina.",
      "Las campañas que se creen desde SIGTUR llegan como «Borrador» con sus establecimientos; un supervisor o administrador las revisa, asigna y activa.",
    ],
  },
  {
    id: "sigtur-interactions", roles: ["supervisor", "admin", "agent"], title: "Interacciones para SIGTUR",
    bullets: [
      "Cada llamada (una por establecimiento), visita y correo enviado genera un registro de interacción: ID SIGTUR, RUT, canal, fecha y hora, quién la hizo, número, persona contactada, resultado (en texto), fecha de compromiso, obstáculo y notas.",
      "Se ve en el resumen de cada llamada, en el recuadro «Registro para SIGTUR».",
      "SIGTUR los lee solo a través de la conexión; también se pueden descargar en Excel desde «Informes» → «Descargar interacciones».",
    ],
  },
  {
    id: "integrations", roles: ["admin"], title: "Integraciones (SIGTUR)",
    steps: [
      "Menú «Integraciones» → «Crear clave». La clave se muestra una sola vez: cópiela y entréguela al equipo de SIGTUR junto con la guía «docs/sigtur-integracion.md». La aplicación solo guarda una huella, no la clave.",
      "Si la clave se pierde o se filtra, pulse «Revocar» y cree otra. SIGTUR deja de entrar con la anterior al instante.",
      "Marque quién recibe las solicitudes de llamada y pulse «Guardar».",
      "«Recibir solicitudes de llamada»: interruptor Encendida / Apagada (pide confirmación para apagar). Apagada, SIGTUR recibe «en pausa» y la simulación tampoco crea tareas.",
      "«Simular solicitud SIGTUR» crea una solicitud de prueba, igual a las reales, para ver el recorrido antes de conectar SIGTUR.",
      "«Últimas solicitudes recibidas» muestra lo que SIGTUR envió o leyó, y si fue aceptado o rechazado.",
    ],
  },
  {
    id: "sigtur-push", roles: ["admin"], title: "Envío automático a SIGTUR",
    steps: [
      "Desde ahora cada llamada, visita y correo (interacciones), cada cambio de datos que decide una persona (solicitudes de cambio) y cada solicitud SIGTUR resuelta quedan en «Integraciones» → «Envío automático a SIGTUR» → «Pendientes de envío».",
      "El envío está apagado mientras se completa la conexión: nada sale y nada se pierde.",
      "Cuando SIGTUR entregue su dirección, escríbala en «Dirección de SIGTUR para recibir» y pulse «Guardar».",
      "Cuando SIGTUR entregue su clave, péguela en Vercel → su proyecto → Settings → Environment Variables con el nombre SIGTUR_PUSH_KEY y vuelva a desplegar. Nunca la escriba en la aplicación ni la envíe por mensaje.",
      "Con dirección y clave listas, pulse «Apagado» para encender: lo que estaba en espera sale en orden. Si SIGTUR no responde, se reintenta solo; «Reintentar ahora» fuerza un intento.",
    ],
  },
  {
    id: "update-data", roles: ["agent", "inspector", "supervisor", "admin"], title: "Actualizar datos del establecimiento",
    bullets: [
      "En la llamada, al elegir el resultado «Cambió dueño / nombre / dirección» aparecen «Nuevo nombre comercial», «Nueva dirección» y «Dueño / responsable» dentro del mismo recuadro del establecimiento.",
      "En la visita, «Actualizar datos (si cambió)» debajo de las notas, con «Nuevo correo».",
      "El correo corregido reemplaza al anterior desde ese momento (lista de correo, exportaciones, llamada) y quita la marca de rebotado. El anterior queda en el «Reporte de cambios».",
      "«Informes» → «Reporte de cambios»: cada dato cambiado (correo, nombre, dirección, dueño, «¿En operación?», cerrado desde) con RUT, ID SIGTUR, antes → ahora, quién y cuándo. Filtre por campaña, dato, fechas y «Pendiente / Actualizado en SIGTUR», descargue el Excel y, después de actualizar SIGTUR, marque las filas y pulse «Marcar como actualizado en SIGTUR». Incluye la historia: los cambios desde el 26 oct y los correos corregidos antes (con fecha aproximada).",
      "Cada dato que cambia una persona (estos campos, el correo actualizado, «¿En operación?», la fecha de cierre y los teléfonos agregados, sustituidos o marcados como equivocados) se envía a SIGTUR como solicitud de cambio y queda en «Registro».",
    ],
  },
  {
    id: "remove-ruts", roles: ["admin"], title: "Eliminar RUT de una campaña",
    steps: [
      "Desde un archivo: «Actualización de estatus» → «Eliminar de esta campaña los RUT de un archivo». El archivo necesita una columna «RUT» o «ID SIGTUR». Pulse «Revisar».",
      "Desde la lista: «Tareas y asignación», aplique los filtros (estado, estatus RNT, subsector / tipo, zona, prioridad, último resultado…) o marque filas, y pulse «Eliminar de la campaña…». Elija «Todas las tareas con los filtros actuales» o «Solo las marcadas» y pulse «Revisar».",
      "Antes de borrar verá cuántas tareas, establecimientos, llamadas y visitas se borran, las solicitudes SIGTUR abiertas y los RUT del archivo que no están en la campaña.",
      "Escriba el motivo y la palabra ELIMINAR y confirme (si hace más de 10 minutos que ingresó, le pedirá su contraseña). No se puede deshacer: se borran la tarea, sus establecimientos, teléfonos, llamadas y visitas, y dejan de contar en los números de la campaña.",
      "Queda registrado: «Eliminadas (N)» en «Tareas y asignación» (fecha, RUT, establecimiento, motivo, llamadas, quién) con descarga en Excel, una línea en «Registro» y los compromisos y cierres para los avisos de otras campañas. Solo administradores; no se puede en campañas cerradas; máximo 5 000 RUT por vez.",
    ],
  },
  {
    id: "history", roles: ["agent", "supervisor", "admin"], title: "Avisos de otras campañas",
    bullets: [
      "Al abrir una tarea, un aviso amarillo «Compromiso anterior» indica que ese RUT se comprometió a formalizarse en otra campaña, con la campaña, la fecha de compromiso y quién lo registró.",
      "Un aviso rojo «Encontrado cerrado» indica que el RUT (o, si dice «misma empresa», otro RUT con el mismo RNC) se registró como cerrado en otra campaña, con la campaña y desde cuándo.",
      "En «Misma empresa» cada RUT muestra su estatus en RNT y su estado en la campaña, y una línea corta si tiene avisos.",
      "Los avisos también aparecen en el resumen de cada llamada y se conservan aunque se elimine la campaña anterior.",
    ],
  },
  {
    id: "operation", roles: ["supervisor", "admin"], title: "Estado de operación",
    bullets: [
      "Cada establecimiento queda como En operación, No opera / cerrado, No sabe o Sin dato, según lo último registrado (llamadas, visitas y estatus SIGTUR). Cerrado tiene prioridad.",
      "Se ve en «Resumen» (filas al final de la tabla), en «Estadísticas globales» (barra «Estado de operación» y columna «En operación» por zona, prioridad y subsector; cada número abre la lista), en los informes PDF/PowerPoint (sección «Estado de operación»), en el filtro de la lista de tareas y en la exportación a Excel.",
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
      "El nombre de cada persona abre su «Resumen del agente» para esta campaña.",
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
      "«Registro» también muestra las decisiones de la propia aplicación con «Aplicación» como autor: pasada a visita, seguimiento programado, solicitud SIGTUR asignada, resuelta o vencida, tareas cubiertas o devueltas por ausencias y envíos a SIGTUR.",
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
      "The menu on the left shows only what your role can use and stays in view when you scroll. “Collapse menu” (at the bottom) leaves only the icons; the choice is remembered on that computer. On phones the menu opens with the ☰ button.",
      "Every filter accepts several choices: tick the ones you want and press “Filter”. Within one filter you see what matches any of the ticked options; across different filters, what matches all of them. Each choice shows as a label you remove with ×; “Clear all” removes every filter.",
      "When you save, a green notice appears at the top right and goes away by itself. Before deleting or switching something off, the app asks in its own window. The “?” next to an indicator explains what it measures, and on long pages “↑ Top” goes back up.",
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
      "“My summary” (top right) opens your own summary: your numbers, results, calls per day and all your calls.",
    ],
  },
  {
    id: "log-call", roles: ["agent", "supervisor", "admin"], title: "Logging a call",
    steps: [
      "Open the card. Check the script, the phone numbers and the establishment's details.",
      "If the same RNC has other establishments, tick them under “Also log this call for” and the same call is logged for all of them.",
      "Choose the number dialed and answer: did you reach anyone? did they attend the call?",
      "If you spoke with someone: who, their role, and whether they are the person in charge. The “Email” is already filled in: correct it if it changed. Answer “Did they receive the email?” (Yes / No).",
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
      "“Tasks & assignment”: the list shows each establishment with its last result. “Assign tasks” opens a panel with the method (split evenly, by zone or all to one agent); establishments of the same company stay with the same agent. Next to each person you see their current load (“N open”) and, if absent today, “Absent” (left unticked). With “Take each person's current workload into account”, an even split gives more to whoever has less open work in active campaigns. You can also tick rows: a bar appears at the bottom with “Assign selected to” (and “Remove…” for administrators); its × closes it and unticks everything. Or change a row's agent (it saves on its own). The “Follow-up” filter shows: open, due today, overdue follow-up, no activity for more than N days, or covered for an absence.",
      "“Settings” → “Call script” (administrators and supervisors): the text agents see under “Script” when they open each task of the campaign, in Spanish and, optionally, English.",
      "“Emails”: log the mass email's send date and upload bounced emails. The mail-merge list uses the corrected email when there is one.",
      "“Status update”: upload the SIGTUR status to measure who moved to “En proceso”.",
      "Extra filters in “Tasks and assignment”: RNT status, subsector / type, priority and last result. All of them accept several choices (e.g. “Not called” and “Retry” together).",
      "“Export”: tick the sheets you want (Matriz, Calls, Phones, Visits, Status changes) and, under “Choose columns”, the columns of each. You can filter by dates, assigned agent, zone, priority, result and task status. “Download Excel” gets only what you chose; your last choice is remembered in that browser. You can also download every call as CSV.",
      "The “Campaigns” screen has two blocks: at the top the “Permanent campaign” (Solicitudes SIGTUR, no dates, with its switch) and below the “Temporary campaigns”.",
    ],
  },
  {
    id: "dashboards", roles: ["supervisor", "admin"], title: "Dashboards",
    bullets: [
      "Each campaign's “Dashboard”: the plan's 4 goals on top (called, effective contact, commitments, expired → in process), with a green bar when the target is met and orange when not; the dark mark shows the target. Below: counts and period progress, other goals, charts, and the tables by agent, zone, priority and subsector in tabs.",
      "Click any number, bar, row or legend (for example “Need a visit”) to see the list of establishments behind it, with the agent and last result. “Download (Excel)” gets that list.",
      "“Global statistics”: compares every campaign and adds up their results.",
      "In “By agent”, each person's name opens their “Agent summary”.",
    ],
  },
  {
    id: "agent-summary", roles: ["supervisor", "admin", "agent"], title: "Agent summary",
    bullets: [
      "Opens when you press a person's name in “Global statistics” or a campaign's “Dashboard” (“By agent”), in “Follow-up”, or with “My summary” in “My calls”.",
      "At the top: assigned tasks, open and due today, calls (and today's), contacts with %, commitments and calls not yet reviewed. Below: results of their calls (each one filters the list) and calls per day.",
      "At the bottom, all their calls with result and review filters; the date opens the full call summary, where you can review it or open the task.",
      "From a campaign it shows that campaign (“see all campaigns” for the rest). “From / To” changes calls, contacts, commitments and results; tasks are counted as they are today.",
      "Supervisors and administrators see anyone's; each agent only their own.",
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
      "“Global statistics” or “Reports” → “Generate report” (the same panel in both places).",
      "Choose the campaigns (all, active only or which ones), the activity period (everything, last week, last 7 days, this month, last month or exact dates), the title and, optionally, comments for the first page.",
      "Tick the sections: plan goals, counts, comparison by campaign, results, progress by agent, zone/priority/subsector, SIGTUR status and channel, calls per day, legend and establishment detail (no phones or contacts).",
      "Choose PDF or PowerPoint and press “Download”. The report uses the data at that moment and is also kept in “Reports”.",
      "“Save as template” keeps the choice under a name. With “Schedule” (weekly, every 2 weeks or monthly) it is generated by itself that day early in the morning; with “Last week” or “Last month” the period adjusts by itself.",
      "“Reports” menu: the generated reports (kept 12 months) with a red counter for new ones, and the templates to “Edit” (opens the panel with the template loaded), “Generate now”, pause or delete.",
      "Only administrators see “Delete” next to each generated report (it asks for confirmation and is recorded in the “Log”).",
      "“Download interactions”: choose the dates and download an Excel with every call, visit and email of the period, with SIGTUR's interaction fields.",
      "“Agents”: “Whole team” (as always) or “Choose agents”: one report per person, with the tasks assigned to them now and the calls they made in the period. With 2 or more a .zip is downloaded; each report is kept in “Reports” with the agent's name. Templates and schedules remember the chosen agents. In “Agent summary”, “Generate report” opens the panel with that person, campaign and period already chosen.",
    ],
  },
  {
    id: "transfer", roles: ["supervisor", "admin"], title: "New campaign from another campaign's results",
    steps: [
      "In a campaign's task list press “New call campaign from these tasks” or “New email campaign from these tasks”. You can also filter by “Did they receive the email?”.",
      "“Email campaign”: no calls and no agents, and it doesn't appear in “My calls”. Its tabs are “Emails” (mail-merge list with the corrected email, mark sent, upload bounces), “Tasks”, “Export” and “Settings”. The tasks of the original campaign keep going.",
      "Tick the statuses to take (for example Follow-up, Retry, Visit) and, if you want, filter by result, zone, priority or person. The number of tasks updates instantly.",
      "Fill in the new campaign's name, dates, attempts and follow-up days and press “Create campaign and transfer”.",
      "Call campaign: the new campaign is a “Draft”, with the establishments and phones copied, the original script and a note on each task: “Comes from «…»: last result …”. Review it, assign it and activate it.",
      "In the original campaign those tasks are closed as “Transferred”, with a link to the new one; they can no longer be called there.",
    ],
  },
  {
    id: "sigtur-requests", roles: ["agent", "supervisor", "admin"], title: "SIGTUR requests",
    bullets: [
      "Other analysts can request a call from SIGTUR. It arrives in the «Solicitudes SIGTUR» campaign (always open) and is assigned automatically, by workload, to the people chosen in “Integrations” (people on leave are skipped).",
      "These tasks carry the purple “SIGTUR request” tag with who asked and why, and come first in “Due today”.",
      "If the company already had an open task, no new one is created: that task gets the tag and goes back to “Due today”.",
      "Deadline: 2 working days (Monday to Friday) from arrival, or the date SIGTUR sends. The tag shows “due dd/mm”, then “Due tomorrow” (orange) and “Overdue by N days” (red); the most urgent come first. “Follow-up” counts “Overdue SIGTUR requests” per person.",
      "It is solved when someone answers (results 01–06) or the task goes to visit; SIGTUR is then told the result (“Request solved”).",
      "An administrator can switch requests off or on with the switch in the “Permanent campaign” block (in “Campaigns” or “Integrations”). When off, SIGTUR is told “call requests paused” and no new calls arrive; open tasks stay with their agents and can be finished. Supervisors see whether it is on or paused. This campaign can’t be closed or deleted.",
      "Campaigns created from SIGTUR arrive as “Draft” with their establishments; a supervisor or administrator reviews, assigns and activates them.",
    ],
  },
  {
    id: "sigtur-interactions", roles: ["supervisor", "admin", "agent"], title: "Interactions for SIGTUR",
    bullets: [
      "Every call (one per establishment), visit and email sent creates an interaction record: SIGTUR ID, RUT, channel, date and time, who did it, number, person contacted, result (as text), commitment date, obstacle and notes.",
      "It is shown in each call's summary, in the “Record for SIGTUR” box.",
      "SIGTUR reads them only through the connection; they can also be downloaded as Excel from “Reports” → “Download interactions”.",
    ],
  },
  {
    id: "integrations", roles: ["admin"], title: "Integrations (SIGTUR)",
    steps: [
      "“Integrations” menu → “Create key”. The key is shown only once: copy it and give it to SIGTUR's team together with the guide «docs/sigtur-integracion.md». The app keeps only a fingerprint, not the key.",
      "If the key is lost or leaked, press “Revoke” and create another. SIGTUR can no longer get in with the old one, immediately.",
      "Tick who receives call requests and press “Save”.",
      "“Receive call requests”: On / Off switch (asks for confirmation to switch off). When off, SIGTUR is told “paused” and the simulation doesn’t create tasks either.",
      "“Simulate a SIGTUR request” creates a test request, just like the real ones, to see the flow before SIGTUR connects.",
      "“Latest requests received” shows what SIGTUR sent or read, and whether it was accepted or rejected.",
    ],
  },
  {
    id: "sigtur-push", roles: ["admin"], title: "Automatic sending to SIGTUR",
    steps: [
      "From now on every call, visit and email (interactions), every data change a person decides (change requests) and every solved SIGTUR request goes to “Integrations” → “Automatic sending to SIGTUR” → “Waiting to be sent”.",
      "Sending is off while the connection is completed: nothing leaves and nothing is lost.",
      "When SIGTUR gives you its address, type it in “SIGTUR's receiving address” and press “Save”.",
      "When SIGTUR gives you its key, paste it in Vercel → your project → Settings → Environment Variables named SIGTUR_PUSH_KEY and redeploy. Never type it in the app or send it in a message.",
      "With address and key ready, press “Off” to switch on: what was waiting goes out in order. If SIGTUR doesn't answer, it retries by itself; “Retry now” forces a try.",
    ],
  },
  {
    id: "update-data", roles: ["agent", "inspector", "supervisor", "admin"], title: "Updating establishment details",
    bullets: [
      "In a call, choosing the result “Changed owner / name / address” shows “New trade name”, “New address” and “Owner / person in charge” inside the same establishment box.",
      "In a visit, “Update details (if changed)” below the notes, with “New email”.",
      "The corrected email replaces the old one from then on (mailing list, exports, call) and clears the bounce mark. The old one stays in the “Change report”.",
      "“Reports” → “Change report”: every changed detail (email, name, address, owner, “Operating?”, closed since) with RUT, SIGTUR ID, before → now, who and when. Filter by campaign, detail, dates and “Pending / Updated in SIGTUR”, download the Excel and, after updating SIGTUR, tick the rows and press “Mark as updated in SIGTUR”. It includes the history: changes since 26 Oct and emails corrected before that (approximate date).",
      "Each detail a person changes (these fields, the updated email, “Operating?”, the closing date and phones added, replaced or marked wrong) is sent to SIGTUR as a change request and recorded in “Log”.",
    ],
  },
  {
    id: "remove-ruts", roles: ["admin"], title: "Removing RUTs from a campaign",
    steps: [
      "From a file: “Status update” → “Remove this file's RUTs from this campaign”. The file needs a “RUT” or “ID SIGTUR” column. Press “Check”.",
      "From the list: in “Tasks and assignment”, apply the filters (status, RNT status, subsector / type, zone, priority, last result…) or tick rows, and press “Remove from campaign…”. Choose “All tasks matching the current filters” or “Only the ticked ones” and press “Check”.",
      "Before deleting you see how many tasks, establishments, calls and visits will be erased, open SIGTUR requests and RUTs in the file that are not in the campaign.",
      "Write the reason and the word ELIMINAR and confirm (if you signed in more than 10 minutes ago, it asks for your password). It can't be undone: the task, its establishments, phones, calls and visits are erased and stop counting in the campaign's numbers.",
      "What stays: “Removed (N)” in “Tasks and assignment” (date, RUT, establishment, reason, calls, who) with an Excel download, a line in “Log”, and commitments and closures for the warnings in other campaigns. Administrators only; not in closed campaigns; at most 5,000 RUTs at a time.",
    ],
  },
  {
    id: "history", roles: ["agent", "supervisor", "admin"], title: "Warnings from other campaigns",
    bullets: [
      "When a task opens, a yellow “Earlier commitment” warning says that RUT committed to formalize in another campaign, with the campaign, the commitment date and who recorded it.",
      "A red “Found closed” warning says the RUT (or, when it says “same company”, another RUT with the same RNC) was recorded as closed in another campaign, with the campaign and since when.",
      "In “Same company” each RUT shows its RNT status and its campaign status, plus a short line if it has warnings.",
      "The warnings also show in each call summary and stay even if the earlier campaign is deleted.",
    ],
  },
  {
    id: "operation", roles: ["supervisor", "admin"], title: "Operating status",
    bullets: [
      "Each establishment is Operating, Not operating / closed, Doesn't know or No data, from the latest record (calls, visits and SIGTUR status). Closed takes priority.",
      "It shows in “Summary” (rows at the end of the table), in “Global statistics” (“Operating status” bar and “Operating” column by zone, priority and subsector; each number opens the list), in PDF/PowerPoint reports (“Operating status” section), in the task list filter and in the Excel export.",
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
      "Each person's name opens their “Agent summary” for this campaign.",
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
      "“Log” also shows the app's own decisions with “App” as author: sent to visit, follow-up scheduled, SIGTUR request assigned, solved or overdue, tasks covered or handed back for absences, and sending to SIGTUR.",
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
