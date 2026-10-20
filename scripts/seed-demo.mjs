// Demo mode (SEED_DEMO=true): reloads made-up people and data on every deployment of a PREVIEW site.
// Safety locks — the seed refuses to run when:
//   1. VERCEL_ENV is "production" (the live site), or
//   2. the database already has data and was never marked as a demo database (protects real data), or
//   3. DEMO_PASSWORD is missing (no password is ever written in the code).
import bcrypt from "bcryptjs";

export const DEMO_USERS = [
  { username: "demo.admin", name: "Adriana Admin (demo)", role: "admin" },
  { username: "demo.supervisor", name: "Sergio Supervisor (demo)", role: "supervisor" },
  { username: "demo.agente1", name: "Ana Agente (demo)", role: "agent" },
  { username: "demo.agente2", name: "Luis Agente (demo)", role: "agent" },
  { username: "demo.inspector", name: "Iván Inspector (demo)", role: "inspector" },
];

// Tables in delete order (children first).
const TABLES = ["activity_log", "error_log", "call_results", "call_attempts", "visits", "status_changes", "phones", "establishments", "companies", "import_logs", "campaigns", "users"];

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ZONES = [
  ["A1. Bávaro – Punta Cana – Cap Cana", "La Altagracia", "Higüey"],
  ["A2. Verón – Macao – Uvero Alto", "La Altagracia", "Higüey"],
  ["B. Higüey ciudad", "La Altagracia", "Higüey"],
  ["C. Bayahibe – Dominicus – Yuma", "La Altagracia", "San Rafael del Yuma"],
  ["D. La Romana – Casa de Campo – Isla Catalina", "La Romana", "La Romana"],
  ["E. San Pedro – Juan Dolio – Guayacanes", "San Pedro de Macorís", "Guayacanes"],
  ["F. El Seibo – Miches – Hato Mayor", "El Seibo", "Miches"],
];
const TYPES = [
  ["TA", "Turismo de aventura", "Acuáticas", ["Buceo", "Snorkel", "Catamarán", "Kayak", "Pesca"]],
  ["GS", "Gift shops", "Tiendas de artesanía", ["Souvenirs", "Artesanía", "Ámbar y Larimar", "Regalos"]],
  ["AV", "Agencias de viajes y tour operador", "Tour operador receptivo-emisivo", ["Tours", "Excursiones", "Viajes"]],
  ["AB", "Establecimientos de expendio de alimentos y bebidas", "Restaurantes", ["Restaurante", "Bar", "Cafetería"]],
  ["EH", "Establecimientos de hospedaje", "Hoteles", ["Hotel", "Villas", "Hostal"]],
];
const WORDS = ["Coral", "Palmera", "Arena", "Caribe", "Marlin", "Sol", "Brisa", "Laguna", "Cayo", "Delfín", "Mangle", "Ola"];

const today = () => new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10);
const shiftDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const shiftIso = (n) => new Date(Date.now() + n * 86400000).toISOString();

export function buildDemoData() {
  const r = rng(20261020);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const ests = [];
  let n = 0;
  // 24 companies; some have several establishments (same RNC = "same company")
  for (let c = 0; c < 24; c++) {
    const [prefix, subsector, actividad, kinds] = pick(TYPES);
    const brand = `${pick(WORDS)} ${pick(WORDS)}`;
    const razon = `${brand} Demo, SRL`;
    const rnc = `1${String(30 + c).padStart(2, "0")}-${String(900000 + c * 37).padStart(6, "0")}`;
    const count = c % 6 === 0 ? 3 : c % 4 === 0 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      n++;
      const [zona, provincia, municipio] = c < 12 ? ZONES[0] : pick(ZONES);
      const vencida = r() < 0.6;
      const yearsAgo = 1 + Math.floor(r() * 7);
      const venc = vencida ? shiftDays(-365 * yearsAgo - Math.floor(r() * 300)) : null;
      const hasEmail = r() < 0.85;
      const hasPhone = r() < 0.93;
      ests.push({
        sigturId: String(90000 + n),
        rut: `${prefix}-DEMO-${String(1000 + n)}`,
        estatusRnt: vencida ? "Vencida" : "Sin licencia",
        prioridad: count > 1 || (vencida && yearsAgo <= 3) ? "P1" : vencida && yearsAgo > 5 ? "P3" : "P2",
        nombreComercial: `${pick(kinds)} ${brand}${count > 1 ? ` ${["Norte", "Sur", "Playa"][k]}` : ""}`,
        razonSocial: razon,
        rnc,
        subsector,
        actividad,
        provincia,
        municipio,
        zonaOperativa: zona,
        direccion: `Calle Demo ${n}, ${municipio}`,
        telefono: hasPhone ? `(809) 555-${String(100 + n).padStart(4, "0")}` : null,
        telefonoValido: hasPhone ? "Sí" : "No",
        correo: hasEmail ? `contacto${n}@example.com` : null,
        correoValido: hasEmail ? "Sí" : "No",
        contactabilidad: hasEmail && hasPhone ? "Correo y teléfono" : hasPhone ? "Solo teléfono" : hasEmail ? "Solo correo" : "Sin contacto válido",
        fechaVencimiento: venc,
        tiempoVencida: venc ? `${yearsAgo} años` : null,
        antiguedad: !venc ? "N/A (sin licencia)" : yearsAgo > 5 ? "5. Más de 5 años" : yearsAgo > 3 ? "4. 3 a 5 años" : "3. 1 a 3 años",
        correoEnviadoFecha: hasEmail ? shiftDays(-6) : null,
      });
    }
  }
  return ests;
}

