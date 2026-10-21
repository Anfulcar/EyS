"use client";

import { Download, FileText, Presentation, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ActionState } from "@/app/actions";
import type { Lang } from "@/lib/catalog";
import type { Dict } from "@/lib/i18n";
import {
  cleanOptions, DEFAULT_OPTIONS, DETAIL_FILTERS, DETAIL_LABELS, FREQUENCIES, FREQUENCY_LABELS, optionsToQuery, PERIOD_KINDS, PERIOD_LABELS,
  REPORT_SECTIONS, SECTION_LABELS, WEEKDAY_LABELS, type Frequency, type ReportOptions, type ReportSection,
} from "@/lib/report-options";
import { ActionForm, SubmitButton } from "./ActionForm";

type Campaign = { id: number; name: string; status: string };
type Template = { id: number; name: string; options: ReportOptions; frequency: Frequency; runDay: number | null };

const STORE = "eys.report.v1";

export function ReportBuilder({ campaigns, templates, t, lang, saveAction }: {
  campaigns: Campaign[];
  templates: Template[];
  t: Dict;
  lang: Lang;
  saveAction: (s: ActionState, f: FormData) => Promise<ActionState>;
}) {
  const [o, setO] = useState<ReportOptions>(DEFAULT_OPTIONS);
  const [templateId, setTemplateId] = useState(0);
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("none");
  const [runDay, setRunDay] = useState(1);
  const loaded = useRef(false);

  // Comes back with the last choice made in this browser.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE);
      if (raw) setO(cleanOptions(JSON.parse(raw)));
    } catch {}
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(STORE, JSON.stringify(o));
    } catch {}
  }, [o]);

  const set = (p: Partial<ReportOptions>) => setO((x) => ({ ...x, ...p }));
  const pickTemplate = (id: number) => {
    setTemplateId(id);
    const tpl = templates.find((x) => x.id === id);
    if (tpl) {
      setO(cleanOptions(tpl.options));
      setName(tpl.name);
      setFrequency(tpl.frequency);
      setRunDay(tpl.runDay ?? 1);
    } else {
      setName("");
      setFrequency("none");
    }
  };
  const toggleSection = (s: ReportSection, on: boolean) => set({ sections: REPORT_SECTIONS.filter((x) => (x === s ? on : o.sections.includes(x))) });
  const toggleCampaign = (id: number, on: boolean) => set({ campaignIds: on ? [...new Set([...o.campaignIds, id])] : o.campaignIds.filter((x) => x !== id) });
  const noCampaign = o.campaigns === "pick" && o.campaignIds.length === 0;
  const href = `/api/report?${optionsToQuery(o)}`;
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm transition ${on ? "border-brand-600 bg-brand-50 font-semibold text-brand-700" : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"}`;

  return (
    <div className="space-y-5">
      {templates.length > 0 && (
        <div>
          <label className="label" htmlFor="rb-template">{t.reportTemplate}</label>
          <select id="rb-template" className="input" value={templateId} onChange={(e) => pickTemplate(Number(e.target.value))}>
            <option value={0}>{t.reportNoTemplate}</option>
            {templates.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3">
          <legend className="px-1 text-sm font-semibold text-slate-800">{t.reportCampaigns}</legend>
          <div className="flex flex-wrap gap-2">
            {(["all", "active", "pick"] as const).map((k) => (
              <button key={k} type="button" className={chip(o.campaigns === k)} onClick={() => set({ campaigns: k })} aria-pressed={o.campaigns === k}>
                {k === "all" ? t.all : k === "active" ? t.reportActiveOnly : t.reportPick}
              </button>
            ))}
          </div>
          {o.campaigns === "pick" && (
            <div className="max-h-40 space-y-1 overflow-y-auto pt-1">
              {campaigns.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={o.campaignIds.includes(c.id)} onChange={(e) => toggleCampaign(c.id, e.target.checked)} className="h-4 w-4 accent-brand-600" />
                  <span className={c.status === "closed" ? "text-slate-400" : ""}>{c.name}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
        <fieldset className="space-y-2 rounded-xl border border-slate-200 p-3">
          <legend className="px-1 text-sm font-semibold text-slate-800">{t.reportPeriod}</legend>
          <div className="flex flex-wrap gap-2">
            {PERIOD_KINDS.map((k) => (
              <button key={k} type="button" className={chip(o.period === k)} onClick={() => set({ period: k })} aria-pressed={o.period === k}>{PERIOD_LABELS[k][lang]}</button>
            ))}
          </div>
          {o.period === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label" htmlFor="rb-from">{t.from}</label><input id="rb-from" type="date" className="input" value={o.from ?? ""} onChange={(e) => set({ from: e.target.value || undefined })} /></div>
              <div><label className="label" htmlFor="rb-to">{t.to}</label><input id="rb-to" type="date" className="input" value={o.to ?? ""} onChange={(e) => set({ to: e.target.value || undefined })} /></div>
            </div>
          )}
          <p className="text-xs text-slate-500">{t.reportPeriodHelp}</p>
        </fieldset>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label" htmlFor="rb-title">{t.reportTitle}</label>
          <input id="rb-title" className="input" value={o.title} maxLength={140} onChange={(e) => set({ title: e.target.value })} />
        </div>
        <div>
          <label className="label" htmlFor="rb-comments">{t.reportComments}</label>
          <textarea id="rb-comments" className="input" rows={2} maxLength={2000} value={o.comments} onChange={(e) => set({ comments: e.target.value })} />
        </div>
      </div>

      <fieldset className="rounded-xl border border-slate-200 p-3">
        <legend className="px-1 text-sm font-semibold text-slate-800">{t.reportSections}</legend>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {REPORT_SECTIONS.map((s) => (
            <label key={s} className="flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={o.sections.includes(s)} onChange={(e) => toggleSection(s, e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-600" />
              <span>{SECTION_LABELS[s][lang]}</span>
            </label>
          ))}
        </div>
        {o.sections.includes("detail") && (
          <div className="mt-3 max-w-sm">
            <label className="label" htmlFor="rb-detail">{t.reportDetailFilter}</label>
            <select id="rb-detail" className="input" value={o.detail} onChange={(e) => set({ detail: e.target.value as ReportOptions["detail"] })}>
              {DETAIL_FILTERS.map((k) => <option key={k} value={k}>{DETAIL_LABELS[k][lang]}</option>)}
            </select>
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <span className="label">{t.reportFormat}</span>
          <div className="flex gap-2">
            <button type="button" className={chip(o.format === "pdf")} onClick={() => set({ format: "pdf" })} aria-pressed={o.format === "pdf"}><FileText className="mr-1 inline h-4 w-4" />PDF</button>
            <button type="button" className={chip(o.format === "pptx")} onClick={() => set({ format: "pptx" })} aria-pressed={o.format === "pptx"}><Presentation className="mr-1 inline h-4 w-4" />PowerPoint</button>
          </div>
        </div>
        <span className="flex-1" />
        {noCampaign || o.sections.length === 0 ? (
          <span className="text-sm text-mitur-red">{noCampaign ? t.reportNoCampaign : t.reportNoSection}</span>
        ) : (
          <a className="btn" href={href} download><Download className="h-4 w-4" />{o.format === "pptx" ? t.reportDownloadPptx : t.reportDownloadPdf}</a>
        )}
      </div>

      <details className="rounded-xl bg-slate-50 p-3" open={templateId > 0}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-800"><Save className="mr-1 inline h-4 w-4" />{t.reportSaveTemplate}</summary>
        <ActionForm action={saveAction} className="mt-3 space-y-3">
          <input type="hidden" name="options" value={JSON.stringify(o)} />
          <input type="hidden" name="templateId" value={templateId || ""} />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-3">
              <label className="label" htmlFor="rb-name">{t.reportTemplateName}</label>
              <input id="rb-name" name="name" className="input" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.reportTemplateExample} />
            </div>
            <div>
              <label className="label" htmlFor="rb-frequency">{t.reportFrequency}</label>
              <select id="rb-frequency" name="frequency" className="input" value={frequency} onChange={(e) => { setFrequency(e.target.value as Frequency); setRunDay(1); }}>
                {FREQUENCIES.map((f) => <option key={f} value={f}>{FREQUENCY_LABELS[f][lang]}</option>)}
              </select>
            </div>
            {frequency !== "none" && (
              <div>
                <label className="label" htmlFor="rb-day">{frequency === "monthly" ? t.reportMonthDay : t.reportWeekday}</label>
                <select id="rb-day" name="runDay" className="input" value={runDay} onChange={(e) => setRunDay(Number(e.target.value))}>
                  {frequency === "monthly"
                    ? Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)
                    : WEEKDAY_LABELS.map((w, i) => <option key={i} value={i + 1}>{w[lang]}</option>)}
                </select>
              </div>
            )}
          </div>
          {frequency !== "none" && <p className="text-xs text-slate-500">{t.reportScheduleHelp}</p>}
          <div className="flex justify-end"><SubmitButton className="btn-secondary">{templateId ? t.reportUpdateTemplate : t.reportSaveTemplate}</SubmitButton></div>
        </ActionForm>
      </details>
    </div>
  );
}
