import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { jsonResponse, serverError } from "@/lib/api-response";
import { publicPreflight } from "@/lib/api-v1.server";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email address").max(254),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  message: z.string().trim().min(1, "Message is required").max(5000),
});

async function sendContactEmail(data: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) {
    console.error("[contact] RESEND_API_KEY is not configured");
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: "TradeMall Contact <no-reply@trademall.co.ke>",
      to: ["support@trademall.co.ke"],
      reply_to: data.email,
      subject: `Contact Form: ${data.subject}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${data.name}</p>
        <p><strong>Email:</strong> ${data.email}</p>
        <p><strong>Subject:</strong> ${data.subject}</p>
        <p><strong>Message:</strong></p>
        <p>${data.message.replace(/\n/g, "<br>")}</p>
      `,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[contact] Resend API error ${response.status}: ${text}`);
  }
}

export const Route = createFileRoute("/api/v1/contact")({
  server: {
    handlers: {
      OPTIONS: async () => publicPreflight("POST, OPTIONS"),

      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const parsed = contactSchema.safeParse(body);
          if (!parsed.success) {
            return jsonResponse(
              { ok: false as const, error: "validation_error", message: "Request validation failed", details: parsed.error.flatten().fieldErrors },
              400,
            );
          }

          const { name, email, subject, message } = parsed.data;

          const { error: dbError } = await supabaseAdmin
            .from("contact_submissions")
            .insert({ name, email, subject, message });

          if (dbError) {
            console.error("[contact] database error:", dbError.message);
            return serverError("We couldn't save your message. Please try again.");
          }

          sendContactEmail({ name, email, subject, message }).catch((emailError) => {
            console.error("[contact] email delivery failed:", emailError);
          });

          return jsonResponse({ ok: true as const, message: "Your message has been sent. We'll get back to you within 24 hours." });
        } catch {
          return serverError("Something went wrong. Please try again later.");
        }
      },
    },
  },
});
