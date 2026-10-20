import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "exceljs";
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
  for (const [username, name, role] of [["agente1", "Ana Agente", "agent"], ["inspector1", "Iván Inspector", "inspector"]]) {
    await page.locator("input[name=username]").first().fill(username);
    await page.locator("input[name=name]").first().fill(name);
    await page.locator("select[name=role]").first().selectOption(role);
    await page.getByRole("button", { name: "Crear" }).click();
    await expect(page.getByText(`${username} / ${username}123`)).toBeVisible();
  }

  // Create a campaign and upload the Matriz
  await page.goto("/campaigns");
  await page.fill("input[name=name]", "Campaña de prueba");
  await page.fill("input[name=startDate]", "2026-01-01");
  await page.fill("input[name=endDate]", "2030-12-31");
  await page.getByRole("button", { name: "Crear" }).click();
  await expect(page).toHaveURL(/\/campaigns\/\d+\/import/);
  const campaignUrl = page.url().replace("/import", "");
  await page.setInputFiles("input[type=file]", FIXTURE);
  await page.getByRole("button", { name: /Confirmar carga/ }).click();
  await expect(page.getByText(/Carga completada: 4 insertados/)).toBeVisible();

  // Assign every task to the agent
  await page.goto(campaignUrl + "/companies");
  await page.getByRole("button", { name: "Asignar" }).click();
  await expect(page.getByText("4 tareas asignadas")).toBeVisible();

  // Agent: sees the assigned calls
  await signIn(page, "agente1", "agente1123");
  await changeFirstPassword(page, "agente1123", "Agente-Clave-1");
  await expect(page).toHaveURL(/\/calls/);
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

  // Agent cannot open the administration screens
  await signIn(page, "agente1", "Agente-Clave-1");
  const forbidden = await page.goto(campaignUrl);
  expect(page.url()).not.toContain("/campaigns/");
  void forbidden;

  // Administrator: dashboard and export
  await signIn(page, "admin", NEW_PW);
  await page.goto(campaignUrl);
  await expect(page.getByText("Llamados al menos 1 vez")).toBeVisible();
  await page.goto(campaignUrl + "/export");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: /Descargar/ }).first().click()]);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile((await download.path())!);
  const sheet = wb.getWorksheet("Matriz de seguimiento")!;
  const names = sheet.getColumn(5).values.map(String);
  expect(names).toContain("Buceo Uno");
  const results = sheet.getColumn(31).values.map(String); // "Llamada 1 resultado"
  expect(results).toContain("En operación – iniciará solicitud (compromiso)");
});
