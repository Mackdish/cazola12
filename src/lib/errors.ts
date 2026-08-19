/**
 * Maps raw backend / network errors to safe, user-facing messages.
 * Raw database errors are logged but never surfaced verbatim.
 */

export type FriendlyError = {
  title: string;
  message: string;
  code?: string | undefined;
};

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: "That email and password combination doesn't match our records.",
  email_not_confirmed: "Please confirm your email address before signing in.",
  user_already_exists: "An account with this email already exists. Try signing in instead.",
  email_exists: "An account with this email already exists. Try signing in instead.",
  weak_password: "Please choose a stronger password (at least 8 characters).",
  over_email_send_rate_limit: "Too many emails requested. Please wait a minute and try again.",
  over_request_rate_limit: "Too many attempts. Please wait a moment and try again.",
  same_password: "Your new password must be different from the current one.",
  session_expired: "Your session expired. Please sign in again.",
  validation_failed: "Please check the information you entered and try again.",
};

const POSTGRES_MESSAGES: Record<string, string> = {
  "23505": "That value is already taken. Please choose another.",
  "23503": "A related record is missing, so this action can't be completed.",
  "23502": "Some required information is missing.",
  "23514": "Some of the submitted values aren't allowed.",
  "42501": "You don't have permission to perform this action.",
  PGRST301: "Your session expired. Please sign in again.",
};

const SERVICE_MESSAGES: Record<string, string> = {
  "Complete your advertiser profile before continuing":
    "Please complete your advertiser profile first.",
  "This organization isn't an advertiser organization":
    "This organization is not set up as an advertiser.",
  "You don't have permission to manage this organization":
    "You don't have permission to manage this organization.",
};

function messageOf(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return "";
}

function codeOf(error: unknown): string | undefined {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.length > 0) return code;
  }
  return undefined;
}

export function toFriendlyError(
  error: unknown,
  fallbackTitle = "Something went wrong",
): FriendlyError {
  // Always keep the technical detail in the console for debugging.
  if (error) console.error("[handled error]", error);

  const code = codeOf(error);
  const raw = messageOf(error);

  if (code && AUTH_MESSAGES[code]) {
    return { title: "Authentication failed", message: AUTH_MESSAGES[code], code };
  }
  if (code && POSTGRES_MESSAGES[code]) {
    return { title: fallbackTitle, message: POSTGRES_MESSAGES[code]!, code };
  }
  const normalized = raw.trim().replace(/[.!]+$/, "");
  if (normalized && SERVICE_MESSAGES[normalized]) {
    return { title: fallbackTitle, message: SERVICE_MESSAGES[normalized]!, code };
  }

  if (raw === "not_authenticated") {
    return { title: "Session expired", message: AUTH_MESSAGES["session_expired"]!, code };
  }
  if (raw === "forbidden") {
    return {
      title: "Not allowed",
      message: "You don't have permission to perform this action.",
      code,
    };
  }
  if (raw === "invalid_input") {
    return {
      title: fallbackTitle,
      message: "Please check the information you entered and try again.",
      code,
    };
  }
  if (/failed to fetch|networkerror|load failed/i.test(raw)) {
    return {
      title: "Connection problem",
      message: "We couldn't reach the network. Check your connection and try again.",
      code,
    };
  }
  if (/invalid login credentials/i.test(raw)) {
    return { title: "Authentication failed", message: AUTH_MESSAGES["invalid_credentials"]!, code };
  }
  if (/email not confirmed/i.test(raw)) {
    return { title: "Authentication failed", message: AUTH_MESSAGES["email_not_confirmed"]!, code };
  }
  if (/already registered|already exists/i.test(raw)) {
    return { title: "Authentication failed", message: AUTH_MESSAGES["user_already_exists"]!, code };
  }
  if (/jwt|token|session/i.test(raw)) {
    return { title: "Session expired", message: AUTH_MESSAGES["session_expired"]!, code };
  }

  // Messages our own services author are already user-safe: surface them as-is
  // instead of hiding a helpful hint behind the generic fallback.
  const looksUserFacing =
    raw.length > 0 &&
    raw.length <= 200 &&
    !/\n|\bat \b|select |insert |update |delete |relation |column |constraint |0x|undefined is not/i.test(
      raw,
    ) &&
    /^[A-Z]/.test(raw.trim());
  if (looksUserFacing) {
    return { title: fallbackTitle, message: raw.trim(), code };
  }

  return {
    title: fallbackTitle,
    message:
      "We hit an unexpected problem. Please try again — if it keeps happening, contact support.",
    code,
  };
}

