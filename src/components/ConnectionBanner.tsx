"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CONNECTION_EVENT, connectionMessage } from "@/lib/connection";

// Shows a clear banner when the browser is offline or the server can't be reached.
export function ConnectionBanner({ retryLabel }: { retryLabel: string }) {
  const [problem, setProblem] = useState(false);
  const [checking, setChecking] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const down = () => setProblem(true);
    const up = () => void check();
    if (!navigator.onLine) setProblem(true);
    window.addEventListener("offline", down);
    window.addEventListener("online", up);
    window.addEventListener(CONNECTION_EVENT, down);
    return () => {
      window.removeEventListener("offline", down);
      window.removeEventListener("online", up);
      window.removeEventListener(CONNECTION_EVENT, down);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function check() {
    setChecking(true);
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      if (r.ok) {
        setProblem(false);
        router.refresh();
      } else setProblem(true);
    } catch {
      setProblem(true);
    } finally {
      setChecking(false);
    }
  }

  if (!problem) return null;
  return (
    <div role="alert" className="fixed inset-x-0 bottom-4 z-50 mx-auto flex w-[calc(100%-2rem)] max-w-xl items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg">
      <WifiOff className="h-5 w-5 shrink-0 text-amber-300" />
      <span className="flex-1">{connectionMessage()}</span>
      <button type="button" onClick={check} disabled={checking} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-medium hover:bg-white/20">
        <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} /> {retryLabel}
      </button>
    </div>
  );
}
