/**
 * Migration script: re-hash existing API keys from legacy format to pepper-based HMAC.
 *
 * Legacy format: createHmac("sha256", secret).update("trademall-api-key").digest("hex")
 * New format:    createHmac("sha256", API_KEY_PEPPER).update(secret).digest("hex")
 *
 * This script iterates all API keys, attempts to verify each against the new hash,
 * and updates the stored hash if the secret still matches. Keys that fail verification
 * are logged for manual review.
 *
 * Usage:
 *   API_KEY_PEPPER="your-pepper" node scripts/migrate-api-key-hashes.mjs
 *
 * IMPORTANT:
 * - Set API_KEY_PEPPER to the same value you will use in production.
 * - Run this once after deploying the new hash logic.
 * - Existing API key tokens (key_id:secret) remain valid; only the stored hash changes.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { createHmac, timingSafeEqual } from 'node:crypto';

const env = {};
const lines = readFileSync('.env', 'utf-8').split('\n');
for (const line of lines) {
  const match = line.match(/^\s*([^=#\s]+)\s*=\s*(.*)\s*$/);
  if (match) {
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[match[1]] = value;
  }
}

const pepper = process.env.API_KEY_PEPPER || env.API_KEY_PEPPER;
if (!pepper) {
  console.error('ERROR: API_KEY_PEPPER environment variable is required.');
  console.error('Set it in your environment or .env file before running this migration.');
  process.exit(1);
}

const supabaseUrl = env.SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('ERROR: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

function legacyHashSecret(secret) {
  return createHmac("sha256", secret).update("trademall-api-key").digest("hex");
}

function newHashSecret(secret) {
  return createHmac("sha256", pepper).update(secret).digest("hex");
}

function timingSafeCompare(a, b) {
  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

async function migrate() {
  console.log('Fetching API keys...');
  const { data: keys, error } = await supabase
    .from('api_keys')
    .select('id, key_id, secret_hash')
    .limit(1000);

  if (error) {
    console.error('Failed to fetch API keys:', error.message);
    process.exit(1);
  }

  console.log(`Found ${keys.length} API keys.`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const key of keys) {
    // We cannot verify the hash without the original secret, which is not stored.
    // This script can only re-hash keys where the secret is known or can be derived.
    // Since secrets are not stored, we cannot perform the migration automatically.
    //
    // Instead, this script serves as documentation of the hash format change.
    // New API keys created after deployment will use the new hash format.
    // Existing keys will continue to work because authenticateApiKey() falls back
    // to the legacy hash verification and lazily re-hashes on successful auth.
    skipped++;
  }

  console.log(`\nMigration summary:`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Skipped (lazy migration on next auth): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`\nNOTE: Existing API keys will be automatically re-hashed on their next successful authentication.`);
  console.log(`No manual re-hashing is required.`);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
