// «Perfiles de permisos»: the list of actions a profile can allow, the profiles that copy the old roles, and the
// one-time step that gives every person the profile matching what they could do before.
// Plain JavaScript so the database step (scripts/migrate.mjs) and the app share the same list.

/** @type {{ id: string, mod: "c" | "q" | "g", req: string[], adminOnly?: boolean }[]} */
export const ACTIONS = [
  // Campañas de llamadas
  { id: "c.call", mod: "c", req: [] },
  { id: "c.own", mod: "c", req: [] },
  { id: "c.review", mod: "c", req: ["c.own"] },
  { id: "c.view", mod: "c", req: [] },
  { id: "c.edit", mod: "c", req: ["c.view"] },
  { id: "c.upload", mod: "c", req: ["c.view"] },
  { id: "c.assign", mod: "c", req: ["c.view"] },
  { id: "c.transfer", mod: "c", req: ["c.view"] },
  { id: "c.remove", mod: "c", req: ["c.edit"] },
  { id: "c.visits", mod: "c", req: [] },
  { id: "c.stats", mod: "c", req: ["c.view"] },
  { id: "c.reports", mod: "c", req: ["c.view"] },
  { id: "c.excel", mod: "c", req: ["c.view"] },
  { id: "c.changes", mod: "c", req: ["c.view"] },
  { id: "c.settings", mod: "c", req: ["c.view"] },
  // Quejas y reclamaciones
  { id: "q.register", mod: "q", req: [] },
  { id: "q.seeAll", mod: "q", req: ["q.register"] },
  { id: "q.workMine", mod: "q", req: ["q.register"] },
  { id: "q.workAny", mod: "q", req: ["q.seeAll", "q.workMine"] },
  { id: "q.assign", mod: "q", req: ["q.seeAll"] },
  { id: "q.approve", mod: "q", req: ["q.seeAll"] },
  { id: "q.reopen", mod: "q", req: ["q.seeAll"] },
  { id: "q.personal", mod: "q", req: ["q.register"] },
  { id: "q.files", mod: "q", req: ["q.register"] },
  { id: "q.stats", mod: "q", req: ["q.seeAll"] },
  { id: "q.settings", mod: "q", req: [] },
  // General
  { id: "g.people", mod: "g", req: [] },
  { id: "g.perms", mod: "g", req: [], adminOnly: true },
  { id: "g.sigtur", mod: "g", req: [] },
  { id: "g.log", mod: "g", req: [] },
];

export const ACTION_IDS = ACTIONS.map((a) => a.id);
const BY_ID = new Map(ACTIONS.map((a) => [a.id, a]));

// The locked profile: always every action, can't be changed or deleted.
export const ADMIN_KEY = "admin";

/** Ticking an action also ticks what it needs (recursively); unknown and admin-only actions are dropped. */
export function withRequirements(list) {
  const out = new Set();
  const add = (id) => {
    const a = BY_ID.get(id);
    if (!a || a.adminOnly || out.has(id)) return;
    out.add(id);
    a.req.forEach(add);
  };
  for (const id of list ?? []) add(id);
  return ACTION_IDS.filter((id) => out.has(id));
}

/** Unticking an action also removes everything that depends on it. */
export function withoutDependents(list, removed) {
  const out = new Set(list);
  const drop = (id) => {
    out.delete(id);
    for (const a of ACTIONS) if (a.req.includes(id) && out.has(a.id)) drop(a.id);
  };
  drop(removed);
  return ACTION_IDS.filter((id) => out.has(id));
}

const SUPERVISOR_CALLS = ["c.call", "c.own", "c.review", "c.view", "c.upload", "c.assign", "c.transfer", "c.visits", "c.stats", "c.reports", "c.excel", "c.changes", "c.settings"];
const QR_BY_LEVEL = {
  none: [],
  register: ["q.register"],
  manage: ["q.register", "q.seeAll", "q.workMine", "q.personal", "q.files", "q.stats"],
  supervise: ["q.register", "q.seeAll", "q.workMine", "q.personal", "q.files", "q.stats", "q.workAny", "q.assign", "q.approve", "q.reopen", "q.settings"],
};

/** What a person could do before profiles existed (role + «Campañas de llamadas» + level in «Quejas»). */
export function legacyActions(role, callsAccess, qrLevel) {
  if (role === "admin") return [...ACTION_IDS];
  const calls = role !== "complaints" && !!callsAccess;
  const c = !calls ? [] : role === "supervisor" ? SUPERVISOR_CALLS : role === "agent" ? ["c.call", "c.own"] : role === "inspector" ? ["c.visits"] : [];
  const q = QR_BY_LEVEL[qrLevel] ?? [];
  return ACTION_IDS.filter((id) => c.includes(id) || q.includes(id));
}

