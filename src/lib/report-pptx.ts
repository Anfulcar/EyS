import "server-only";
import PptxGenJS from "pptxgenjs";
import { LOGO_PNG } from "./report-assets";
import type { ReportData, Row } from "./report-data";
import type { ReportSection } from "./report-options";

// 16:9 deck with the same sections as the PDF. Charts are native PowerPoint charts (editable).
const C = { blue: "0B4A92", blue50: "EEF4FB", yellow: "F5C400", orange: "F39019", red: "D81E1E", green: "2E9E44", ink: "111827", text: "334155", muted: "64748B", line: "E2E8F0", soft: "F8FAFC", track: "EEF2F7", gray: "94A3B8" };
const TONES = { good: C.green, info: C.blue, warn: C.orange, bad: C.red, none: C.gray };
const FONT = "Arial";
const TXT = {
  es: { period: "Período", campaigns: "Campañas", generated: "Generado", comments: "Comentarios", target: "Meta", orMore: "o más", inPeriod: "en el período", calls: "Llamadas", contacts: "Contactos", none: "Sin datos en este período.", goals: "Resumen ejecutivo: metas del plan", counts: "Conteos generales", campaignsT: "Comparación por campaña", agents: "Avance por agente", zones: "Por zona", priorities: "Por prioridad", subsectors: "Por subsector", sigtur: "Estatus SIGTUR", operation: "Estado de operación", channels: "Canal que logró la gestión", legend: "Leyenda", noRows: "No hay establecimientos con este filtro.", cont: "(cont.)", of: "de" },
  en: { period: "Period", campaigns: "Campaigns", generated: "Generated", comments: "Comments", target: "Target", orMore: "or more", inPeriod: "in the period", calls: "Calls", contacts: "Contacts", none: "No data in this period.", goals: "Executive summary: plan goals", counts: "General counts", campaignsT: "Comparison by campaign", agents: "Progress by agent", zones: "By zone", priorities: "By priority", subsectors: "By subsector", sigtur: "SIGTUR status", operation: "Operating status", channels: "Channel that achieved it", legend: "Legend", noRows: "No establishments match this filter.", cont: "(cont.)", of: "of" },
};

