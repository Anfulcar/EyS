import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import PDFDocument from "pdfkit";
import { db } from "@/db";
import { qrCases, qrReports, users, type QrCase } from "@/db/schema";
import { fmtDate, fmtDateTime } from "./dates";
import { caseDetail, channelText, STATUS_TEXT } from "./qr";
import { INTER_400, INTER_600, INTER_700, LOGO_PNG } from "./report-assets";

// The case report (PDF): generated automatically when a closing is approved and on request; every version is kept.
// Internal notes never appear in it.

const C = { blue: "#0b4a92", yellow: "#f5c400", ink: "#111827", text: "#334155", muted: "#64748b", line: "#e2e8f0" };
const W = 595.28, H = 841.89, M = 48, TOP = 100, BOTTOM = H - 50;

export async function renderCasePdf(c: QrCase, version: number, origin: string): Promise<Buffer> {
  const d = await caseDetail(c.id);
  const ids = [c.assignedUserId, c.closedBy, c.closeProposedBy].filter((x): x is number => !!x);
  const people = ids.length ? await db.select({ id: users.id, name: users.name }).from(users).where(sql`${users.id} in (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`) : [];
  const nameOf = (id: number | null) => people.find((p) => p.id === id)?.name ?? "—";

  const doc = new PDFDocument({ size: "A4", margins: { top: TOP, bottom: 20, left: M, right: M }, bufferPages: true, info: { Title: `Informe del caso ${c.number}`, Author: "Ministerio de Turismo – Quejas y reclamaciones" } });
  doc.registerFont("R", Buffer.from(INTER_400, "base64"));
  doc.registerFont("S", Buffer.from(INTER_600, "base64"));
  doc.registerFont("B", Buffer.from(INTER_700, "base64"));
  const logo = Buffer.from(LOGO_PNG, "base64");
  const chunks: Buffer[] = [];
  doc.on("data", (b: Buffer) => chunks.push(b));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));
  const inner = W - 2 * M;
  let y = TOP;

  const header = () => {
    doc.image(logo, M, 30, { height: 40 });
    doc.font("S").fontSize(11).fillColor(C.blue).text("Ministerio de Turismo · Quejas y reclamaciones", M + 88, 36, { lineBreak: false });
    doc.font("R").fontSize(9.5).fillColor(C.text).text(`Informe del caso ${c.number} · versión ${version}`, M + 88, 52, { lineBreak: false });
    doc.rect(M, 80, inner, 2.4).fill(C.blue);
    y = TOP;
  };
  const ensure = (h: number) => {
    if (y + h > BOTTOM) {
      doc.addPage();
      header();
    }
  };
  const title = (s: string) => {
    ensure(50);
    y += 8;
    doc.rect(M, y, 3, 15).fill(C.yellow);
    doc.font("S").fontSize(12).fillColor(C.ink).text(s, M + 10, y + 1, { lineBreak: false });
    y += 24;
  };
  const para = (s: string, font = "R", size = 10, color = C.text) => {
    const h = doc.font(font).fontSize(size).heightOfString(s, { width: inner });
    ensure(h + 4);
    doc.font(font).fontSize(size).fillColor(color).text(s, M, y, { width: inner });
    y += h + 6;
  };
  const kv = (rows: [string, string | null | undefined][]) => {
    for (const [k, v] of rows) {
      if (!v) continue;
      const h = Math.max(doc.font("R").fontSize(10).heightOfString(v, { width: inner - 140 }), 12);
      ensure(h + 4);
      doc.font("S").fontSize(9.5).fillColor(C.muted).text(k, M, y, { width: 132 });
      doc.font("R").fontSize(10).fillColor(C.ink).text(v, M + 140, y, { width: inner - 140 });
      y += h + 5;
    }
  };

  header();
  doc.font("B").fontSize(18).fillColor(C.blue).text(`Caso ${c.number}`, M, y);
  y += 26;
  para(c.subject, "S", 12, C.ink);
  kv([
    ["Estado", STATUS_TEXT[c.status] ?? c.status],
    ["Tipo y tema", [c.type, c.topic].filter(Boolean).join(" · ")],
    ["Canal", channelText(c.channel)],
    ["Recibido", fmtDateTime(c.createdAt)],
    ["Plazo de respuesta", fmtDate(c.due)],
    ["Responsable", c.assignedUserId ? nameOf(c.assignedUserId) : "Sin asignar"],
    ["Cerrado", c.closedAt ? `${fmtDateTime(c.closedAt)} · propuso ${nameOf(c.closeProposedBy)}, aprobó ${nameOf(c.closedBy)}` : null],
  ]);

  title("Involucrado");
  kv([
    ["RUT / ID SIGTUR", c.partySigtur ? [c.partyRut, c.partySigturId].filter(Boolean).join(" · ") : "Sin RUT"],
    ["Nombre", c.partyName],
    ["Razón social", c.partyRazon],
    ["RNC / cédula", c.partyRnc],
    ["Estatus RNT", c.partyRntStatus],
    ["Lugar", [c.partyAddress, c.partyMunicipality, c.partyProvince].filter(Boolean).join(", ")],
  ]);

  title("Quién lo presenta");
  if (c.complainantAnonymous) para("Anónimo.");
  else kv([["Nombre", c.complainantName], ["Documento", c.complainantDoc], ["Nacionalidad", c.complainantNationality], ["Contacto", [c.complainantPhone, c.complainantEmail].filter(Boolean).join(" · ")]]);

  title("Incidencia");
  para(c.description);

  title("Pasos dados");
  const steps = d.steps.filter((s) => s.kind !== "internal").reverse();
  for (const s of steps) para(`${fmtDate(s.at)} · ${s.text} (${s.byName ?? "Sistema"})`, "R", 9.5);

  if (d.refs.length) {
    title("Referencias");
    for (const r of d.refs) para(`${r.institution} · enviado ${fmtDate(r.sentOn)}${r.dueOn ? ` · respuesta esperada ${fmtDate(r.dueOn)}` : ""}${r.note ? ` · ${r.note}` : ""}${r.response ? `\nRespuesta: ${r.response}` : "\nSin respuesta todavía."}`, "R", 9.5);
  }

  title("Pruebas");
  para(d.files.length ? d.files.map((f) => `${f.name}${f.replacedAt ? " (reemplazada)" : ""}`).join(" · ") : "Ninguna.", "R", 9.5);

  title("Solución");
  para(c.solution || "Pendiente.");

  ensure(30);
  y += 10;
  para(`Versión ${version} · ${origin} · ${fmtDateTime(new Date().toISOString())}. Las notas internas no aparecen en este informe.`, "R", 8, C.muted);

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.font("R").fontSize(8).fillColor(C.muted).text(`Página ${i + 1} de ${range.count}`, M, H - 34, { width: inner, align: "right", lineBreak: false });
  }
  doc.end();
  return done;
}

// Makes and keeps a new version of the case report.
export async function generateCaseReport(caseId: number, origin: "auto" | "request", byName: string) {
  const [c] = await db.select().from(qrCases).where(eq(qrCases.id, caseId));
  if (!c) return null;
  const [last] = await db.select({ v: qrReports.version }).from(qrReports).where(eq(qrReports.caseId, caseId)).orderBy(desc(qrReports.version)).limit(1);
  const version = (last?.v ?? 0) + 1;
  const pdf = await renderCasePdf(c, version, origin === "auto" ? "Automático al cerrar" : `A pedido de ${byName}`);
  const [row] = await db.insert(qrReports).values({ caseId, version, origin, byName, pdf }).returning({ id: qrReports.id });
  return { id: row.id, version };
}
