import type { Metadata } from "next";
import { PublicForm } from "@/components/qr/PublicForm";
import { getDict } from "@/lib/i18n-server";
import { qrSettings, QR_TYPES } from "@/lib/qr";
import { QR_TEXT, QR_TYPE_TEXT } from "@/lib/qr-i18n";
import { publicCaseAction } from "../quejas/actions";

export const metadata: Metadata = { title: "Quejas y reclamaciones – Ministerio de Turismo" };

// Public page (no account): tourists and citizens present a complaint, claim, report or suggestion.
export default async function PublicComplaintPage() {
  const { lang } = await getDict();
  const t = QR_TEXT[lang];
  const s = await qrSettings();
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-2xl bg-brand-600 px-5 py-4 text-white">
        <h1 className="text-white">{t.pfTitle}</h1>
        <p className="text-sm opacity-90">{t.pfSub}</p>
      </div>
      {s.publicForm ? (
        <PublicForm t={t} types={QR_TYPES.map((x) => ({ value: x, label: QR_TYPE_TEXT[lang][x] }))} topics={s.topics.filter((x) => !x.includes("SIGTUR"))} action={publicCaseAction} />
      ) : (
        <p className="card text-slate-700">{t.pfClosed}</p>
      )}
    </div>
  );
}
