/**
 * Consistent API response helpers for v1 endpoints.
 */

export type ApiErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "validation_error"
  | "server_error"
  | "service_unavailable";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: ApiErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonResponse<T>(
  body: T,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

export function apiErrorResponse(error: ApiError): Response {
  return jsonResponse(
    {
      ok: false as const,
      error: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
    error.statusCode,
  );
}

export function validationError(details: Record<string, unknown>): Response {
  return apiErrorResponse(
    new ApiError(400, "validation_error", "Request validation failed", details),
  );
}

export function unauthorizedError(message = "Unauthorized"): Response {
  return apiErrorResponse(new ApiError(401, "unauthorized", message));
}

export function forbiddenError(message = "Forbidden"): Response {
  return apiErrorResponse(new ApiError(403, "forbidden", message));
}

export function notFoundError(message = "Resource not found"): Response {
  return apiErrorResponse(new ApiError(404, "not_found", message));
}

export function rateLimitedError(retryAfter = 60): Response {
  return apiErrorResponse(
    new ApiError(429, "rate_limited", "Too many requests", { retry_after: retryAfter }),
  );
}

export function serverError(message = "Internal server error"): Response {
  return apiErrorResponse(new ApiError(500, "server_error", message));
}
