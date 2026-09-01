import { test, expect } from "@playwright/test";
import { credsFromEnv, signIn } from "./helpers/auth";

const creds = credsFromEnv("ADMIN");

test.describe("admin review tools", () => {
  test.skip(!creds, "Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD to run this flow.");

  test("admin can open the supply review tables", async ({ page }) => {
    await signIn(page, creds!);

    for (const path of ["/admin/publishers", "/admin/websites", "/admin/ad-zones"]) {
      await page.goto(path);
      await expect(page.getByRole("heading").first()).toBeVisible();
    }
  });

  test("admin can approve a pending publisher", async ({ page }) => {
    await signIn(page, creds!);
    await page.goto("/admin/publishers");

    const reviewButton = page.getByRole("button", { name: /review|approve/i }).first();
    test.skip((await reviewButton.count()) === 0, "No publishers awaiting review.");

    await reviewButton.click();
    await page.getByRole("button", { name: /^approve$/i }).last().click();
    await expect(page.getByText(/approved/i).first()).toBeVisible();
  });
});
