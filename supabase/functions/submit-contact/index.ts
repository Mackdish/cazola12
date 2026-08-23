import { z } from "npm:zod";

const ALLOWED_ORIGINS = [
  "https://trademall.co.ke",
  "https://www.trademall.co.ke",
  "http://localhost:3000",
  "http://localhost:5173",
];

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("Origin");
  const allowOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "https://trademall.co.ke";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
    "Access-Control-Max-Age": "86400",
  } as const;
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
// NOTE: This in-memory rate limiter resets on cold start.
// Back this with a Supabase table for persistent production protection.

const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Enter a valid email address").max(254),
  subject: z.string().min(1, "Subject is required").max(200),
  message: z.string().min(1, "Message is required").max(5000),
  website: z.string().max(0, "Honeypot must be empty").optional(),
});

function sanitizeForEmail(value: string): string {
  return value.replace(/[\r\n]+/g, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function jsonResponse(body: unknown, status = 200, request?: Request): Response {
  const headers = request ? corsHeaders(request) : corsHeaders(new Request("http://localhost"));
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
  });
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  entry.count += 1;
  return entry.count <= 5;
}

Deno.serve(async (request: Request) => {
  const headers = corsHeaders(request);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers,
    });
  }

  if (request.method !== "POST") {
    return jsonResponse({ ok: false as const, error: "Method not allowed" }, 405, request);
  }

  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    if (!checkRateLimit(ip)) {
      return jsonResponse(
        { ok: false as const, error: "Too many submissions. Please try again later." },
        429,
        request,
      );
    }

    const body = await request.json();
    const parsed = contactSchema.safeParse(body);

    if (!parsed.success) {
      return jsonResponse(
        {
          ok: false as const,
          error: "validation_error",
          message: "Request validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        400,
        request,
      );
    }

    const { name, email, subject, message } = parsed.data;

    const sanitizedName = sanitizeForEmail(name);
    const sanitizedEmail = sanitizeForEmail(email);
    const sanitizedSubject = sanitizeForEmail(subject);

    const escapedName = escapeHtml(name);
    const escapedEmail = escapeHtml(email);
    const escapedSubject = escapeHtml(subject);
    const escapedMessage = escapeHtml(message);

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      console.error("[contact] RESEND_API_KEY is not configured");
      return jsonResponse(
        { ok: false as const, error: "Server configuration error" },
        500,
        request,
      );
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "TradeMall Contact <no-reply@trademall.co.ke>",
        to: ["support@trademall.co.ke"],
        reply_to: sanitizedEmail,
        subject: `Contact Form: ${sanitizedSubject}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${escapedName}</p>
          <p><strong>Email:</strong> ${escapedEmail}</p>
          <p><strong>Subject:</strong> ${escapedSubject}</p>
          <p><strong>Message:</strong></p>
          <p>${escapedMessage.replace(/\n/g, "<br>")}</p>
        `,
      }),
    });

    if (!resendResponse.ok) {
      const text = await resendResponse.text();
      console.error(`[contact] Resend API error ${resendResponse.status}: ${text}`);
      return jsonResponse(
        { ok: false as const, error: "Failed to send email. Please try again later." },
        502,
        request,
      );
    }

    return jsonResponse({
      ok: true as const,
      message: "Your message has been sent. We'll get back to you within 24 hours.",
    }, 200, request);
  } catch (err) {
    console.error("[contact] unexpected error:", err);
    return jsonResponse(
      { ok: false as const, error: "Something went wrong. Please try again later." },
      500,
      request,
    );
  }
});