export async function renderPptx(d: ReportData, sections: ReportSection[]): Promise<Buffer> {
  const t = TXT[d.lang];
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 × 7.5 in
  pptx.title = d.title;
  pptx.company = "Ministerio de Turismo";
  const logo = `data:image/png;base64,${LOGO_PNG}`;
  pptx.defineSlideMaster({
    title: "EYS",
    background: { color: "FFFFFF" },
    objects: [
      { image: { data: logo, x: 0.45, y: 0.25, w: 1.06, h: 0.55 } },
      { text: { text: "Ministerio de Turismo", options: { x: 1.65, y: 0.25, w: 6, h: 0.3, fontFace: FONT, fontSize: 12, bold: true, color: C.blue } } },
      { text: { text: `${d.title} · ${d.periodShort}`, options: { x: 1.65, y: 0.52, w: 10.5, h: 0.28, fontFace: FONT, fontSize: 10, color: C.text } } },
      { rect: { x: 0.45, y: 0.92, w: 12.43, h: 0.04, fill: { color: C.blue } } },
      { text: { text: d.title, options: { x: 0.45, y: 7.05, w: 9, h: 0.3, fontFace: FONT, fontSize: 8, color: C.muted } } },
    ],
    slideNumber: { x: 12.2, y: 7.05, w: 0.7, h: 0.3, fontFace: FONT, fontSize: 8, color: C.muted, align: "right" },
  });
  const slide = (title: string) => {
    const s = pptx.addSlide({ masterName: "EYS" });
    s.addShape(pptx.ShapeType.rect, { x: 0.45, y: 1.18, w: 0.06, h: 0.34, fill: { color: C.yellow }, line: { color: C.yellow } });
    s.addText(title, { x: 0.6, y: 1.12, w: 12, h: 0.46, fontFace: FONT, fontSize: 20, bold: true, color: C.ink });
    return s;
  };
  const tableSlides = (title: string, head: string[], rows: Row[], colW: number[], perSlide = 12) => {
    if (!rows.length) {
      slide(title).addText(t.noRows, { x: 0.6, y: 1.9, w: 12, h: 0.4, fontFace: FONT, fontSize: 12, color: C.muted });
      return;
    }
    const total = colW.reduce((a, b) => a + b, 0);
    const widths = colW.map((w) => (w / total) * 12.43);
    for (let i = 0; i < rows.length; i += perSlide) {
      const s = slide(i ? `${title} ${t.cont}` : title);
      const headRow = head.map((h) => ({ text: h.toUpperCase(), options: { bold: true, color: C.muted, fontSize: 9, fill: { color: C.soft } } }));
      const body = rows.slice(i, i + perSlide).map((r) => r.map((v, ci) => ({ text: String(v), options: { align: (ci > 0 && typeof v === "number") || /%$/.test(String(v)) ? "right" : "left", bold: String(r[0]) === "Total" } })));
      s.addTable([headRow, ...body] as PptxGenJS.TableRow[], {
        x: 0.45, y: 1.75, w: 12.43, colW: widths, fontFace: FONT, fontSize: 11, color: C.ink,
        border: { type: "solid", pt: 0.5, color: C.line }, rowH: 0.36, valign: "middle", margin: 0.06,
      });
    }
  };
  const barSlide = (title: string, items: { label: string; n: number; color?: string }[]) => {
    const s = slide(title);
    if (!items.length) {
      s.addText(t.none, { x: 0.6, y: 1.9, w: 12, h: 0.4, fontFace: FONT, fontSize: 12, color: C.muted });
      return;
    }
    // Horizontal bars are drawn bottom-up, so the list is reversed to keep the largest on top.
    const rev = [...items].reverse();
    s.addChart(pptx.ChartType.bar, [{ name: title, labels: rev.map((i) => i.label), values: rev.map((i) => i.n) }], {
      x: 0.45, y: 1.7, w: 12.43, h: 5.2, barDir: "bar", chartColors: rev.map((i) => i.color ?? C.blue), showValue: true, dataLabelFontSize: 10, dataLabelColor: C.ink,
      catAxisLabelFontSize: 11, catAxisLabelFontFace: FONT, valAxisHidden: true, valGridLine: { style: "none" }, showLegend: false, barGapWidthPct: 45,
    });
  };

  // ---------- Title slide ----------
  const first = pptx.addSlide();
  first.background = { color: "FFFFFF" };
  first.addImage({ data: logo, x: 0.7, y: 0.6, w: 2.2, h: 1.14 });
  const stripe = [[C.blue, 0.4], [C.yellow, 0.2], [C.orange, 0.15], [C.red, 0.13], [C.green, 0.12]] as const;
  let sx = 0.7;
  for (const [c, f] of stripe) {
    first.addShape(pptx.ShapeType.rect, { x: sx, y: 2.05, w: 11.93 * f, h: 0.07, fill: { color: c }, line: { color: c } });
    sx += 11.93 * f;
  }
  first.addText(d.title, { x: 0.7, y: 2.3, w: 11.9, h: 1.1, fontFace: FONT, fontSize: 32, bold: true, color: C.blue, valign: "top" });
  first.addText(
    [
      { text: `${t.period}: `, options: { color: C.muted } }, { text: d.periodText, options: { breakLine: true } },
      { text: `${t.campaigns}: `, options: { color: C.muted } }, { text: d.campaignNames.join(" · ") || "—", options: { breakLine: true } },
      { text: `${t.generated}: `, options: { color: C.muted } }, { text: d.generatedText },
    ],
    { x: 0.7, y: 3.5, w: 11.9, h: 1.3, fontFace: FONT, fontSize: 14, color: C.text, valign: "top", paraSpaceAfter: 4 },
  );
  if (d.comments) {
    first.addText([{ text: `${t.comments}: `, options: { bold: true, color: C.blue } }, { text: d.comments, options: { color: C.ink } }], {
      x: 0.7, y: 5.0, w: 11.9, h: 1.6, fontFace: FONT, fontSize: 13, fill: { color: C.blue50 }, valign: "top", margin: 0.15,
    });
  }

  // ---------- Sections ----------
  if (sections.includes("goals")) {
    const s = slide(t.goals);
    d.goals.forEach((g, i) => {
      const x = 0.45 + (i % 2) * 6.32;
      const y = 1.8 + Math.floor(i / 2) * 2.55;
      const value = g.d ? Math.round((g.n / g.d) * 100) : 0;
      const met = g.d > 0 && value >= g.target;
      s.addShape(pptx.ShapeType.roundRect, { x, y, w: 6.1, h: 2.3, rectRadius: 0.08, fill: { color: "FFFFFF" }, line: { color: C.line, width: 1 } });
      s.addText(g.title, { x: x + 0.25, y: y + 0.15, w: 5.6, h: 0.35, fontFace: FONT, fontSize: 14, color: C.text });
      s.addText([{ text: g.d ? `${value} %` : "—", options: { fontSize: 36, bold: true, color: C.ink } }, { text: `   ${g.n} ${t.of} ${g.d}`, options: { fontSize: 12, color: C.muted } }], { x: x + 0.25, y: y + 0.55, w: 5.6, h: 0.75, fontFace: FONT });
      s.addShape(pptx.ShapeType.rect, { x: x + 0.25, y: y + 1.45, w: 5.6, h: 0.14, fill: { color: C.track }, line: { color: C.track } });
      if (value > 0) s.addShape(pptx.ShapeType.rect, { x: x + 0.25, y: y + 1.45, w: Math.max(0.06, 5.6 * Math.min(100, value) / 100), h: 0.14, fill: { color: met ? C.green : C.orange }, line: { color: met ? C.green : C.orange } });
      s.addShape(pptx.ShapeType.rect, { x: x + 0.25 + 5.6 * Math.min(100, g.target) / 100 - 0.015, y: y + 1.38, w: 0.03, h: 0.28, fill: { color: C.text }, line: { color: C.text } });
      s.addText(`${t.target}: ${g.target} %${g.target === 100 ? "" : ` ${t.orMore}`}`, { x: x + 0.25, y: y + 1.72, w: 2.8, h: 0.35, fontFace: FONT, fontSize: 11, color: C.muted });
      if (g.delta != null) s.addText(`+${g.delta} ${t.inPeriod}`, { x: x + 3.05, y: y + 1.72, w: 2.8, h: 0.35, fontFace: FONT, fontSize: 11, color: C.muted, align: "right" });
    });
  }
  if (sections.includes("counts")) {
    const s = slide(t.counts);
    d.counts.forEach(([k, v], i) => {
      const x = 0.45 + (i % 3) * 4.2;
      const y = 1.9 + Math.floor(i / 3) * 2.4;
      s.addShape(pptx.ShapeType.roundRect, { x, y, w: 4.0, h: 2.1, rectRadius: 0.08, fill: { color: C.soft }, line: { color: C.soft } });
      s.addText(k, { x: x + 0.25, y: y + 0.25, w: 3.5, h: 0.4, fontFace: FONT, fontSize: 14, color: C.text });
      s.addText(v.toLocaleString(d.lang === "es" ? "es-DO" : "en-US"), { x: x + 0.25, y: y + 0.8, w: 3.5, h: 0.9, fontFace: FONT, fontSize: 40, bold: true, color: C.ink });
    });
  }
  if (sections.includes("campaigns")) tableSlides(t.campaignsT, d.campaignTable.head, d.campaignTable.rows, [3.2, 1, 1, 1.1, 1.2, 1.1]);
  if (sections.includes("codes")) barSlide(d.codesTitle, d.codes.map((c) => ({ label: c.label, n: c.n, color: TONES[c.tone] })));
  if (sections.includes("daily")) {
    const s = slide(d.dailyTitle);
    if (!d.daily.length) s.addText(t.none, { x: 0.6, y: 1.9, w: 12, h: 0.4, fontFace: FONT, fontSize: 12, color: C.muted });
    else {
      s.addChart(pptx.ChartType.bar, [
        { name: t.calls, labels: d.daily.map((x) => x.label), values: d.daily.map((x) => x.calls) },
        { name: t.contacts, labels: d.daily.map((x) => x.label), values: d.daily.map((x) => x.contacts) },
      ], {
        x: 0.45, y: 1.7, w: 12.43, h: 5.2, barDir: "col", barGrouping: "clustered", chartColors: [C.blue, C.yellow], showLegend: true, legendPos: "b", legendFontFace: FONT,
        catAxisLabelFontSize: 10, valAxisLabelFontSize: 10, valGridLine: { color: C.track, size: 0.5 },
      });
    }
  }
  if (sections.includes("operation")) barSlide(t.operation, d.operation.map(([k, n]) => ({ label: k, n })));
  if (sections.includes("agents")) tableSlides(t.agents, d.agents.head, d.agents.rows, [2.6, 1.2, 1, 1, 1.1, 1]);
  if (sections.includes("breakdowns")) {
    tableSlides(t.zones, d.zones.head, d.zones.rows, [2.8, 1, 1, 1, 1.1, 1]);
    tableSlides(t.priorities, d.priorities.head, d.priorities.rows, [2.8, 1, 1, 1, 1.1, 1]);
    tableSlides(t.subsectors, d.subsectors.head, d.subsectors.rows, [2.8, 1, 1, 1, 1.1, 1]);
  }
  if (sections.includes("sigtur")) {
    barSlide(t.sigtur, d.sigtur.map(([k, n]) => ({ label: k, n })));
    barSlide(t.channels, d.channels.map(([k, n]) => ({ label: k, n })));
  }
  if (sections.includes("legend")) {
    for (const g of d.legend) {
      const s = slide(`${t.legend}: ${g.title}`);
      s.addTable(
        g.items.map(([k, v]) => [{ text: k, options: { bold: true, color: C.ink } }, { text: v, options: { color: C.text } }]) as PptxGenJS.TableRow[],
        { x: 0.45, y: 1.75, w: 12.43, colW: [3.6, 8.83], fontFace: FONT, fontSize: 11, border: { type: "solid", pt: 0.5, color: C.line }, valign: "middle", margin: 0.06 },
      );
    }
  }
  if (sections.includes("detail")) tableSlides(d.detail.title, d.detail.head, d.detail.rows, [3, 0.7, 0.7, 1.4, 2.6], 13);

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
