import "server-only";
import PDFDocument from "pdfkit";
import { INTER_400, INTER_600, INTER_700, LOGO_PNG } from "./report-assets";
import type { ReportData, Row } from "./report-data";
import type { ReportSection } from "./report-options";

// A4 portrait, Ministerio de Turismo colours. Sections flow one after the other and only move to a
// new page when they don't fit.
const C = { blue: "#0b4a92", blue50: "#eef4fb", yellow: "#f5c400", orange: "#f39019", red: "#d81e1e", green: "#2e9e44", ink: "#111827", text: "#334155", muted: "#64748b", line: "#e2e8f0", soft: "#f8fafc", track: "#eef2f7", gray: "#94a3b8" };
const TONES = { good: C.green, info: C.blue, warn: C.orange, bad: C.red, none: C.gray };
const W = 595.28;
const H = 841.89;
const M = 42; // side margin
const TOP = 96; // content starts below the page header
const BOTTOM = H - 46; // content ends above the footer

const TXT = {
  es: { period: "Período", agent: "Agente", campaigns: "Campañas", generated: "Generado", comments: "Comentarios:", target: "Meta", orMore: "o más", inPeriod: "en el período", page: "Página", of: "de", calls: "Llamadas", contacts: "Contactos", none: "Sin datos en este período.", goals: "Resumen ejecutivo: metas del plan", counts: "Conteos generales", campaignsT: "Comparación por campaña", agents: "Avance por agente", zones: "Por zona", priorities: "Por prioridad", subsectors: "Por subsector", sigtur: "Estatus SIGTUR", operation: "Estado de operación", channels: "Canal que logró la gestión", legend: "Leyenda", noRows: "No hay establecimientos con este filtro." },
  en: { period: "Period", agent: "Agent", campaigns: "Campaigns", generated: "Generated", comments: "Comments:", target: "Target", orMore: "or more", inPeriod: "in the period", page: "Page", of: "of", calls: "Calls", contacts: "Contacts", none: "No data in this period.", goals: "Executive summary: plan goals", counts: "General counts", campaignsT: "Comparison by campaign", agents: "Progress by agent", zones: "By zone", priorities: "By priority", subsectors: "By subsector", sigtur: "SIGTUR status", operation: "Operating status", channels: "Channel that achieved it", legend: "Legend", noRows: "No establishments match this filter." },
};

