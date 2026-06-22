import { test, expect } from "@playwright/test";

test("flujo principal local-first", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Abrir Hoy" }).click();
  await expect(page.getByText("Dormir +7 horas")).toBeVisible();
  await expect(page.getByText("Hacer la cama")).toBeVisible();
  await expect(page.getByText("Beber +3 litros de agua")).toBeVisible();
  await expect(page.getByText("Hacer deporte")).toBeVisible();

  await page.getByRole("button", { name: "Completar" }).first().click();
  await page.reload();
  await expect(page.getByText("Dormir +7 horas")).toBeVisible();

  await page.getByRole("button", { name: "Habitos" }).click();
  await page.getByRole("button", { name: "Crear" }).click();
  await page.getByLabel("Nombre").fill("Leer");
  await page.getByLabel("Tipo").selectOption("QUANTITY");
  await page.getByLabel("Objetivo").fill("10");
  await page.getByLabel("Unidad").fill("paginas");
  await page.getByRole("checkbox", { name: "M", exact: true }).uncheck();
  await page.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Leer")).toBeVisible();

  await page.getByRole("button", { name: "Calendario" }).click();
  await page.getByRole("button", { name: "90 dias" }).click();
  await page.getByRole("button", { name: "365 dias" }).click();
  await page.getByRole("button", { name: "Ajustes" }).click();
  await expect(page.getByText("Copias de seguridad")).toBeVisible();
});
