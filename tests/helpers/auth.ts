import type { Page } from "@playwright/test";

export type Creds = { email: string; password: string };

export function credsFromEnv(prefix: "PUBLISHER" | "ADMIN"): Creds | null {
  const email = process.env[`E2E_${prefix}_EMAIL`];
  const password = process.env[`E2E_${prefix}_PASSWORD`];
  if (!email || !password) return null;
  return { email, password };
}

/** Signs in through the app's /auth screen and waits for the app shell. */
export async function signIn(page: Page, creds: Creds) {
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/email/i).first().fill(creds.email);
  await page.getByLabel(/password/i).first().fill(creds.password);
  await page.getByRole("button", { name: /sign in|log in/i }).first().click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 30_000 });
}
