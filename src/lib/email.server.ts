import { enqueueEmail } from "@/lib/email-delivery.server";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendWebsiteApprovedEmail(input: {
  to: string; publisherName: string; websiteName: string; domain: string;
}): Promise<void> {
  await enqueueEmail({
    to: input.to, templateSlug: "publisher-website-approved", category: "transactional",
    idempotencyKey: `website-approved:${input.domain.toLowerCase()}`,
    payload: {
      publisherName: input.publisherName, websiteName: input.websiteName, domain: input.domain,
      dashboardUrl: `${process.env.APP_BASE_URL ?? "https://trademall.co.ke"}/publisher/websites`,
    },
  });
}

export async function sendWebsiteRejectedEmail(input: {
  to: string; publisherName: string; websiteName: string; domain: string;
  reason: string | null; websiteId: string;
}): Promise<void> {
  await enqueueEmail({
    to: input.to, templateSlug: "publisher-website-rejected", category: "transactional",
    idempotencyKey: `website-rejected:${input.websiteId}`,
    payload: {
      publisherName: input.publisherName, websiteName: input.websiteName, domain: input.domain,
      reason: input.reason || "No specific feedback was provided. Please review our publisher guidelines and try again.",
      dashboardUrl: `${process.env.APP_BASE_URL ?? "https://trademall.co.ke"}/publisher/websites/${input.websiteId}`,
    },
  });
}
