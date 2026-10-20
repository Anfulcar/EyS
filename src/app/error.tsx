"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

// Shown when a page fails to load (server unreachable or an unexpected error).
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [en, setEn] = useState(false);
  useEffect(() => setEn(document.documentElement.lang === "en"), []);
  useEffect(() => {
    // Report to the error log; ignore failures (the server may be the thing that is down).
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: error.message, digest: error.digest, path: location.pathname }),
    }).catch(() => {});
  }, [error]);
  return (
    <div className="mx-auto mt-16 flex max-w-md flex-col items-center gap-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-500"><AlertTriangle className="h-7 w-7" /></span>
      <h1>{en ? "Something went wrong" : "Algo salió mal"}</h1>
      <p className="text-sm text-slate-500">
        {en
          ? "Can't reach the server or the page failed to load. Check your connection and try again."
          : "No se pudo conectar con el servidor o la página no cargó. Revise su conexión e intente de nuevo."}
      </p>
      <button className="btn" onClick={() => reset()}><RefreshCw className="h-4 w-4" />{en ? "Try again" : "Intentar de nuevo"}</button>
    </div>
  );
}
