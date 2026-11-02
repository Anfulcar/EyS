// Sends proof files in pieces (each request stays small), to a case named by its number (logged-in people
// who work it) or with the short-lived permission given right after creating it.
export async function uploadFiles(files: File[], who: { number?: string; token?: string }, onProgress?: (name: string) => void) {
  const failed: string[] = [];
  for (const f of files) {
    onProgress?.(f.name);
    try {
      const start = await fetch("/api/public/qr-upload/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...who, name: f.name, mime: f.type || "application/octet-stream", size: f.size }),
      });
      if (!start.ok) throw new Error();
      const { fileId, parts, partSize } = (await start.json()) as { fileId: number; parts: number; partSize: number };
      for (let i = 0; i < parts; i++) {
        const r = await fetch(`/api/public/qr-upload/part?fileId=${fileId}&idx=${i}`, {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream", ...(who.token ? { "x-upload-token": who.token } : {}) },
          body: f.slice(i * partSize, (i + 1) * partSize),
        });
        if (!r.ok) throw new Error();
      }
    } catch {
      failed.push(f.name);
    }
  }
  return failed;
}

export const MAX_FILE = 8 * 1024 * 1024;
export const ACCEPT = "image/*,application/pdf,audio/*,video/mp4,.doc,.docx,.xls,.xlsx,.txt";
