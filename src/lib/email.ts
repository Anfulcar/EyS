import { isNotNull, or, sql } from "drizzle-orm";
import { establishments } from "@/db/schema";

// The email in use for an establishment: the corrected one (from a call or a visit) when there is one.
export const emailInUse = sql<string | null>`coalesce(${establishments.correoActualizado}, ${establishments.correo})`;
// Establishments that can receive the mailing: a valid email in the file, or a corrected one.
export const HAS_EMAIL = or(sql`${establishments.correoValido} = 'Sí'`, isNotNull(establishments.correoActualizado))!;
