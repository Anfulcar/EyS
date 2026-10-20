import { SearchX } from "lucide-react";
import Link from "next/link";
import { getDict } from "@/lib/i18n-server";

export default async function NotFound() {
  const { t } = await getDict();
  return (
    <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><SearchX className="h-7 w-7" /></span>
      <h1>{t.notFoundTitle}</h1>
      <p className="text-sm text-slate-500">{t.notFoundText}</p>
      <Link href="/" className="btn">{t.goHome}</Link>
    </div>
  );
}
