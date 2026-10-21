import { readFileSync } from "node:fs";

// Security headers live in vercel.json (applied by Vercel). Outside Vercel (local runs, browser tests)
// the same headers are applied here, so tests exercise exactly what production serves.
const vercel = JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url), "utf8"));
const isLocalHttp = !process.env.VERCEL;

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@libsql/client", "exceljs", "pdfkit", "pptxgenjs"],
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  poweredByHeader: false,
  async headers() {
    if (!isLocalHttp) return [];
    return vercel.headers.map((rule) => ({
      source: rule.source,
      headers: rule.headers
        // HTTPS-only rules would break plain-http local runs.
        .filter((h) => h.key !== "Strict-Transport-Security")
        .map((h) => (h.key === "Content-Security-Policy" ? { ...h, value: h.value.replace("; upgrade-insecure-requests", "") } : h)),
    }));
  },
};
export default nextConfig;
