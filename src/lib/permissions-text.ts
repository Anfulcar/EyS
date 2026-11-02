import type { Lang } from "./catalog";

// Names and short explanations of each action in «Perfiles de permisos» (ids in permissions-core.mjs).
type T = Record<string, [string, string]>;

const es: T = {
  "c.call": ["Hacer llamadas", "Ve «Mis llamadas» y trabaja sus tareas asignadas."],
  "c.own": ["Ver sus llamadas realizadas", "«Revisión de llamadas» y «Resumen del agente», solo las suyas."],
  "c.review": ["Revisar las llamadas de todos", "Ve y revisa las llamadas de cualquier agente."],
  "c.view": ["Ver campañas, tableros y tareas", "Consulta las campañas, sus tableros, seguimiento y tareas."],
  "c.edit": ["Crear, editar, cerrar y eliminar campañas", "También ausencias del equipo en las campañas y borrar informes generados."],
  "c.upload": ["Cargar establecimientos y estatus", "Archivos Excel de entrada, correos rebotados y envíos de correo."],
  "c.assign": ["Asignar y mover tareas", "Entre agentes, coberturas, quién recibe las solicitudes SIGTUR. Trabaja cualquier tarea."],
  "c.transfer": ["Trasladar tareas / campaña nueva desde tareas", "Incluye campañas de correo."],
  "c.remove": ["Quitar RUT de una campaña", "Por filtros o con un archivo."],
  "c.visits": ["Registrar visitas", "Pantalla «Visitas» y su descarga."],
  "c.stats": ["Estadísticas", "Estadísticas de las campañas de llamadas."],
  "c.reports": ["Informes", "Informes en PDF o PowerPoint, plantillas e informes programados."],
  "c.excel": ["Descargas en Excel", "Listas, llamadas, interacciones y resultados con datos de contacto."],
  "c.changes": ["Reporte de cambios", "Ver los cambios y marcarlos «actualizado en SIGTUR»."],
  "c.settings": ["Configuración · Llamadas", "Valores para las campañas nuevas y guion de llamada."],
  "q.register": ["Registrar casos", "Crea casos y ve los que registró o tiene asignados."],
  "q.seeAll": ["Ver todos los casos", "Lista completa y contadores."],
  "q.workMine": ["Trabajar los casos asignados", "Pasos, derivaciones, pruebas, proponer cierre. Puede recibir casos."],
  "q.workAny": ["Trabajar cualquier caso", "Aunque no se le haya asignado."],
  "q.assign": ["Asignar casos", "Elige o cambia el responsable."],
  "q.approve": ["Aprobar o devolver cierres", "Nunca el cierre que la misma persona propuso."],
  "q.reopen": ["Reabrir casos cerrados", ""],
  "q.personal": ["Ver datos personales de quien presenta", "Nombre, documento, teléfono y correo, e informes del caso. Sin esto se ven ocultos (••••)."],
  "q.files": ["Descargar pruebas", "Fotos y documentos adjuntos."],
  "q.stats": ["Estadísticas y Excel", "Estadísticas del módulo y su descarga."],
  "q.settings": ["Configuración del módulo", "Plazos, temas, instituciones, formulario público."],
  "g.people": ["Personas", "Crear y editar personas, contraseñas y ausencias. Solo da perfiles que no superen el suyo."],
  "g.perms": ["Permisos y perfiles", "Solo el perfil Administrador."],
  "g.sigtur": ["Conexión con SIGTUR", "Claves de acceso y envío automático."],
  "g.log": ["Registro de actividad", "Ver y descargar el registro."],
};

const en: T = {
  "c.call": ["Make calls", "Sees “My calls” and works their assigned tasks."],
  "c.own": ["See their own calls", "“Call review” and “Agent summary”, their own only."],
  "c.review": ["Review everyone's calls", "Sees and reviews any agent's calls."],
  "c.view": ["See campaigns, dashboards and tasks", "Looks at campaigns, their dashboards, follow-up and tasks."],
  "c.edit": ["Create, edit, close and delete campaigns", "Also team absences in campaigns and deleting generated reports."],
  "c.upload": ["Upload establishments and status", "Input Excel files, bounced emails and email sends."],
  "c.assign": ["Assign and move tasks", "Between agents, covers, who receives SIGTUR requests. Works any task."],
  "c.transfer": ["Transfer tasks / new campaign from tasks", "Includes email campaigns."],
  "c.remove": ["Remove RUTs from a campaign", "By filters or with a file."],
  "c.visits": ["Log visits", "“Visits” screen and its download."],
  "c.stats": ["Statistics", "Call campaign statistics."],
  "c.reports": ["Reports", "PDF or PowerPoint reports, templates and scheduled reports."],
  "c.excel": ["Excel downloads", "Lists, calls, interactions and results with contact data."],
  "c.changes": ["Changes report", "See the changes and mark them “updated in SIGTUR”."],
  "c.settings": ["Settings · Calls", "Values for new campaigns and call script."],
  "q.register": ["Register cases", "Creates cases and sees the ones they registered or are assigned."],
  "q.seeAll": ["See all cases", "Full list and counters."],
  "q.workMine": ["Work assigned cases", "Steps, referrals, proof, propose closing. Can receive cases."],
  "q.workAny": ["Work any case", "Even if not assigned to them."],
  "q.assign": ["Assign cases", "Chooses or changes the handler."],
  "q.approve": ["Approve or return closings", "Never a closing the same person proposed."],
  "q.reopen": ["Reopen closed cases", ""],
  "q.personal": ["See the presenter's personal data", "Name, ID, phone and email, and case reports. Without it they show hidden (••••)."],
  "q.files": ["Download proof", "Attached photos and documents."],
  "q.stats": ["Statistics and Excel", "Module statistics and their download."],
  "q.settings": ["Module settings", "Deadlines, topics, institutions, public form."],
  "g.people": ["People", "Create and edit people, passwords and absences. Only gives profiles that don't exceed their own."],
  "g.perms": ["Permissions and profiles", "Administrador profile only."],
  "g.sigtur": ["SIGTUR connection", "Access keys and automatic sending."],
  "g.log": ["Activity log", "See and download the log."],
};

export const ACTION_TEXT: Record<Lang, T> = { es, en };

export type MenuLabels = Record<"calls" | "reviews" | "campaigns" | "visits" | "stats" | "reports" | "callsSettings" | "cases" | "publicForm" | "qrStats" | "qrSettings" | "admin" | "help", string>;

// The menu a set of actions shows (same rules as the real menu in src/app/layout.tsx), grouped by module.
export function menuFor(a: readonly string[], l: MenuLabels, groups: { calls: string; qr: string; general: string }): [string, string[]][] {
  const h = (x: string) => a.includes(x);
  const out: [string, (string | false)[]][] = [
    [groups.calls, [h("c.call") && l.calls, (h("c.own") || h("c.review")) && l.reviews, h("c.view") && l.campaigns, h("c.visits") && l.visits, h("c.stats") && l.stats, (h("c.reports") || h("c.changes")) && l.reports, h("c.settings") && l.callsSettings]],
    [groups.qr, [h("q.register") && l.cases, h("q.register") && l.publicForm, h("q.stats") && l.qrStats, h("q.settings") && l.qrSettings]],
    [groups.general, [(h("g.people") || h("g.perms") || h("g.sigtur") || h("g.log")) && l.admin, l.help]],
  ];
  return out.map(([g, items]) => [g, items.filter((x): x is string => !!x)] as [string, string[]]).filter(([, i]) => i.length > 0);
}
