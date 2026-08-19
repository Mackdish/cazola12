import { test, expect } from "@playwright/test";
import { credsFromEnv, signIn } from "./helpers/auth";

const creds = credsFromEnv("PUBLISHER");

test.describe("publisher supply flow", () => {
  test.skip(!creds, "Set E2E_PUBLISHER_EMAIL / E2E_PUBLISHER_PASSWORD to run this flow.");

  test("add a website, open detail, add an ad zone and see embed code", async ({ page }) => {
    await signIn(page, creds!);

    const domain = `e2e-${Date.now()}.example.com`;

    await page.goto("/publisher/websites");
    await page.getByRole("button", { name: /add website/i }).first().click();
    await page.getByLabel(/name/i).first().fill("E2E Test Site");
    await page.getByLabel(/domain|url/i).first().fill(domain);
    await page.getByRole("button", { name: /save|add|create/i }).last().click();

    const row = page.getByText(domain).first();
    await expect(row).toBeVisible();
    await row.click();

    // Verification copy is present on the detail page.
    await expect(page.getByText(/verif/i).first()).toBeVisible();

    await page.getByRole("tab", { name: /ad zones/i }).click();
    await page.getByRole("button", { name: /add ad zone|new ad zone/i }).first().click();
    await page.getByLabel(/name/i).first().fill("E2E Zone");
    await page.getByRole("button", { name: /save|add|create/i }).last().click();

    await expect(page.getByText("E2E Zone").first()).toBeVisible();
    await expect(page.getByText(/admesh/i).first()).toBeVisible();
  });

  test("publisher cannot reach admin routes", async ({ page }) => {
    await signIn(page, creds!);
    await page.goto("/admin/publishers");
    await expect(page.getByText(/not authorized|no access|forbidden|permission/i).first()).toBeVisible();
  });
});
