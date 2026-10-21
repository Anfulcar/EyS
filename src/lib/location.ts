import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

type Place = { es: string; en: string; vercel?: string };

// Database locations (from the region in the Turso address) and the matching Vercel region.
const DB_PLACES: Record<string, Place> = {
  "aws-us-east-1": { es: "EE. UU. Este (Virginia)", en: "US East (Virginia)", vercel: "iad1" },
  "aws-us-east-2": { es: "EE. UU. Este (Ohio)", en: "US East (Ohio)", vercel: "cle1" },
  "aws-us-west-2": { es: "EE. UU. Oeste (Oregón)", en: "US West (Oregon)", vercel: "pdx1" },
  "aws-sa-east-1": { es: "Brasil (São Paulo)", en: "Brazil (São Paulo)", vercel: "gru1" },
  "aws-eu-west-1": { es: "Irlanda", en: "Ireland", vercel: "dub1" },
  "aws-eu-central-1": { es: "Alemania (Fráncfort)", en: "Germany (Frankfurt)", vercel: "fra1" },
  "aws-ap-south-1": { es: "India (Bombay)", en: "India (Mumbai)", vercel: "bom1" },
  "aws-ap-northeast-1": { es: "Japón (Tokio)", en: "Japan (Tokyo)", vercel: "hnd1" },
};

const APP_PLACES: Record<string, Place> = {
  iad1: { es: "EE. UU. Este (Washington D. C.)", en: "US East (Washington, D.C.)" },
  cle1: { es: "EE. UU. Este (Cleveland)", en: "US East (Cleveland)" },
  pdx1: { es: "EE. UU. Oeste (Portland)", en: "US West (Portland)" },
  sfo1: { es: "EE. UU. Oeste (San Francisco)", en: "US West (San Francisco)" },
  gru1: { es: "Brasil (São Paulo)", en: "Brazil (São Paulo)" },
  dub1: { es: "Irlanda (Dublín)", en: "Ireland (Dublin)" },
  fra1: { es: "Alemania (Fráncfort)", en: "Germany (Frankfurt)" },
  lhr1: { es: "Reino Unido (Londres)", en: "United Kingdom (London)" },
  bom1: { es: "India (Bombay)", en: "India (Mumbai)" },
  hnd1: { es: "Japón (Tokio)", en: "Japan (Tokyo)" },
};

// Only the region name is read from the address; the address itself is never shown.
export function databaseRegion(url = process.env.TURSO_DATABASE_URL ?? "") {
  const m = url.match(/\.(aws-[a-z]+-[a-z]+-\d)\.turso\.io/);
  if (m) return m[1];
  return url.startsWith("file:") ? "local" : null;
}

export async function locationReport(lang: "es" | "en") {
  const dbRegion = databaseRegion();
  const appRegion = process.env.VERCEL_REGION ?? null;
  const times: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t0 = Date.now();
    await db.run(sql`select 1`);
    times.push(Date.now() - t0);
  }
  const ms = times.sort((a, b) => a - b)[1];
  const dbPlace = dbRegion && DB_PLACES[dbRegion];
  const appPlace = appRegion && APP_PLACES[appRegion];
  const close = dbRegion === "local" || (!!dbPlace && dbPlace.vercel === appRegion) || ms <= 15;
  return {
    database: dbPlace ? dbPlace[lang] : dbRegion === "local" ? (lang === "es" ? "Este servidor" : "This server") : lang === "es" ? "No indicada" : "Not shown",
    app: appPlace ? appPlace[lang] : appRegion ?? (lang === "es" ? "Este servidor" : "This server"),
    ms,
    close,
  };
}
