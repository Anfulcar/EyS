import ExcelJS from "exceljs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { logActivity } from "@/lib/audit";
import { notFoundResponse, routeUser } from "@/lib/auth";
import { listProfiles } from "@/lib/permissions";
import { ACTIONS, ACTION_IDS, ADMIN_KEY, parseActions } from "@/lib/permissions-core.mjs";
import { ACTION_TEXT } from "@/lib/permissions-text";
import { styleHeader, workbookResponse } from "@/lib/sheets";

const MODULE = { c: "Campañas de llamadas", q: "Quejas y reclamaciones", g: "General" } as const;

// «Comparar perfiles» → Excel: actions × profiles, and who has each profile (Administrador profile only).
export async function GET() {
  const me = await routeUser("g.perms");
  if (!me) return notFoundResponse();
  const [profiles, people] = await Promise.all([listProfiles(), db.select().from(users)]);
  const acts = profiles.map((p) => (p.key === ADMIN_KEY ? ACTION_IDS : parseActions(p.actions)));
  const wb = new ExcelJS.Workbook();
  const cmp = wb.addWorksheet("Perfiles");
  cmp.columns = [{ header: "Módulo", key: "m", width: 24 }, { header: "Acción", key: "a", width: 44 }, ...profiles.map((p) => ({ header: p.name, key: `p${p.id}`, width: 18 }))];
  styleHeader(cmp);
  for (const a of ACTIONS) cmp.addRow([MODULE[a.mod], ACTION_TEXT.es[a.id][0], ...acts.map((list) => (list.includes(a.id) ? "Sí" : ""))]);
  const who = wb.addWorksheet("Personas");
  who.columns = ["Persona", "Usuario", "Perfil", "Estado"].map((h) => ({ header: h, key: h, width: 26 }));
  styleHeader(who);
  const name = new Map(profiles.map((p) => [p.id, p.name]));
  for (const u of people) who.addRow([u.name, u.username, u.profileId ? name.get(u.profileId) ?? "" : "", u.active ? "Activo" : "Inactivo"]);
  await logActivity(me, "export.downloaded", { entity: "profile", summary: "Perfiles de permisos (Excel)" });
  return workbookResponse(wb, "perfiles_de_permisos.xlsx");
}