// Day-one profiles: copies of the old roles.
export const STANDARD_PROFILES = [
  { key: ADMIN_KEY, name: "Administrador", description: "Todo, incluidos los permisos. No se puede cambiar ni eliminar.", actions: [...ACTION_IDS] },
  { key: "supervisor", name: "Supervisor", description: "Dirige las campañas de llamadas y supervisa las quejas.", actions: legacyActions("supervisor", true, "supervise") },
  { key: "agent", name: "Agente de llamadas", description: "Llama y ve sus propias llamadas.", actions: legacyActions("agent", true, "none") },
  { key: "agent_qr", name: "Agente · registra quejas", description: "Agente que además registra quejas recibidas por teléfono.", actions: legacyActions("agent", true, "register") },
  { key: "inspector", name: "Inspector", description: "Visitas de campo.", actions: legacyActions("inspector", true, "none") },
  { key: "complaints", name: "Gestor de quejas", description: "Solo «Quejas y reclamaciones»: ve todos los casos y trabaja los asignados.", actions: legacyActions("complaints", false, "manage") },
];

const ROLE_NAME = { admin: "Administrador", supervisor: "Supervisor", agent: "Agente", inspector: "Inspector", complaints: "Gestor de quejas" };
const LEVEL_NAME = { none: "sin quejas", register: "registra quejas", manage: "gestiona quejas", supervise: "supervisa quejas" };

export function parseActions(text) {
  try {
    const v = JSON.parse(text ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

const same = (a, b) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

/**
 * Creates the day-one profiles (once) and gives each person without a profile the one matching what they could
 * do before. People whose old access matches no day-one profile get an extra profile with exactly that access,
 * so nobody gains or loses anything. Safe to run on every deploy.
 * @param {import("@libsql/client").Client} client
 */
export async function ensureProfiles(client) {
  const has = await client.execute("SELECT COUNT(*) AS n FROM permission_profiles");
  let created = 0;
  if (Number(has.rows[0].n) === 0) {
    for (const p of STANDARD_PROFILES) {
      await client.execute({ sql: "INSERT INTO permission_profiles (key, name, description, actions) VALUES (?, ?, ?, ?)", args: [p.key, p.name, p.description, JSON.stringify(p.actions)] });
      created++;
    }
  }
  const people = (await client.execute("SELECT id, role, calls_access, qr_level FROM users WHERE profile_id IS NULL")).rows;
  if (!people.length) return { created, assigned: 0 };
  const profiles = (await client.execute("SELECT id, key, name, actions FROM permission_profiles")).rows.map((r) => ({ id: Number(r.id), key: r.key, name: String(r.name), actions: parseActions(r.actions) }));
  let assigned = 0;
  for (const u of people) {
    const role = String(u.role);
    const acts = legacyActions(role, Number(u.calls_access) === 1, String(u.qr_level));
    let p = role === "admin" ? profiles.find((x) => x.key === ADMIN_KEY) : profiles.find((x) => x.key !== ADMIN_KEY && same(x.actions, acts));
    if (!p) {
      let name = `${ROLE_NAME[role] ?? role} · ${LEVEL_NAME[String(u.qr_level)] ?? String(u.qr_level)}`;
      if (role !== "complaints" && Number(u.calls_access) !== 1) name += " · sin llamadas";
      let n = 2;
      const base = name;
      while (profiles.some((x) => x.name === name)) name = `${base} (${n++})`;
      const r = await client.execute({ sql: "INSERT INTO permission_profiles (name, description, actions) VALUES (?, ?, ?) RETURNING id", args: [name, "Creado automáticamente con los permisos que la persona ya tenía.", JSON.stringify(acts)] });
      p = { id: Number(r.rows[0].id), key: null, name, actions: acts };
      profiles.push(p);
      created++;
    }
    await client.execute({ sql: "UPDATE users SET profile_id = ? WHERE id = ?", args: [p.id, Number(u.id)] });
    assigned++;
  }
  if (created || assigned) {
    await client.execute({ sql: "INSERT INTO activity_log (user_name, action, entity, summary) VALUES (?, ?, ?, ?)", args: ["Sistema", "profile.backfill", "profile", `Perfiles creados a partir de los roles: ${created}; personas con perfil asignado: ${assigned}`] });
  }
  return { created, assigned };
}