export async function renderPdf(d: ReportData, sections: ReportSection[]): Promise<Buffer> {
  const t = TXT[d.lang];
  const doc = new PDFDocument({ size: "A4", margins: { top: TOP, bottom: 20, left: M, right: M }, bufferPages: true, info: { Title: d.title, Author: "Ministerio de Turismo – EyS Campañas" } });
  doc.registerFont("R", Buffer.from(INTER_400, "base64"));
  doc.registerFont("S", Buffer.from(INTER_600, "base64"));
  doc.registerFont("B", Buffer.from(INTER_700, "base64"));
  const logo = Buffer.from(LOGO_PNG, "base64");
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));
  const inner = W - 2 * M;
  let y = TOP;

  const header = (first: boolean) => {
    doc.image(logo, M, 30, { height: 40 });
    doc.font("S").fontSize(11).fillColor(C.blue).text("Ministerio de Turismo", M + 88, 36, { lineBreak: false });
    doc.font("R").fontSize(9.5).fillColor(C.text).text(first ? "Plan de Formalización Región Este" : `${d.title} · ${d.periodShort}`, M + 88, 52, { width: inner - 88, lineBreak: false, ellipsis: true });
    doc.rect(M, 78, inner, 2.4).fill(C.blue);
    y = TOP;
  };
  const newPage = () => {
    doc.addPage();
    header(false);
  };
  const ensure = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };
  const sectionTitle = (s: string, keepWith = 60) => {
    ensure(26 + keepWith);
    y += 6;
    doc.rect(M, y, 3, 15).fill(C.yellow);
    doc.font("S").fontSize(12).fillColor(C.ink).text(s, M + 10, y + 1, { lineBreak: false });
    y += 26;
  };
  const textH = (s: string, font: string, size: number, width: number) => doc.font(font).fontSize(size).heightOfString(s, { width });

  // Table with repeated header when it continues on a new page.
  const table = (head: string[], rows: Row[], widths: number[], numericFrom = 1) => {
    const total = widths.reduce((a, b) => a + b, 0);
    const ws = widths.map((w) => (w / total) * inner);
    const drawHead = () => {
      let x = M;
      const hh = Math.max(...head.map((h, i) => textH(h.toUpperCase(), "S", 7.5, ws[i] - 10)));
      doc.font("S").fontSize(7.5).fillColor(C.muted);
      head.forEach((h, i) => {
        doc.text(h.toUpperCase(), x + 5, y, { width: ws[i] - 10, align: i >= numericFrom ? "right" : "left" });
        x += ws[i];
      });
      y += hh + 4;
      doc.moveTo(M, y).lineTo(M + inner, y).lineWidth(0.6).strokeColor(C.line).stroke();
      y += 5;
    };
    ensure(40);
    drawHead();
    rows.forEach((r, ri) => {
      const isTotal = ri === rows.length - 1 && String(r[0]).match(/^(Total)$/);
      const font = isTotal ? "S" : "R";
      const h = Math.max(...r.map((v, i) => textH(String(v), font, 9, ws[i] - 10))) + 8;
      if (y + h > BOTTOM) {
        newPage();
        drawHead();
      }
      let x = M;
      doc.font(font).fontSize(9).fillColor(C.ink);
      r.forEach((v, i) => {
        doc.text(String(v), x + 5, y, { width: ws[i] - 10, align: i >= numericFrom && typeof v !== "string" ? "right" : i >= numericFrom ? "right" : "left" });
        x += ws[i];
      });
      y += h;
      doc.moveTo(M, y - 3).lineTo(M + inner, y - 3).lineWidth(0.4).strokeColor("#f1f5f9").stroke();
    });
  };

  const bars = (items: { label: string; n: number; color: string }[]) => {
    const max = Math.max(1, ...items.map((i) => i.n));
    const lw = inner * 0.38;
    for (const it of items) {
      const h = Math.max(14, textH(it.label, "R", 9, lw - 6) + 5);
      ensure(h);
      doc.font("R").fontSize(9).fillColor(C.ink).text(it.label, M, y, { width: lw - 6 });
      const bx = M + lw;
      const bw = inner - lw - 40;
      const by = y + h / 2 - 6;
      doc.roundedRect(bx, by, bw, 7, 3.5).fill(C.track);
      if (it.n > 0) doc.roundedRect(bx, by, Math.max(4, (it.n / max) * bw), 7, 3.5).fill(it.color);
      doc.font("S").fontSize(9).fillColor(C.ink).text(String(it.n), M + inner - 36, y, { width: 36, align: "right" });
      y += h;
    }
  };

  // ---------- Page 1: title block ----------
  header(true);
  const stripe = [[C.blue, 0.4], [C.yellow, 0.2], [C.orange, 0.15], [C.red, 0.13], [C.green, 0.12]] as const;
  let sx = M;
  for (const [c, f] of stripe) {
    doc.rect(sx, y - 6, inner * f, 3.5).fill(c);
    sx += inner * f;
  }
  y += 10;
  doc.font("B").fontSize(20).fillColor(C.blue).text(d.title, M, y, { width: inner });
  y = doc.y + 10;
  const meta: [string, string][] = [...(d.agentText ? [[t.agent, d.agentText] as [string, string]] : []), [t.period, d.periodText], [t.campaigns, d.campaignNames.join(" · ") || "—"], [t.generated, d.generatedText]];
  for (const [k, v] of meta) {
    doc.font("R").fontSize(9.5).fillColor(C.muted).text(k, M, y, { width: 70 });
    doc.font("R").fontSize(9.5).fillColor(C.text).text(v, M + 74, y, { width: inner - 74 });
    y = Math.max(doc.y, y + 12) + 4;
  }
  if (d.comments) {
    const ch = textH(`${t.comments} ${d.comments}`, "R", 9.5, inner - 22) + 16;
    y += 6;
    doc.roundedRect(M, y, inner, ch, 6).fill(C.blue50);
    doc.font("S").fontSize(9.5).fillColor(C.blue).text(t.comments + " ", M + 11, y + 8, { continued: true, width: inner - 22 });
    doc.font("R").fillColor(C.ink).text(d.comments);
    y += ch + 4;
  }

  // ---------- Sections ----------
  if (sections.includes("goals")) {
    sectionTitle(t.goals, 150);
    const cw = (inner - 10) / 2;
    d.goals.forEach((g, i) => {
      const x = M + (i % 2) * (cw + 10);
      const gy = y + Math.floor(i / 2) * 82;
      const value = g.d ? Math.round((g.n / g.d) * 100) : 0;
      const met = g.d > 0 && value >= g.target;
      doc.roundedRect(x, gy, cw, 72, 6).lineWidth(0.7).strokeColor(C.line).stroke();
      doc.font("R").fontSize(9.5).fillColor(C.text).text(g.title, x + 10, gy + 8, { width: cw - 20, lineBreak: false, ellipsis: true });
      const big = g.d ? `${value} %` : "—";
      doc.font("B").fontSize(19).fillColor(C.ink).text(big, x + 10, gy + 22, { lineBreak: false });
      const bigW = doc.font("B").fontSize(19).widthOfString(big);
      doc.font("R").fontSize(8.5).fillColor(C.muted).text(`${g.n} ${t.of} ${g.d}`, x + 16 + bigW, gy + 31, { lineBreak: false });
      const bx = x + 10;
      const bw = cw - 20;
      doc.roundedRect(bx, gy + 47, bw, 6, 3).fill(C.track);
      if (value > 0) doc.roundedRect(bx, gy + 47, Math.max(4, (Math.min(100, value) / 100) * bw), 6, 3).fill(met ? C.green : C.orange);
      doc.rect(bx + (Math.min(100, g.target) / 100) * bw - 1, gy + 44, 1.6, 12).fill(C.text);
      doc.font("R").fontSize(8).fillColor(C.muted).text(`${t.target}: ${g.target} %${g.target === 100 ? "" : ` ${t.orMore}`}`, bx, gy + 58, { width: bw / 2, lineBreak: false });
      if (g.delta != null) doc.text(`+${g.delta} ${t.inPeriod}`, bx + bw / 2, gy + 58, { width: bw / 2, align: "right", lineBreak: false });
    });
    y += 164;
  }
  if (sections.includes("counts")) {
    sectionTitle(t.counts, 90);
    const cw = (inner - 16) / 3;
    d.counts.forEach(([k, v], i) => {
      const x = M + (i % 3) * (cw + 8);
      const cy = y + Math.floor(i / 3) * 50;
      doc.roundedRect(x, cy, cw, 42, 5).fill(C.soft);
      doc.font("R").fontSize(8.5).fillColor(C.text).text(k, x + 9, cy + 7, { width: cw - 18, lineBreak: false, ellipsis: true });
      doc.font("B").fontSize(15).fillColor(C.ink).text(v.toLocaleString(d.lang === "es" ? "es-DO" : "en-US"), x + 9, cy + 19, { lineBreak: false });
    });
    y += Math.ceil(d.counts.length / 3) * 50 + 4;
  }
  if (sections.includes("campaigns")) {
    sectionTitle(t.campaignsT);
    table(d.campaignTable.head, d.campaignTable.rows, [3.2, 1, 1, 1.1, 1.2, 1.1]);
  }
  if (sections.includes("codes")) {
    sectionTitle(d.codesTitle);
    if (!d.codes.length) {
      doc.font("R").fontSize(9).fillColor(C.muted).text(t.none, M, y);
      y += 16;
    } else bars(d.codes.map((c) => ({ label: c.label, n: c.n, color: TONES[c.tone] })));
  }
  if (sections.includes("daily")) {
    sectionTitle(d.dailyTitle, 170);
    if (!d.daily.length) {
      doc.font("R").fontSize(9).fillColor(C.muted).text(t.none, M, y);
      y += 16;
    } else {
      const ch = 140;
      const max = Math.max(1, ...d.daily.map((x) => x.calls));
      // A round step (1, 2, 5, 10, 20…) so the 4 grid lines carry whole numbers.
      const raw = max / 4;
      const mag = Math.pow(10, Math.floor(Math.log10(raw)));
      const step = Math.max(1, [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag);
      const top = step * 4;
      const gx = M + 28;
      const gw = inner - 30;
      for (let i = 0; i <= 4; i++) {
        const v = (top / 4) * i;
        const ly = y + ch - (v / top) * ch;
        doc.moveTo(gx, ly).lineTo(gx + gw, ly).lineWidth(0.5).strokeColor(i === 0 ? "#cbd5e1" : C.track).stroke();
        doc.font("R").fontSize(7.5).fillColor(C.muted).text(String(Math.round(v)), M, ly - 4, { width: 24, align: "right" });
      }
      const slot = gw / d.daily.length;
      const bw = Math.min(18, slot * 0.32);
      d.daily.forEach((x, i) => {
        const bx = gx + i * slot + slot / 2 - bw;
        const hc = (x.calls / top) * ch;
        const hk = (x.contacts / top) * ch;
        if (hc > 0) doc.rect(bx, y + ch - hc, bw, hc).fill(C.blue);
        if (hk > 0) doc.rect(bx + bw + 1, y + ch - hk, bw, hk).fill(C.yellow);
        if (d.daily.length <= 16 || i % Math.ceil(d.daily.length / 16) === 0) {
          doc.font("R").fontSize(7).fillColor(C.text).text(x.label, gx + i * slot - 10, y + ch + 4, { width: slot + 20, align: "center", lineBreak: false });
        }
      });
      y += ch + 18;
      doc.rect(M, y + 2, 7, 7).fill(C.blue);
      doc.font("R").fontSize(8).fillColor(C.text).text(t.calls, M + 10, y + 1, { lineBreak: false });
      doc.rect(M + 70, y + 2, 7, 7).fill(C.yellow);
      doc.font("R").fontSize(8).fillColor(C.text).text(t.contacts, M + 80, y + 1, { lineBreak: false });
      y += 18;
    }
  }
  if (sections.includes("operation")) {
    sectionTitle(t.operation);
    const tone = [C.green, C.red, C.yellow, C.gray];
    bars(d.operation.map(([k, n], i) => ({ label: k, n, color: tone[i] ?? C.blue })));
  }
  if (sections.includes("agents")) {
    sectionTitle(t.agents);
    table(d.agents.head, d.agents.rows, [2.6, 1.2, 1, 1, 1.1, 1]);
  }
  if (sections.includes("breakdowns")) {
    for (const [title, tb] of [[t.zones, d.zones], [t.priorities, d.priorities], [t.subsectors, d.subsectors]] as const) {
      sectionTitle(title);
      table(tb.head, tb.rows, [2.8, 1, 1, 1, 1.1, 1]);
    }
  }
  if (sections.includes("sigtur")) {
    for (const [title, items] of [[t.sigtur, d.sigtur], [t.channels, d.channels]] as const) {
      sectionTitle(title);
      if (!items.length) {
        doc.font("R").fontSize(9).fillColor(C.muted).text(t.none, M, y);
        y += 16;
      } else bars(items.map(([k, n]) => ({ label: k, n, color: C.blue })));
    }
  }
  if (sections.includes("legend")) {
    sectionTitle(t.legend);
    for (const g of d.legend) {
      ensure(40);
      doc.font("S").fontSize(10).fillColor(C.blue).text(g.title, M, y);
      y = doc.y + 3;
      for (const [k, v] of g.items) {
        const h = textH(v, "R", 8.5, inner - 150) + 4;
        ensure(h);
        doc.font("S").fontSize(8.5).fillColor(C.ink).text(k, M, y, { width: 140 });
        doc.font("R").fontSize(8.5).fillColor(C.text).text(v, M + 150, y, { width: inner - 150 });
        y += Math.max(h, textH(k, "S", 8.5, 140) + 4);
      }
      y += 6;
    }
  }
  if (sections.includes("detail")) {
    sectionTitle(d.detail.title);
    if (!d.detail.rows.length) {
      doc.font("R").fontSize(9).fillColor(C.muted).text(t.noRows, M, y);
      y += 16;
    } else table(d.detail.head, d.detail.rows, [3, 0.7, 0.7, 1.4, 2.6], 9);
  }

  // Footer with page numbers on every page.
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0; // the footer sits below the content area
    doc.moveTo(M, H - 34).lineTo(M + inner, H - 34).lineWidth(0.5).strokeColor(C.line).stroke();
    doc.font("R").fontSize(7.5).fillColor(C.muted);
    doc.text(d.title, M, H - 28, { width: inner * 0.7, lineBreak: false, ellipsis: true });
    doc.text(`${t.page} ${i + 1} ${t.of} ${range.count}`, M + inner * 0.7, H - 28, { width: inner * 0.3, align: "right", lineBreak: false });
  }
  doc.end();
  return done;
}
