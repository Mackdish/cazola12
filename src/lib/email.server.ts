import { Resend } from "resend";

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = readEnv("RESEND_API_KEY");
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is not configured.");
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export function isEmailConfigured(): boolean {
  return Boolean(readEnv("RESEND_API_KEY"));
}

export async function sendWebsiteApprovedEmail(input: {
  to: string;
  publisherName: string;
  websiteName: string;
  domain: string;
}): Promise<void> {
  const client = getResendClient();
  const origin = readEnv("APP_BASE_URL") ?? "https://trademall.co.ke";
  const dashboardUrl = `${origin}/publisher/websites`;

  const subject = `Your website has been approved — TradeMall`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333;">
      <h2 style="color: #1a1a1a;">Your website has been approved</h2>
      <p>Hi ${escapeHtml(input.publisherName)},</p>
      <p>Your website has been approved on TradeMall.</p>
      <div style="background: #f5f5f5; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0 0 8px;"><strong>Website:</strong> ${escapeHtml(input.websiteName)}</p>
        <p style="margin: 0;"><strong>Domain:</strong> ${escapeHtml(input.domain)}</p>
      </div>
      <p>You can now set up ad zones and start earning. Visit your publisher dashboard to get started:</p>
      <p><a href="${escapeHtml(dashboardUrl)}" style="color: #2563eb; text-decoration: none; font-weight: 500;">Open Publisher Dashboard</a></p>
      <p style="color: #666; font-size: 14px;">If you have any questions, reply to this email or contact our support team.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
      <p style="color: #999; font-size: 12px;">— The TradeMall Team</p>
    </div>
  `;

  try {
    await client.emails.send({
      from: "TradeMall <no-reply@trademall.co.ke>",
      to: [input.to],
      subject,
      html,
    });
  } catch (error) {
    console.error("[email] sendWebsiteApprovedEmail failed", {
      to: input.to,
      domain: input.domain,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
