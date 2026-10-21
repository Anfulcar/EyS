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
  await expect(panel.getByText("4 tareas asignadas")).toBeVisible();
  await page.keyboard.press("Escape");

  // Ticked rows can be assigned together (here: back to the same agent)
  await page.locator("tbody input[name=ids]").nth(0).check();
  await page.locator("tbody input[name=ids]").nth(1).check();
  await page.locator("#bulk-assign select[name=userId]").selectOption({ label: "Ana Agente" });
  await page.locator("#bulk-assign").getByRole("button", { name: "Aplicar" }).click();
  await expect(page.getByText("2 tareas asignadas")).toBeVisible();

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

  // Administrator: the campaign's "Resumen" tab with the indicators and the legend
  await page.goto(campaignUrl + "/summary");
  await expect(page.locator("tr", { hasText: "Establecimientos a intervenir" }).locator("td").last()).toHaveText("4");
  await expect(page.getByText("Se registra la fecha de compromiso", { exact: false })).toBeVisible();

  // Administrator: edits the call script (agents see it in each task)
  await page.goto(campaignUrl + "/settings");
  await page.fill("#script-es", "Buenos días, le llamamos del Ministerio de Turismo (guion de prueba).");
  await page.locator("form", { has: page.locator("#script-es") }).getByRole("button", { name: "Guardar" }).click();
  await expect(page.locator("form", { has: page.locator("#script-es") }).getByText("Guardado")).toBeVisible();

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
  await expect(cover.getByText(/tareas cubiertas/)).toBeVisible();
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
  for (const what of ["Llamada registrada", "Llamada revisada", "Ausencia registrada", "Tareas cubiertas durante una ausencia", "Guion de llamada editado", "Visita registrada", "Usuario creado", "Carga de establecimientos", "Asignación de tareas", "Descarga de datos"]) {
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
