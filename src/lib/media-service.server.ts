/**
 * Provider-agnostic media service.
 *
 * Every creative goes through here: components never touch storage URLs or
 * bucket names directly. Swapping providers later means adding a branch in
 * this module, not editing UI code.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  creativeStoragePath,
  isAllowedCreativeMime,
  maxBytesForMime,
  organizationFromStoragePath,
  sanitizeFilename,
  validateCreativeFile,
} from "@/lib/advertiser-domain";
import { readImageMetadata } from "@/lib/image-metadata";
import { getR2Bucket } from "@/lib/runtime-bindings.server";
import { readEnv } from "@/lib/runtime-env.server";

type Client = SupabaseClient<Database>;
export type Ctx = { supabase: Client; userId: string };

export const CREATIVE_BUCKET = "ad-creatives";
export const R2_BUCKET_NAME = "trademall";
const SIGNED_URL_TTL_SECONDS = 60 * 10;

export class MediaError extends Error {}

/** Verifies the signed-in user belongs to the organization (trusted lookup). */
async function assertOrgMember(ctx: Ctx, organizationId: string) {
  const db = await admin();
  const { data, error } = await db
    .from("organization_members")
    .select("id, status")
    .eq("organization_id", organizationId)
    .eq("user_id", ctx.userId)
    .maybeSingle();
  if (error) fail("We couldn't verify your organization access.");
  if (!data || data.status !== "active")
    fail("You don't have permission to manage this organization.");
}

function fail(message: string): never {
  throw new MediaError(message);
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Client;
}

/** Where the client should upload to, together with everything it may not choose itself. */
export function plannedUploadTarget(input: {
  organizationId: string;
  advertiserId: string;
  assetId: string;
  mimeType: string;
}) {
  return {
    provider: "supabase" as const,
    bucket: CREATIVE_BUCKET,
    path: creativeStoragePath(input),
  };
}

/**
 * Signed upload token for the planned path.
 *
 * Issued server-side with the service client, so the browser never needs
 * storage write policies and can only write to the exact path we chose.
 */
export async function signedUploadTarget(input: {
  organizationId: string;
  advertiserId: string;
  assetId: string;
  mimeType: string;
}) {
  const target = plannedUploadTarget(input);
  const service = await admin();
  const signed = await service.storage.from(target.bucket).createSignedUploadUrl(target.path);
  if (signed.error || !signed.data)
    fail("We couldn't prepare that upload. Please try again in a moment.");
  return { ...target, token: signed.data.token };
}


/**
 * Registers an already-uploaded object as a media asset.
 *
 * The uploaded bytes are re-read server-side, so the recorded mime type, size
 * and dimensions come from the file itself and never from the client.
 */
export async function registerUploadedCreative(
  ctx: Ctx,
  input: {
    organizationId: string;
    advertiserId: string;
    campaignId?: string | null | undefined;
    adId?: string | null | undefined;
    fileName: string;
    storagePath: string;
  },
) {
  const owner = organizationFromStoragePath(input.storagePath);
  if (!owner || owner !== input.organizationId)
    fail("That upload path doesn't belong to your organization.");

  const service = await admin();
  const download = await service.storage.from(CREATIVE_BUCKET).download(input.storagePath);
  if (download.error || !download.data) fail("We couldn't read that upload. Please try again.");

  const bytes = new Uint8Array(await download.data.arrayBuffer());
  const meta = readImageMetadata(bytes);
  if (!meta) {
    await service.storage.from(CREATIVE_BUCKET).remove([input.storagePath]);
    fail("That file isn't a valid PNG, JPG, WebP or GIF image.");
  }
  if (!isAllowedCreativeMime(meta.mimeType) || bytes.byteLength > maxBytesForMime(meta.mimeType)) {
    await service.storage.from(CREATIVE_BUCKET).remove([input.storagePath]);
    const check = validateCreativeFile({ mimeType: meta.mimeType, fileSize: bytes.byteLength });
    fail(check.ok ? "That creative isn't allowed." : check.message);
  }

  const checksum = await sha256Hex(bytes);

  await assertOrgMember(ctx, input.organizationId);

  const { data, error } = await service
    .from("media_assets")
    .insert({
      organization_id: input.organizationId,
      advertiser_id: input.advertiserId,
      campaign_id: input.campaignId ?? null,
      ad_id: input.adId ?? null,
      file_name: sanitizeFilename(input.fileName),
      storage_provider: "supabase",
      bucket: CREATIVE_BUCKET,
      storage_path: input.storagePath,
      mime_type: meta.mimeType,
      file_size: bytes.byteLength,
      width: meta.width,
      height: meta.height,
      checksum,
      status: "ready",
    })
    .select("*")
    .single();

  if (error) {
    await service.storage.from(CREATIVE_BUCKET).remove([input.storagePath]);
    if (error.code === "42501") fail("You don't have permission to upload creatives here.");
    fail("We couldn't save that creative. Please try again.");
  }
  return data!;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Short-lived signed URL for a creative the caller's organization owns. */
export async function signedCreativeUrl(ctx: Ctx, assetId: string) {
  const service = await admin();
  const { data: asset, error } = await service
    .from("media_assets")
    .select("id, organization_id, bucket, storage_path, storage_provider, status")
    .eq("id", assetId)
    .maybeSingle();
  if (error) fail("We couldn't load that creative.");
  if (!asset) fail("That creative doesn't exist, or you don't have access to it.");
  await assertOrgMember(ctx, asset.organization_id);

  if (asset.storage_provider === "supabase") {
    const signed = await service.storage
      .from(asset.bucket)
      .createSignedUrl(asset.storage_path, SIGNED_URL_TTL_SECONDS);
    if (signed.error || !signed.data) fail("We couldn't prepare that creative for preview.");
    return { url: signed.data.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS };
  }

  return { url: asset.storage_path, expiresIn: SIGNED_URL_TTL_SECONDS };
}

export async function listMediaAssets(ctx: Ctx, organizationId: string) {
  await assertOrgMember(ctx, organizationId);
  const db = await admin();
  const { data, error } = await db
    .from("media_assets")
    .select("*")
    .eq("organization_id", organizationId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });
  if (error) fail("We couldn't load your creatives.");
  return data ?? [];
}