export async function seedDemo(client, env = process.env) {
  if (env.VERCEL_ENV === "production") throw new Error("[demo] Refused: SEED_DEMO is not allowed on the live (production) site.");
  const password = env.DEMO_PASSWORD ?? "";
  if (password.length < 8) throw new Error("[demo] Refused: set DEMO_PASSWORD (8+ characters) in Vercel → Preview environment.");

  const marker = await client.execute("SELECT value FROM app_meta WHERE key = 'mode'");
  const isDemo = marker.rows[0]?.value === "demo";
  const users = Number((await client.execute("SELECT COUNT(*) AS n FROM users")).rows[0].n);
  const campaigns = Number((await client.execute("SELECT COUNT(*) AS n FROM campaigns")).rows[0].n);
  if (!isDemo && (users > 0 || campaigns > 0)) {
    throw new Error("[demo] Refused: this database has data and is not marked as a demo database. Use a separate database for previews.");
  }

  // Wipe everything (only ever reached on an empty or demo-marked database).
  await client.batch([...TABLES.map((t) => `DELETE FROM ${t}`), "INSERT OR REPLACE INTO app_meta (key, value) VALUES ('mode', 'demo')"], "write");

  const hash = await bcrypt.hash(password, 10);
  const userIds = {};
  for (const u of DEMO_USERS) {
    const res = await client.execute({
      sql: "INSERT INTO users (username, name, role, password_hash, must_change_password) VALUES (?, ?, ?, ?, 0) RETURNING id",
      args: [u.username, u.name, u.role, hash],
    });
    userIds[u.username] = Number(res.rows[0].id);
  }
  const camp = await client.execute({
    sql: "INSERT INTO campaigns (name, description, start_date, end_date, status, max_attempts, followup_days, created_by) VALUES (?, ?, ?, ?, 'active', 3, 5, ?) RETURNING id",
    args: ["Campaña demo – Región Este", "Datos ficticios para probar la aplicación. Se recargan en cada despliegue.", shiftDays(-10), shiftDays(60), userIds["demo.admin"]],
  });
  const campaignId = Number(camp.rows[0].id);

  const ests = buildDemoData();
  const agents = [userIds["demo.agente1"], userIds["demo.agente2"]];
  const rncAgent = new Map();
  const tasks = [];
  for (const e of ests) {
    if (!rncAgent.has(e.rnc)) rncAgent.set(e.rnc, agents[rncAgent.size % 2]);
    const t = await client.execute({
      sql: "INSERT INTO companies (campaign_id, key, razon_social, rnc, assigned_user_id, assigned_at, priority, zone) VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
      // Assigned on different days, so "days waiting" varies in the demo.
      args: [campaignId, `RUT:${e.rut}`, e.razonSocial, e.rnc, rncAgent.get(e.rnc), shiftIso(-(tasks.length % 7)), e.prioridad, e.zonaOperativa],
    });
    const companyId = Number(t.rows[0].id);
    const est = await client.execute({
      sql: `INSERT INTO establishments (campaign_id, company_id, sigtur_id, rut, estatus_rnt, prioridad, nombre_comercial, razon_social, rnc, subsector, actividad,
            provincia, municipio, zona_operativa, direccion, telefono, telefono_valido, correo, correo_valido, contactabilidad, fecha_vencimiento, tiempo_vencida,
            antiguedad, correo_enviado_fecha) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id`,
      args: [campaignId, companyId, e.sigturId, e.rut, e.estatusRnt, e.prioridad, e.nombreComercial, e.razonSocial, e.rnc, e.subsector, e.actividad,
        e.provincia, e.municipio, e.zonaOperativa, e.direccion, e.telefono, e.telefonoValido, e.correo, e.correoValido, e.contactabilidad, e.fechaVencimiento,
        e.tiempoVencida, e.antiguedad, e.correoEnviadoFecha],
    });
    if (e.telefono) {
      await client.execute({
        sql: "INSERT INTO phones (campaign_id, company_id, number, normalized, source, kind, quality) VALUES (?, ?, ?, ?, 'file', 'original', 'ok')",
        args: [campaignId, companyId, e.telefono, e.telefono.replace(/\D/g, "")],
      });
    }
    tasks.push({ companyId, estId: Number(est.rows[0].id), agent: rncAgent.get(e.rnc), e });
  }

  // Some work already done, so dashboards and every list have something to show.
  const attempt = async (task, i, { contacted, code, daysAgo, spoke, commitment }) => {
    const a = await client.execute({
      sql: `INSERT INTO call_attempts (campaign_id, company_id, user_id, phone_number, called_at, attempt_no, contacted, attended, no_contact_code, spoke_with, spoke_role, is_responsible)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      args: [campaignId, task.companyId, task.agent, task.e.telefono, shiftIso(-daysAgo), i, contacted ? 1 : 0, contacted ? 1 : null, contacted ? null : code,
        spoke ?? null, spoke ? "Gerente" : null, spoke ? 1 : null],
    });
    await client.execute({
      sql: "INSERT INTO call_results (attempt_id, campaign_id, establishment_id, code, en_operacion, commitment_date) VALUES (?, ?, ?, ?, ?, ?)",
      args: [Number(a.rows[0].id), campaignId, task.estId, code, contacted ? (code === "05" ? "No" : "Sí") : null, commitment ?? null],
    });
  };
  const setTask = (task, set) =>
    client.execute({
      sql: "UPDATE companies SET status = ?, attempts = ?, failed_attempts = ?, next_action_at = ?, last_called_at = ?, last_code = ?, whatsapp_suggested = ? WHERE id = ?",
      args: [set.status, set.attempts, set.failed ?? 0, set.next ?? null, shiftIso(-1), set.code, set.whatsapp ? 1 : 0, task.companyId],
    });
  const setEst = (task, set) =>
    client.execute({
      sql: "UPDATE establishments SET final_code = ?, en_operacion = ?, fecha_compromiso = ?, requiere_visita = ?, contacto_nombre = ?, responsable = ? WHERE id = ?",
      args: [set.code, set.op ?? null, set.commitment ?? null, set.visit ?? null, set.contact ?? null, set.agentName ?? null, task.estId],
    });

  const withPhone = tasks.filter((t) => t.e.telefono);
  // Commitments (follow-up in the coming days)
  for (const [i, t] of withPhone.slice(0, 4).entries()) {
    const commitment = shiftDays(3);
    await attempt(t, 1, { contacted: true, code: "01", daysAgo: 2, spoke: "Carmen Rosario", commitment });
    // The first one's follow-up is already overdue (highlighted in the agent's list).
    await setTask(t, { status: "followup", attempts: 1, next: i === 0 ? shiftIso(-2) : shiftIso(10), code: "01" });
    await setEst(t, { code: "01", op: "Sí", commitment, visit: "No", contact: "Carmen Rosario" });
  }
  // No answer once → due again today
  for (const t of withPhone.slice(4, 7)) {
    await attempt(t, 1, { contacted: false, code: "08", daysAgo: 1 });
    await setTask(t, { status: "retry", attempts: 1, failed: 1, next: shiftIso(-0.2), code: "08" });
    await setEst(t, { code: "08" });
  }
  // Three failed attempts → sent to visit
  for (const t of withPhone.slice(7, 9)) {
    for (let i = 1; i <= 3; i++) await attempt(t, i, { contacted: false, code: "08", daysAgo: 5 - i });
    await setTask(t, { status: "visit", attempts: 3, failed: 3, code: "08" });
    await setEst(t, { code: "08", visit: "Sí" });
  }
  // Refused → visit
  {
    const t = withPhone[9];
    await attempt(t, 1, { contacted: true, code: "04", daysAgo: 3, spoke: "Pedro Almonte" });
    await setTask(t, { status: "visit", attempts: 1, code: "04" });
    await setEst(t, { code: "04", op: "Sí", visit: "Sí", contact: "Pedro Almonte" });
  }
  // Closed down
  {
    const t = withPhone[10];
    await attempt(t, 1, { contacted: true, code: "05", daysAgo: 4, spoke: "Vecino" });
    await setTask(t, { status: "done", attempts: 1, code: "05" });
    await setEst(t, { code: "05", op: "No", visit: "No" });
  }
  // Already applied and confirmed in SIGTUR
  for (const t of withPhone.slice(11, 13)) {
    await attempt(t, 1, { contacted: true, code: "02", daysAgo: 6, spoke: "Laura Peña" });
    await setTask(t, { status: "done", attempts: 1, code: "02" });
    await setEst(t, { code: "02", op: "Sí", visit: "No", contact: "Laura Peña" });
    await client.execute({ sql: "UPDATE establishments SET estatus_sigtur_actualizado = 'En proceso', fecha_cambio_estatus = ?, canal_logro = 'Llamada' WHERE id = ?", args: [shiftDays(-2), t.estId] });
    await client.execute({
      sql: "INSERT INTO status_changes (campaign_id, establishment_id, old_status, new_status, changed_at, user_id) VALUES (?, ?, ?, 'En proceso', ?, ?)",
      args: [campaignId, t.estId, t.e.estatusRnt, shiftDays(-2), userIds["demo.admin"]],
    });
  }
  // Establishments with no valid phone go straight to visit
  for (const t of tasks.filter((x) => !x.e.telefono)) {
    await setTask(t, { status: "visit", attempts: 0, code: null });
    await client.execute({ sql: "UPDATE establishments SET requiere_visita = 'Sí' WHERE id = ?", args: [t.estId] });
  }
  return { users: DEMO_USERS.length, establishments: ests.length, campaignId, date: today() };
}
