"use client";

// Last-resort screen if the whole app fails to load (plain styles: the normal layout may not be available).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f5f7fb", color: "#1e293b", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", maxWidth: 420, padding: 24 }}>
          <h1 style={{ fontSize: 22 }}>No se pudo conectar con el servidor</h1>
          <p style={{ color: "#64748b" }}>Revise su conexión e intente de nuevo. / Can&apos;t reach the server, try again.</p>
          <button onClick={() => reset()} style={{ background: "#4f46e5", color: "#fff", border: 0, borderRadius: 12, padding: "10px 18px", fontWeight: 600, cursor: "pointer" }}>
            Intentar de nuevo / Try again
          </button>
        </div>
      </body>
    </html>
  );
}
