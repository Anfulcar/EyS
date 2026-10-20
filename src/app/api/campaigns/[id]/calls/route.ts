import { asc, eq } from "drizzle-orm";
import Papa from "papaparse";
import { db } from "@/db";
import { callAttempts, callResults, establishments, users } from "@/db/schema";
import { assertUser, MANAGERS } from "@/lib/auth";
import { codeMatrixText } from "@/lib/catalog";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await assertUser(MANAGERS);
  const id = Number((await params).id);
  const rows = await db
    .select({ r: callResults, a: callAttempts, e: establishments, agent: users.name })
    .from(callResults)
    .innerJoin(callAttempts, eq(callAttempts.id, callResults.attemptId))
    .innerJoin(establishments, eq(establishments.id, callResults.establishmentId))
    .leftJoin(users, eq(users.id, callAttempts.userId))
    .where(eq(callResults.campaignId, id))
    .orderBy(asc(callAttempts.calledAt));
  const yn = (v: boolean | null) => (v == null ? "" : v ? "Sí" : "No");
  const csv = Papa.unparse(
    rows.map(({ r, a, e, agent }) => ({
      fecha_hora: a.calledAt,
      intento: a.attemptNo,
      agente: agent,
      id_sigtur: e.sigturId,
      rut: e.rut,
      nombre_comercial: e.nombreComercial,
      razon_social: e.razonSocial,
      rnc: e.rnc,
      zona_operativa: e.zonaOperativa,
      prioridad: e.prioridad,
      numero_marcado: a.phoneNumber,
      contacto: yn(a.contacted),
      atendido: yn(a.attended),
      hablo_con: a.spokeWith,
      cargo: a.spokeRole,
      es_responsable: yn(a.isResponsible),
      whatsapp: yn(a.whatsappSent),
      tipificacion: codeMatrixText(r.code),
      en_operacion: r.enOperacion,
      fecha_compromiso: r.commitmentDate,
      cerrado_desde: r.closedSince,
      obstaculo: r.obstacle,
      observaciones_llamada: a.notes,
      observaciones_establecimiento: r.notes,
    })),
  );
  return new Response("﻿" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="llamadas_campana_${id}.csv"` },
  });
}
