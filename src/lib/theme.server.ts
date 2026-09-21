import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

const THEME_COOKIE_NAME = "theme";
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

function getCookieValue(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader.split(";").map((c) => c.trim().split("=")[0]);
  const idx = cookies.indexOf(name);
  if (idx === -1) return null;
  const value = cookieHeader.split(";")[idx].split("=").slice(1).join("=");
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export const getTheme = createServerFn({ method: "GET" }).handler(() => {
  const request = getRequest();
  const cookie = request.headers.get("cookie");
  if (!cookie) return "dark";
  const value = getCookieValue(cookie, THEME_COOKIE_NAME);
  if (value === "light" || value === "dark" || value === "system") return value;
  return "dark";
});

export function setThemeCookie(theme: string): void {
  document.cookie = `${THEME_COOKIE_NAME}=${theme}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function getThemeCookie(): string {
  if (typeof document === "undefined") return "dark";
  const cookie = document.cookie;
  if (!cookie) return "dark";
  const value = getCookieValue(cookie, THEME_COOKIE_NAME);
  if (value === "light" || value === "dark" || value === "system") return value;
  return "dark";
}
