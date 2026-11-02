"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { QrDict } from "@/lib/qr-i18n";
import { toast } from "../Toasts";
import { ACCEPT, MAX_FILE, uploadFiles } from "./upload";

// «Agregar pruebas» in a case the person works.
export function FileUploader({ number, t }: { number: string; t: QrDict }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const send = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    const big = files.filter((f) => f.size > MAX_FILE);
    if (big.length) toast(t.tooBig.replace("{f}", big.map((f) => f.name).join(", ")));
    const ok = files.filter((f) => f.size <= MAX_FILE);
    if (!ok.length) return;
    const failed = await uploadFiles(ok, { number }, (n) => setBusy(n));
    setBusy("");
    if (failed.length) toast(t.badType.replace("{f}", failed.join(", ")));
    else toast(t.saved);
    router.refresh();
  };
  return (
    <label className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-slate-200 px-4 py-5 text-center text-sm text-slate-600 transition hover:border-brand-300 hover:text-brand-700 ${busy ? "pointer-events-none opacity-60" : ""}`}>
      <span className="font-semibold">{busy ? t.uploading.replace("{f}", busy) : t.addFiles}</span>
      <span className="text-xs text-slate-500">{t.proofsHelp}</span>
      <input type="file" multiple accept={ACCEPT} className="sr-only" disabled={!!busy} onChange={(e) => { send(e.target.files); e.target.value = ""; }} data-testid="qr-file-input" />
    </label>
  );
}