export async function archiveMediaAsset(ctx: Ctx, assetId: string) {
  const db = await admin();
  const { data: existing } = await db
    .from("media_assets")
    .select("id, organization_id")
    .eq("id", assetId)
    .maybeSingle();
  if (!existing) fail("That creative doesn't exist, or you don't have access to it.");
  await assertOrgMember(ctx, existing.organization_id);

  const { data, error } = await db
    .from("media_assets")
    .update({ status: "archived" })
    .eq("id", assetId)
    .select("*")
    .maybeSingle();
  if (error) fail("We couldn't archive that creative.");
  if (!data) fail("That creative doesn't exist, or you don't have access to it.");
  return data;
}

export async function uploadCreativeToR2(
  ctx: Ctx,
  input: {
    organizationId: string;
    advertiserId: string;
    campaignId?: string | null;
    file: File;
  },
) {
  await assertOrgMember(ctx, input.organizationId);

  const initialCheck = validateCreativeFile({
    mimeType: input.file.type,
    fileSize: input.file.size,
  });
  if (!initialCheck.ok) fail(initialCheck.message);

  const bytes = new Uint8Array(await input.file.arrayBuffer());
  const meta = readImageMetadata(bytes);
  if (!meta) fail("That file isn't a valid PNG, JPG, WebP or GIF image.");
  if (
    !isAllowedCreativeMime(meta.mimeType) ||
    bytes.byteLength > maxBytesForMime(meta.mimeType)
  ) {
    const check = validateCreativeFile({
      mimeType: meta.mimeType,
      fileSize: bytes.byteLength,
    });
    fail(check.ok ? "That creative isn't allowed." : check.message);
  }

  const bucket = await getR2Bucket();
  if (!bucket) fail("Storage isn't available right now. Please try again shortly.");

  const publicBase = readEnv("R2_PUBLIC_URL");
  if (!publicBase) fail("R2_PUBLIC_URL is not configured. Set it in your Cloudflare Worker environment variables.");

  const assetId = crypto.randomUUID();
  const path = creativeStoragePath({
    organizationId: input.organizationId,
    advertiserId: input.advertiserId,
    assetId,
    mimeType: meta.mimeType,
  });

  await bucket.put(path, bytes, { httpMetadata: { contentType: meta.mimeType } });

  const checksum = await sha256Hex(bytes);
  const publicUrl = `${publicBase}/${path}`;

  const db = await admin();
  const { data, error } = await db
    .from("media_assets")
    .insert({
      organization_id: input.organizationId,
      advertiser_id: input.advertiserId,
      campaign_id: input.campaignId ?? null,
      ad_id: null,
      file_name: sanitizeFilename(input.file.name),
      storage_provider: "cloudflare_r2",
      bucket: R2_BUCKET_NAME,
      storage_path: publicUrl,
      mime_type: meta.mimeType,
      file_size: bytes.byteLength,
      width: meta.width,
      height: meta.height,
      checksum,
      status: "ready",
    })
    .select("*")
    .single();

  if (error) {
    await bucket.delete(path).catch(() => {});
    fail("We couldn't save that creative. Please try again.");
  }
  return data!;
}

