import { test, expect } from "@playwright/test";

test("landing page renders", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading").first()).toBeVisible();
});

test("protected publisher routes require auth", async ({ page }) => {
  await page.goto("/publisher/websites", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/auth/, { timeout: 20_000 });
  expect(new URL(page.url()).pathname).toContain("/auth");
});
