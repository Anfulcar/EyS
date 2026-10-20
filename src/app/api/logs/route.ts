import Papa from "papaparse";
import { logActivity } from "@/lib/audit";
import { notFoundResponse, routeUser } from "@/lib/auth";
import { activityRows, errorRows } from "@/lib/logs";

export async function GET(req: Request) {
  const user = await routeUser(["admin"]);
  if (!user) return notFoundResponse();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const errors = sp.tab === "errors";
  const rows = errors ? await errorRows(sp, 50000) : await activityRows(sp, 50000);
  await logActivity(user, "export.downloaded", { entity: "log", summary: errors ? "Registro de errores (CSV)" : "Registro de actividad (CSV)" });
  const csv = Papa.unparse(rows as object[]);
  return new Response("﻿" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="registro_${errors ? "errores" : "actividad"}.csv"` },
  });
}
