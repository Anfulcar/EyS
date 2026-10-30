import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { SignJWT } from "jose";
import { FIXTURE } from "./global-setup";

const ADMIN_PW = process.env.E2E_ADMIN_PASSWORD!;
const NEW_PW = "Cambiada-" + ADMIN_PW.slice(0, 6);

async function signIn(page: Page, user: string, password: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.fill("#username", user);
  await page.fill("#password", password);
  await page.click("form button.btn");
  await expect(page).not.toHaveURL(/\/login/);
}

async function changeFirstPassword(page: Page, current: string, next: string) {
  await expect(page).toHaveURL(/\/account/);
  await page.fill("input[name=current]", current);
  await page.fill("input[name=next]", next);
  await page.fill("input[name=confirm]", next);
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page).not.toHaveURL(/\/account/);
}

test("main journey: campaign → upload → assign → calls → visit → dashboard → export", async ({ page }) => {
  // Administrator: first sign-in forces a password change
  await signIn(page, "admin", ADMIN_PW);
  await changeFirstPassword(page, ADMIN_PW, NEW_PW);

  // Create an agent and an inspector with the default password (<username>123)
  await page.goto("/users");
  await page.getByRole("button", { name: "Nuevo usuario" }).click();
  const newUser = page.getByRole("dialog", { name: "Nuevo usuario" });
  for (const [username, name, role] of [["agente1", "Ana Agente", "agent"], ["inspector1", "Iván Inspector", "inspector"]]) {
    await newUser.locator("input[name=username]").fill(username);
    await newUser.locator("input[name=name]").fill(name);
    await newUser.locator("select[name=role]").selectOption(role);
    await newUser.getByRole("button", { name: "Crear" }).click();
    await expect(newUser.getByText(`${username} / ${username}123`)).toBeVisible();
  }
  await page.keyboard.press("Escape");
  await expect(page.locator("tr", { hasText: "inspector1" })).toBeVisible();

  // Create a campaign and upload the Matriz
  await page.goto("/campaigns");
  await page.getByRole("button", { name: "Nueva campaña" }).click();
  const newCampaign = page.getByRole("dialog", { name: "Nueva campaña" });
  await newCampaign.locator("input[name=name]").fill("Campaña de prueba");
  await newCampaign.locator("input[name=startDate]").fill("2026-01-01");
  await newCampaign.locator("input[name=endDate]").fill("2030-12-31");
  await newCampaign.getByRole("button", { name: "Crear" }).click();
  await expect(page).toHaveURL(/\/campaigns\/\d+\/import/);
  const campaignUrl = page.url().replace("/import", "");
  await page.setInputFiles("input[type=file]", FIXTURE);
  await page.getByRole("button", { name: /Confirmar carga/ }).click();
  await expect(page.getByText(/Carga completada: 4 insertados/)).toBeVisible();

  // The campaign card shows the right totals
  await page.goto("/campaigns");
  await expect(page.locator("a", { hasText: "Campaña de prueba" }).getByText("4", { exact: true }).first()).toBeVisible();

  // Assign every task to the agent from the side panel
  await page.goto(campaignUrl + "/companies");
  await page.getByRole("button", { name: "Asignar tareas" }).click();
  const panel = page.getByRole("dialog", { name: "Asignar tareas a los agentes" });
  await panel.getByRole("button", { name: "Asignar", exact: true }).click();
  await expect(page.getByTestId("notices").getByText("4 tareas asignadas")).toBeVisible();
  await page.keyboard.press("Escape");

  // Ticked rows can be assigned together (here: back to the same agent)
  await page.locator("tbody input[name=ids]").nth(0).check();
  await page.locator("tbody input[name=ids]").nth(1).check();
  await page.locator("#bulk-assign select[name=userId]").selectOption({ label: "Ana Agente" });
  await page.locator("#bulk-assign").getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByTestId("notices").getByText("2 tareas asignadas")).toBeVisible();

  // Agent: sees the assigned calls
  await signIn(page, "agente1", "agente1123");
  await changeFirstPassword(page, "agente1123", "Agente-Clave-1");
  await expect(page).toHaveURL(/\/calls/);
  await expect(page.getByText("Buceo Uno", { exact: true })).toBeVisible();
  // Counter in the menu and notice: 4 new calls need attention
  await expect(page.getByRole("status").filter({ hasText: "Tienes 4 llamadas que requieren atención: 0 seguimientos vencidos, 4 pendientes de hoy." })).toBeVisible();
  await expect(page.locator("aside nav a", { hasText: "Mis llamadas" }).getByText("4")).toBeVisible();
  // Filter by number of attempts
  await page.getByRole("link", { name: "Sin intentos" }).click();
  await expect(page.getByText("Buceo Uno", { exact: true })).toBeVisible();

  // Same company: one call logged for both establishments with a commitment date
  await page.getByRole("link", { name: /Buceo Uno/ }).click();
  await page.locator("label.choice", { hasText: "Buceo Dos" }).click();
  await page.locator("label.choice-yes").nth(0).click(); // reached someone
  await page.locator("label.choice-yes").nth(1).click(); // was attended
  await page.locator("label.choice-yes").nth(2).click(); // person in charge
  const blocks = page.locator(".rounded-2xl.bg-slate-50\\/80");
  await expect(blocks).toHaveCount(2);
  for (let i = 0; i < 2; i++) {
    await blocks.nth(i).locator("label.choice-yes").click();
    await blocks.nth(i).locator("label.choice", { hasText: "iniciará solicitud" }).click();
    await blocks.nth(i).locator("input[type=date]").fill("2026-11-05");
  }
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Llamada registrada")).toBeVisible();
  // The time of the call was recorded automatically (shown in the history)
  await page.reload();
  await expect(page.locator("ol li").first()).toContainText(new Date().getFullYear().toString());

  // Refusal → sent to visit
  await page.goto("/calls");
  await page.getByRole("link", { name: /Tienda Tres/ }).click();
  await page.locator("label.choice-yes").nth(0).click();
  await page.locator("label.choice-yes").nth(1).click();
  const block = page.locator(".rounded-2xl.bg-slate-50\\/80").first();
  await block.locator("label.choice-yes").click();
  await block.locator("label.choice", { hasText: "no interesado" }).click();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Llamada registrada")).toBeVisible();

  // Inspector: registers the visit
  await signIn(page, "inspector1", "inspector1123");
  await changeFirstPassword(page, "inspector1123", "Inspector-Clave-1");
  await expect(page).toHaveURL(/\/visits/);
  await expect(page.getByText("Tienda Tres", { exact: true })).toBeVisible();
  await page.getByText("Registrar visita").first().click();
  await page.locator("select[name=code]").first().selectOption("V1");
  await page.locator("form:has(select[name=code])").first().getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Tienda Tres", { exact: true })).toHaveCount(0);

  // Agent cannot open the administration screens or downloads: they answer "not found"
  await signIn(page, "agente1", "Agente-Clave-1");
  await page.goto("/help");
  await expect(page.getByRole("heading", { name: "Registrar una llamada" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Novedades" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Administración/ })).toHaveCount(0); // admin-only section hidden
  const screen = await page.goto(campaignUrl);
  expect(screen?.status()).toBe(404);
  await expect(page.getByText("No encontrado")).toBeVisible();
  const download = await page.request.get(campaignUrl.replace("/campaigns/", "/api/campaigns/") + "/export");
  expect(download.status()).toBe(404);
  expect((await page.goto("/logs"))?.status()).toBe(404);
  expect((await page.goto("/reports"))?.status()).toBe(404);
  expect((await page.request.get("/api/report?o=%7B%7D")).status()).toBe(404);

  // Agent: "Llamadas realizadas" shows only their own calls, without the review form
  await page.goto("/reviews");
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.locator("tbody tr", { hasText: "Tienda Tres" }).getByRole("link").first().click();
  await expect(page.getByRole("heading", { name: "Resumen de la llamada" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Marcar como revisada" })).toHaveCount(0);
  const tiendaCall = page.url();

  // Administrator: dashboard numbers open the list of establishments
  await signIn(page, "admin", NEW_PW);
  await page.goto(campaignUrl);
  await expect(page.getByText("Llamados al menos 1 vez")).toBeVisible();
  await page.getByRole("link", { name: /Requieren visita/ }).first().click();
  await expect(page.getByRole("heading", { name: /Requieren visita/ })).toBeVisible();
  await expect(page.getByText("Tienda Tres", { exact: true })).toBeVisible();
  await expect(page.getByText("Buceo Uno", { exact: true })).toHaveCount(0);
  const list = await page.request.get(page.url().replace(/\/campaigns\/(\d+)\/list\?/, "/api/list?campaign=$1&"));
  expect(list.status()).toBe(200);

  // Administrator: reviews a call with a comment
  await page.goto("/reviews?review=no");
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await page.goto(tiendaCall);
  await page.fill("#review-comment", "Buen manejo de la objeción.");
  await page.getByRole("button", { name: "Marcar como revisada" }).click();
  await expect(page.getByText("Revisión guardada.")).toBeVisible();
  await page.goto("/reviews?review=no");
  await expect(page.locator("tbody tr")).toHaveCount(2);

  // Administrator: export with chosen sheets and columns
  await page.goto(campaignUrl + "/export");
  await page.locator("summary", { hasText: "Matriz de seguimiento" }).getByText("Elegir columnas").click();
  await page.locator("label", { hasText: /^RUT$/ }).locator("input").uncheck();
  await page.locator("summary", { hasText: "Visitas" }).locator("input[name=sheet]").uncheck();
  const [file] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar Excel" }).click()]);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile((await file.path())!);
  expect(wb.getWorksheet("Visitas")).toBeUndefined();
  const sheet = wb.getWorksheet("Matriz de seguimiento")!;
  expect(sheet.getRow(1).values).not.toContain("RUT");
  const names = sheet.getColumn(4).values.map(String); // "Nombre comercial" (RUT left out)
  expect(names).toContain("Buceo Uno");
  const results = sheet.getColumn(30).values.map(String); // "Llamada 1 resultado"
  expect(results).toContain("En operación – iniciará solicitud (compromiso)");
  const calls = wb.getWorksheet("Llamadas")!;
  expect(calls.getColumn(23).values.map(String)).toContain("Buen manejo de la objeción.");
  // The old full download still works
  expect((await page.request.get(campaignUrl.replace("/campaigns/", "/api/campaigns/") + "/export")).status()).toBe(200);

  // Administrator: report from "Estadísticas globales", as PDF and as a scheduled PowerPoint template
  await page.goto("/stats");
  await page.getByRole("button", { name: "Generar informe" }).click();
  const builder = page.getByRole("dialog", { name: "Generar informe" });
  await builder.getByRole("button", { name: "Semana pasada" }).click();
  await builder.locator("#rb-title").fill("Informe de prueba");
  const [pdf] = await Promise.all([page.waitForEvent("download"), builder.getByRole("link", { name: "Descargar PDF" }).click()]);
  const fs = await import("node:fs");
  expect(fs.readFileSync((await pdf.path())!).subarray(0, 5).toString()).toBe("%PDF-");
  await builder.getByRole("button", { name: "PowerPoint" }).click();
  await builder.getByText("Guardar como plantilla").first().click();
  await builder.locator("#rb-name").fill("Semanal Dirección");
  await builder.locator("#rb-frequency").selectOption("weekly");
  await builder.getByRole("button", { name: "Guardar como plantilla" }).click();
  await expect(page.getByTestId("notices").getByText("Plantilla guardada.")).toBeVisible();
  await page.goto("/reports");
  // The PDF downloaded from the panel is also kept in «Informes»
  await expect(page.locator("tr", { hasText: "Informe de prueba" }).getByRole("link", { name: "PDF" })).toBeVisible();
  await expect(page.locator("tr", { hasText: "Semanal Dirección" }).getByText(/Semanal · lunes/)).toBeVisible();
  // «Editar» opens the same panel with the template loaded
  await page.locator("tr", { hasText: "Semanal Dirección" }).getByRole("button", { name: "Editar" }).click();
  const editPanel = page.getByRole("dialog", { name: /Editar: Semanal Dirección/ });
  await expect(editPanel.locator("#rb-name")).toHaveValue("Semanal Dirección");
  await expect(editPanel.getByRole("button", { name: "Guardar cambios en la plantilla" })).toBeVisible();
  await page.keyboard.press("Escape");
  // «Generar informe» on this screen opens the panel here; the downloaded report shows up in the list
  await page.getByRole("button", { name: "Generar informe" }).click();
  const here = page.getByRole("dialog", { name: "Generar informe" });
  await here.locator("#rb-title").fill("Informe desde Informes");
  await here.getByRole("button", { name: "PDF" }).click();
  await Promise.all([page.waitForEvent("download"), here.getByRole("link", { name: "Descargar PDF" }).click()]);
  await page.keyboard.press("Escape");
  await expect(page.locator("tr", { hasText: "Informe desde Informes" })).toBeVisible({ timeout: 15000 });
  await page.locator("tr", { hasText: "Semanal Dirección" }).getByRole("button", { name: "Generar ahora" }).click();
  await expect(page.getByText("Informe generado")).toBeVisible();
  await page.reload();
  const pptxHref = await page.getByRole("link", { name: "PowerPoint" }).first().getAttribute("href");
  const pptx = await page.request.get(pptxHref!);
  expect((await pptx.body()).subarray(0, 2).toString()).toBe("PK");

  // Administrator: the campaign's "Resumen" tab with the indicators and the legend
  await page.goto(campaignUrl + "/summary");
  await expect(page.locator("tr", { hasText: "Establecimientos a intervenir" }).locator("td").last()).toHaveText("4");
  await expect(page.getByText("Se registra la fecha de compromiso", { exact: false })).toBeVisible();

  // Administrator: edits the call script (agents see it in each task)
  await page.goto(campaignUrl + "/settings");
  await page.fill("#script-es", "Buenos días, le llamamos del Ministerio de Turismo (guion de prueba).");
  await page.locator("form", { has: page.locator("#script-es") }).getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByTestId("notices").getByText("Guardado")).toBeVisible();

  // Administrator: Ana is absent from today; "Seguimiento" warns and her open tasks are covered by the administrator
  await page.goto("/users");
  await page.locator("tr", { hasText: "agente1" }).getByRole("button", { name: "Ausencias" }).click();
  const absDialog = page.getByRole("dialog", { name: /Ausencias/ });
  await absDialog.getByRole("button", { name: "Agregar ausencia" }).click();
  await expect(absDialog.getByText("Vacaciones ·", { exact: false })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto(campaignUrl + "/followup");
  await expect(page.getByText(/Ana Agente · Vacaciones del .*tareas abiertas/)).toBeVisible();
  await page.getByRole("button", { name: "Cubrir durante la ausencia" }).click();
  const cover = page.getByRole("dialog", { name: /Cubrir durante la ausencia/ });
  await cover.locator("input[name=mode][value=one]").check();
  await cover.locator("select[name=toUserId]").selectOption({ label: "Admin Prueba" });
  await cover.getByRole("button", { name: "Cubrir durante la ausencia" }).click();
  await expect(page.getByTestId("notices").getByText(/tareas cubiertas/)).toBeVisible();
  await page.goto(campaignUrl + "/companies?f=covered");
  await expect(page.getByText(/Cubriendo a Ana Agente/).first()).toBeVisible();
  // Deleting the absence gives the tasks back to Ana
  await page.goto("/users");
  await page.locator("tr", { hasText: "agente1" }).getByRole("button", { name: "Ausencias" }).click();
  await page.getByRole("dialog", { name: /Ausencias/ }).getByRole("button", { name: "Eliminar" }).click();
  await expect(page.getByRole("dialog", { name: /Ausencias/ }).getByText("No hay ausencias registradas.")).toBeVisible();
  await page.goto(campaignUrl + "/companies?f=covered");
  await expect(page.getByText(/Cubriendo a/)).toHaveCount(0);

  // Activity log: administrators see who did what
  await page.goto("/logs");
  for (const what of ["Informe descargado", "Plantilla de informe guardada", "Informe generado", "Llamada registrada", "Llamada revisada", "Ausencia registrada", "Tareas cubiertas durante una ausencia", "Guion de llamada editado", "Visita registrada", "Usuario creado", "Carga de establecimientos", "Asignación de tareas", "Descarga de datos"]) {
    await expect(page.locator("td", { hasText: what }).first()).toBeVisible();
  }

  // Agent: sees the review comment in the task history
  await signIn(page, "agente1", "Agente-Clave-1");
  await page.goto(tiendaCall);
  await expect(page.getByText("Buen manejo de la objeción.")).toBeVisible();
  await page.getByRole("link", { name: "Abrir la tarea" }).click();
  await expect(page.locator("ol li").first()).toContainText("Buen manejo de la objeción.");
  // …and the campaign's call script as edited by the administrator
  await page.getByText("Guion", { exact: false }).first().click();
  await expect(page.getByText("guion de prueba", { exact: false })).toBeVisible();

  // Losing the connection shows a clear message instead of failing silently
  await page.goto("/account");
  await page.context().setOffline(true);
  await page.fill("input[name=current]", "Agente-Clave-1");
  await page.fill("input[name=next]", "Otra-Clave-123");
  await page.fill("input[name=confirm]", "Otra-Clave-123");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "No se pudo conectar con el servidor" })).toBeVisible();
  await page.context().setOffline(false);
});

test("health check and security headers", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok", database: "ok" });
  // The Ministry logo is public (shown on the sign-in page before signing in)
  const logo = await request.get("/brand/mitur-logo.png");
  expect(logo.status()).toBe(200);
  expect(logo.headers()["content-type"]).toContain("image/png");
  const page = await request.get("/login");
  expect(page.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(page.headers()["x-frame-options"]).toBe("DENY");
  expect(page.headers()["x-content-type-options"]).toBe("nosniff");
});

test("sensitive actions ask for the password again after 10 minutes", async ({ page, context, baseURL }) => {
  await signIn(page, "admin", NEW_PW);
  // Pretend the administrator typed their password 11 minutes ago.
  const token = await new SignJWT({ uid: 1, role: "admin", name: "Admin Prueba", mcp: false, authAt: Date.now() - 11 * 60_000 })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(process.env.E2E_AUTH_SECRET!));
  await context.addCookies([{ name: "eys_session", value: token, url: baseURL! }]);

  await page.goto("/users");
  const row = page.locator("tr", { hasText: "agente1" });
  await row.getByRole("button", { name: "Editar" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.locator("select[name=role]").selectOption("supervisor");
  await dialog.getByRole("button", { name: "Guardar" }).click();

  // The server refuses until the password is confirmed; then the change goes through.
  await expect(dialog.getByText("Confirme su contraseña")).toBeVisible();
  await dialog.locator("input[name=password][type=password]").fill("contraseña-equivocada");
  await dialog.getByRole("button", { name: "Confirmar y continuar" }).click();
  await expect(dialog.getByText("La contraseña actual es incorrecta")).toBeVisible();
  await dialog.locator("input[name=password][type=password]").fill(NEW_PW);
  await dialog.getByRole("button", { name: "Confirmar y continuar" }).click();
  await expect(row.locator("td", { hasText: /^Supervisor$/ })).toBeVisible();

  await page.goto("/logs?action=user.role_changed");
  await expect(page.locator("td", { hasText: "agente1: agent → supervisor" })).toBeVisible();
});

test("delete a report, new campaign from results, and the SIGTUR connection", async ({ page, request }) => {
  await signIn(page, "admin", NEW_PW);

  // Administrators can delete a generated report
  await page.goto("/reports");
  const generated = page.locator(".card", { hasText: "Informes generados" }).locator("tbody tr");
  const before = await generated.count();
  expect(before).toBeGreaterThan(0);
  await generated.first().getByRole("button", { name: "Eliminar" }).click();
  // The app's own window asks first
  const ask = page.getByRole("alertdialog");
  await expect(ask).toContainText("No se puede recuperar");
  await ask.getByRole("button", { name: "Eliminar" }).click();
  await expect(generated).toHaveCount(before - 1);

  // New campaign with the tasks of another one: the copies arrive as a draft and the originals are closed as transferred
  await page.goto("/campaigns");
  await page.locator("a.card", { hasText: "Campaña de prueba" }).click();
  await expect(page).toHaveURL(/\/campaigns\/\d+$/);
  const fromUrl = page.url();
  await page.goto(fromUrl + "/companies");
  await page.getByRole("button", { name: "Nueva campaña con estas tareas" }).click();
  const tr = page.getByRole("dialog", { name: "Nueva campaña con estas tareas" });
  for (const box of await tr.locator("input[name=statuses]").all()) await box.check();
  await expect(tr.getByText(/^[1-9]\d* tareas pasarán a la nueva campaña\.$/)).toBeVisible();
  await tr.locator("input[name=name]").fill("Campaña de prueba – seguimiento");
  await tr.locator("input[name=endDate]").fill("2030-12-31");
  await tr.getByRole("button", { name: "Crear campaña y transferir" }).click();
  await expect(page).not.toHaveURL(fromUrl + "/companies");
  await expect(page).toHaveURL(/\/campaigns\/\d+\/companies$/);
  await expect(page.getByText("Viene de «Campaña de prueba»", { exact: false }).first()).toBeVisible();
  await page.goto(fromUrl + "/companies");
  await expect(page.getByRole("link", { name: "Transferida a otra campaña →" }).first()).toBeVisible();

  // Integraciones: create a key (shown once), choose who receives requests
  await page.goto("/integrations");
  await page.getByRole("button", { name: "Crear clave" }).click();
  const created = page.getByText(/Clave creada\./);
  await expect(created).toBeVisible();
  const key = (await created.textContent())!.match(/eys_[A-Za-z0-9_-]+/)![0];
  await page.locator("label.choice", { hasText: "Admin Prueba" }).locator("input").check();
  await page.locator("form", { has: page.locator("input[name=people]") }).getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByTestId("notices").getByText("Guardado")).toBeVisible();

  // Without the key SIGTUR's addresses answer "not found"
  expect((await request.get("/api/integrations/sigtur/interactions")).status()).toBe(404);
  expect((await request.post("/api/integrations/sigtur/call-requests", { data: { idSigtur: "X" } })).status()).toBe(404);
  const auth = { authorization: `Bearer ${key}` };
  const bad = await request.post("/api/integrations/sigtur/call-requests", { headers: auth, data: { idSigtur: "SIG-E2E" } });
  expect(bad.status()).toBe(400);
  const ok = await request.post("/api/integrations/sigtur/call-requests", {
    headers: auth,
    data: { idSigtur: "SIG-E2E-1", solicitadoPor: "Analista Licencias", motivo: "Confirmar si sigue operando", nombreComercial: "Hotel Solicitado", telefonos: ["809-555-0199"] },
  });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toMatchObject({ ok: true, campana: "Solicitudes SIGTUR", asignada: true, tareaExistente: false });

  // The request comes first in "Para hoy", with the purple tag, who asked and why
  await page.goto("/calls");
  const first = page.locator("a.card").first();
  await expect(first).toContainText("Hotel Solicitado");
  await expect(first).toContainText("Solicitud SIGTUR");
  await expect(first).toContainText(/vence|Vence mañana/);
  await expect(first).toContainText("Pedida por Analista Licencias · Confirmar si sigue operando");

  // SIGTUR reads the interactions with the key; managers download them as Excel
  const inter = await request.get("/api/integrations/sigtur/interactions?limite=5", { headers: auth });
  expect(inter.status()).toBe(200);
  const body = await inter.json();
  expect(body.interacciones.length).toBeGreaterThan(0);
  expect(body.interacciones[0].resultado).not.toMatch(/^\d+$/);
  const xlsx = await page.request.get("/api/interactions?from=2026-01-01");
  expect((await xlsx.body()).subarray(0, 2).toString()).toBe("PK");

  // «Campañas»: the permanent SIGTUR campaign sits apart from the temporary ones and can be paused
  await page.goto("/campaigns");
  const permanent = page.getByTestId("sigtur-permanent");
  await expect(permanent).toContainText("Recibiendo solicitudes");
  await expect(page.getByText("Campañas temporales")).toBeVisible();
  await expect(page.locator("a.card", { hasText: "Solicitudes SIGTUR" })).toHaveCount(0);
  await permanent.getByRole("button", { name: "Encendida" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Apagar" }).click();
  await expect(permanent).toContainText("En pausa");
  await expect(permanent).toContainText("Apagada por Admin Prueba");
  const paused = await request.post("/api/integrations/sigtur/call-requests", {
    headers: auth,
    data: { idSigtur: "SIG-E2E-2", solicitadoPor: "Analista Licencias", motivo: "Otra solicitud" },
  });
  expect(paused.status()).toBe(503);
  expect(await paused.json()).toMatchObject({ ok: false, enPausa: true });
  // Open requests keep going while paused
  await page.goto("/calls");
  await expect(page.locator("a.card").first()).toContainText("Hotel Solicitado");
  await page.goto("/integrations");
  const sim = page.locator("form", { has: page.locator("input[name=motivo]") });
  await sim.locator("input[name=idSigtur]").fill("SIG-E2E-3");
  await sim.locator("input[name=motivo]").fill("Prueba en pausa");
  await sim.getByRole("button", { name: "Enviar solicitud de prueba" }).click();
  await expect(sim.getByText("Las solicitudes SIGTUR están en pausa", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Apagada" }).click();
  await expect(page.getByRole("button", { name: "Encendida" })).toBeVisible();

  // Everything SIGTUR sent is listed
  await page.goto("/integrations");
  await expect(page.locator("td", { hasText: "SIG-E2E-1 · Analista Licencias" })).toBeVisible();

  // Automatic sending to SIGTUR: off, calls already waiting, and it can't be switched on without SIGTUR's address and key
  const push = page.getByTestId("sigtur-push");
  await expect(push).toContainText("pendientes de envío");
  await expect(push.locator("td", { hasText: "Interacción" }).first()).toBeVisible();
  await expect(push.getByText("En espera").first()).toBeVisible();
  await push.getByRole("button", { name: "Apagado" }).click();
  await expect(push.getByText("Primero hace falta la dirección de SIGTUR")).toBeVisible();

  // The answered SIGTUR request: solved and queued for SIGTUR
  await page.goto("/calls");
  await page.locator("a.card", { hasText: "Hotel Solicitado" }).click();
  await expect(page.getByText("Pedida por Analista Licencias")).toBeVisible();
  await page.locator("label.choice-yes").nth(0).click(); // reached someone
  await page.locator("label.choice-yes").nth(1).click(); // was attended
  const result = page.locator(".rounded-2xl.bg-slate-50\\/80").first();
  await result.locator("label.choice-yes").click();
  await result.locator("label.choice", { hasText: "Cambió dueño / nombre / dirección" }).click();
  await result.getByLabel("Nueva dirección").fill("Av. Nueva 14, Bávaro");
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Llamada registrada")).toBeVisible();
  await page.goto("/integrations");
  await expect(push.locator("td", { hasText: "Solicitud resuelta" }).first()).toBeVisible();
  await expect(push.locator("td", { hasText: "Av. Nueva 14, Bávaro" }).first()).toContainText("Dirección:");

  // «Registro» shows the app's own decisions
  await page.goto("/logs?action=task.to_visit");
  await expect(page.locator("td", { hasText: "Aplicación" }).first()).toBeVisible();

  // Operating status in the dashboards
  await page.goto("/stats");
  await expect(page.getByText("Estado de operación").first()).toBeVisible();
});

test("administrators remove RUTs from a running campaign (filters and file); supervisors can't", async ({ page }) => {
  await signIn(page, "admin", NEW_PW);
  await page.goto("/campaigns");
  await page.locator("a.card", { has: page.getByRole("heading", { name: "Campaña de prueba", exact: true }) }).click();
  await expect(page).toHaveURL(/\/campaigns\/\d+$/);
  const campaignUrl = page.url();

  // By filters: every «Sin licencia» task
  await page.goto(`${campaignUrl}/companies?rnt=${encodeURIComponent("Sin licencia")}`);
  await page.getByRole("button", { name: "Eliminar de la campaña…" }).click();
  const dialog = page.getByRole("dialog", { name: /Eliminar RUT de/ });
  await dialog.getByRole("button", { name: "Revisar" }).click();
  await expect(dialog.getByTestId("removal-summary")).toContainText("1 tareas · 1 establecimientos");
  await dialog.getByLabel(/Motivo/).fill("Fuera de alcance (prueba)");
  await dialog.getByLabel("Escriba ELIMINAR para confirmar").fill("ELIMINAR");
  await dialog.getByRole("button", { name: "Eliminar 1 RUT" }).click();
  await expect(page.getByTestId("notices").getByText("1 RUT eliminados de la campaña.")).toBeVisible();

  // By file, from «Actualizar estatus»: one RUT of the campaign and one that isn't
  await page.goto(`${campaignUrl}/status`);
  const card = page.getByTestId("remove-from-file");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("RUT");
  ws.addRow(["RUT"]);
  ws.addRow(["TA-DEMO-0001"]);
  ws.addRow(["NO-EXISTE-9"]);
  await card.locator("input[type=file]").setInputFiles({ name: "retirar.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await wb.xlsx.writeBuffer()) });
  await card.getByRole("button", { name: "Revisar" }).click();
  await expect(card.getByTestId("removal-summary")).toContainText("1 del archivo no están en esta campaña: NO-EXISTE-9");
  await card.getByLabel(/Motivo/).fill("Ya formalizado");
  await card.getByLabel("Escriba ELIMINAR para confirmar").fill("ELIMINAR");
  await card.getByRole("button", { name: "Eliminar 1 RUT" }).click();
  await expect(page.getByTestId("notices").getByText("1 RUT eliminados de la campaña.")).toBeVisible();

  // What stays: the «Eliminadas» list with the reason, and the log
  await page.goto(`${campaignUrl}/companies`);
  await page.getByRole("link", { name: "Eliminadas (2)" }).click();
  const removed = page.getByTestId("removed-table");
  await expect(removed).toContainText("TA-DEMO-0002");
  await expect(removed).toContainText("Fuera de alcance (prueba)");
  await expect(removed).toContainText("Ya formalizado");
  await page.goto("/logs?action=tasks.removed");
  await expect(page.locator("td", { hasText: "RUT eliminados de la campaña" }).first()).toBeVisible();

  // Supervisors don't get the option
  await signIn(page, "agente1", "Agente-Clave-1");
  await page.goto(`${campaignUrl}/companies`);
  await expect(page.getByRole("button", { name: "Eliminar de la campaña…" })).toHaveCount(0);
  await page.goto(`${campaignUrl}/status`);
  await expect(page.getByTestId("remove-from-file")).toHaveCount(0);
});

test("agent summary from statistics and follow-up; agents only see their own", async ({ page }) => {
  await signIn(page, "admin", NEW_PW);

  // A new agent, to check that agents only open their own summary
  await page.goto("/users");
  await page.getByRole("button", { name: "Nuevo usuario" }).click();
  const newUser = page.getByRole("dialog", { name: "Nuevo usuario" });
  await newUser.locator("input[name=username]").fill("agente2");
  await newUser.locator("input[name=name]").fill("Bruno Agente");
  await newUser.locator("select[name=role]").selectOption("agent");
  await newUser.getByRole("button", { name: "Crear" }).click();
  await expect(newUser.getByText("agente2 / agente2123")).toBeVisible();

  // «Estadísticas globales» → «Por agente»: the name opens the summary, with the calls and each call's detail
  await page.goto("/stats");
  await page.getByRole("link", { name: "Ana Agente" }).first().click();
  await expect(page).toHaveURL(/\/agents\/\d+$/);
  await expect(page.getByRole("heading", { name: "Ana Agente", exact: true })).toBeVisible();
  await expect(page.getByTestId("agent-kpis")).toContainText("Tareas asignadas");
  await expect(page.getByText("Llamadas realizadas por Ana Agente")).toBeVisible();
  await page.locator("#calls table a").first().click();
  await expect(page).toHaveURL(/\/reviews\/\d+$/);

  // «Seguimiento»: the summary opens for that campaign, with a way to see all campaigns
  await page.goto("/campaigns");
  await page.locator("a.card", { has: page.getByRole("heading", { name: "Campaña de prueba", exact: true }) }).click();
  await expect(page).toHaveURL(/\/campaigns\/\d+$/);
  await page.goto(page.url() + "/followup");
  await page.getByRole("link", { name: "Ana Agente" }).first().click();
  await expect(page).toHaveURL(/\/agents\/\d+\?campaign=\d+$/);
  await expect(page.getByText("Campaña: Campaña de prueba")).toBeVisible();
  await page.getByRole("link", { name: "ver todas las campañas" }).click();
  await expect(page.getByText("Todas las campañas")).toBeVisible();
  const anaUrl = page.url();

  // «Generar informe» from the summary: the panel opens with Ana chosen; one agent = one PDF
  await page.getByRole("button", { name: "Generar informe" }).click();
  const panel = page.getByRole("dialog");
  await expect(panel.getByTestId("report-agents").getByLabel("Ana Agente")).toBeChecked();
  const pdfHref = await panel.getByRole("link", { name: "Descargar PDF" }).getAttribute("href");
  const pdf = await page.request.get(pdfHref!);
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  await page.keyboard.press("Escape");

  // «Informes»: two agents → one .zip with a report each, and each one kept in the list
  await page.goto("/reports");
  await page.getByRole("button", { name: "Generar informe" }).click();
  const builder = page.getByRole("dialog");
  await builder.getByRole("button", { name: "Elegir agentes (un informe por agente)" }).click();
  await builder.getByTestId("report-agents").getByLabel("Ana Agente").check();
  await builder.getByTestId("report-agents").getByLabel("Bruno Agente").check();
  const zipHref = await builder.getByRole("link", { name: "Descargar 2 informes (.zip)" }).getAttribute("href");
  const zip = await page.request.get(zipHref!);
  expect(zip.headers()["content-type"]).toBe("application/zip");
  expect((await zip.body()).subarray(0, 2).toString()).toBe("PK");
  await page.goto("/reports");
  await expect(page.getByText("– Bruno Agente").first()).toBeVisible();

  // An agent: «Mi resumen» opens their own; anyone else's answers "not found"
  await signIn(page, "agente2", "agente2123");
  await changeFirstPassword(page, "agente2123", "Bruno-Clave-1");
  await page.goto("/calls");
  await page.getByRole("link", { name: "Mi resumen" }).click();
  await expect(page.getByRole("heading", { name: "Bruno Agente", exact: true })).toBeVisible();
  await page.goto(anaUrl);
  await expect(page.getByRole("heading", { name: "No encontrado" })).toBeVisible();
});

test("easier screens: folding menu, multi-choice filters, bar for ticked rows, phone menu", async ({ page }) => {
  await signIn(page, "admin", NEW_PW);

  // The side menu folds to icons and stays folded on the next page
  await page.goto("/campaigns");
  const aside = page.locator("aside");
  await page.getByRole("button", { name: "Plegar menú" }).click();
  await expect(aside).toHaveAttribute("data-folded", "1");
  await page.reload();
  await expect(aside).toHaveAttribute("data-folded", "1");
  await expect(aside.getByRole("link", { name: "Campañas", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Desplegar menú" }).click();
  await expect(aside).toHaveAttribute("data-folded", "0");

  // «Tareas y asignación»: several choices in one filter, each shown as a removable label
  await page.locator("a.card", { has: page.getByRole("heading", { name: "Campaña de prueba", exact: true }) }).click();
  await expect(page).toHaveURL(/\/campaigns\/\d+$/);
  const tasksUrl = page.url() + "/companies";
  await page.goto(tasksUrl);
  const all = await page.locator("tbody input[name=ids]").count();
  await page.locator("#f-agent").click();
  await page.getByRole("checkbox", { name: "Sin asignar" }).check();
  await page.getByRole("checkbox", { name: "Ana Agente" }).check();
  await page.getByRole("button", { name: "Listo" }).click();
  await expect(page.locator("#f-agent")).toHaveText("Sin asignar, Ana Agente");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page).toHaveURL(/agent=none%7C\d+/);
  const chips = page.getByTestId("filter-chips");
  await expect(chips).toContainText("Asignado a: Sin asignar");
  await expect(chips).toContainText("Asignado a: Ana Agente");
  await expect(page.locator("tbody input[name=ids]")).toHaveCount(all);
  await chips.getByRole("link", { name: "Quitar Ana Agente" }).click();
  await expect(page).toHaveURL(/agent=none(&|$)/);
  await chips.getByRole("link", { name: "Quitar todos" }).click();
  await expect(page.getByTestId("filter-chips")).toHaveCount(0);

  // The bar appears only while rows are ticked
  await expect(page.getByTestId("bulk-count")).toBeHidden();
  await page.locator("tbody input[name=ids]").nth(0).check();
  await expect(page.getByTestId("bulk-count")).toHaveText("1 marcadas");
  await page.getByRole("button", { name: "Desmarcar todas" }).click();
  await expect(page.getByTestId("bulk-count")).toBeHidden();

  // «?» explains an indicator without leaving the page
  await page.goto("/stats");
  await page.getByTestId("hint").first().click();
  await expect(page.getByRole("tooltip")).toContainText("Meta");
  await expect(page).toHaveURL(/\/stats/);

  // Phones: the menu opens from ☰ and closes after choosing a page
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/stats");
  await page.getByRole("button", { name: "Abrir menú" }).click();
  const drawer = page.getByRole("dialog", { name: "Abrir menú" });
  await drawer.getByRole("link", { name: "Informes" }).click();
  await expect(page).toHaveURL(/\/reports$/);
  await expect(drawer).toHaveCount(0);
});
