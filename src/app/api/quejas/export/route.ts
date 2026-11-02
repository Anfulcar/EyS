import ExcelJS from "exceljs";
import { and, desc, gte, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { qrCases, users } from "@/db/schema";
import { logActivity } from "@/lib/audit";
import { notFoundResponse } from "@/lib/auth";
import { localDateOf } from "@/lib/dates";
import { many } from "@/lib/multi";
import { channelText, qrStats, QR_TYPES, STATUS_TEXT } from "@/lib/qr";
import { routeQr } from "@/lib/qr-auth";
import { styleHeader, workbookResponse } from "@/lib/sheets";

// «Estadísticas» → «Excel»: the figures by type and the list of cases of the period (handlers and supervisors).
export async function GET(req: Request) {
  const u = await routeQr("manage");
  if (!u) return notFoundResponse();
  const sp = new URL(req.url).searchParams;
  const days = [30, 90, 180, 365].includes(Number(sp.get("days"))) ? Number(sp.get("days")) : 90;
  const types = many(sp.getAll("type")).filter((x) => (QR_TYPES as readonly string[]).includes(x));
  const s = await qrStats({ days, types });
  const w: SQL[] = [gte(qrCases.createdAt, new Date(Date.now() - days * 86400000).toISOString())];
  if (types.length) w.push(inArray(qrCases.type, types));
  const rows = await db.select().from(qrCases).where(and(...w)).orderBy(desc(qrCases.id));
  const people = new Map((await db.select({ id: users.id, name: users.name }).from(users)).map((p) => [p.id, p.name]));
  await logActivity(u, "export.downloaded", { entity: "qr_case", summary: `Estadísticas de quejas (${rows.length} casos, ${days} días)` });

  const wb = new ExcelJS.Workbook();
  const sum = wb.addWorksheet("Por tipo");
  sum.columns = ["Tipo", "Recibidos", "Abiertos", "Cerrados", "Días hábiles (promedio)", "Plazo (días)", "En plazo (%)"].map((h) => ({ header: h, key: h, width: 20 }));
  styleHeader(sum);
  for (const r of s.byType) sum.addRow([r.type, r.received, r.open, r.closed, r.avgDays, r.sla, r.onTimePct]);
  const list = wb.addWorksheet("Casos");
  list.columns = ["Caso", "Recibido", "Tipo", "Tema", "Canal", "Prioridad", "Estado", "Plazo de respuesta", "Cerrado", "Responsable", "RUT", "Involucrado", "Asunto"].map((h) => ({ header: h, key: h, width: h === "Asunto" || h === "Involucrado" ? 36 : 16 }));
  styleHeader(list);
  for (const c of rows) {
    list.addRow([c.number, localDateOf(c.createdAt), c.type, c.topic, channelText(c.channel), c.priority, STATUS_TEXT[c.status], c.due, c.closedAt ? localDateOf(c.closedAt) : null, c.assignedUserId ? people.get(c.assignedUserId) : null, c.partyRut, c.partyName, c.subject]);
  }
  return workbookResponse(wb, `quejas_estadisticas_${days}d.xlsx`);
}
