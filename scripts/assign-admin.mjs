import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

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

const targetEmail = process.argv[2] || process.env.ASSIGN_ADMIN_EMAIL;
if (!targetEmail) {
  console.error('ERROR: Target email is required.');
  console.error('Usage: node scripts/assign-admin.mjs <email>');
  console.error('   or: ASSIGN_ADMIN_EMAIL=<email> node scripts/assign-admin.mjs');
  process.exit(1);
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 100 });
if (error) {
  console.error('Failed to list users:', error.message);
  process.exit(1);
}

const target = data.users.find(u => u.email?.toLowerCase() === targetEmail.toLowerCase());
if (!target) {
  console.error(`User not found: ${targetEmail}`);
  process.exit(1);
}

const { error: roleError } = await supabase
  .from('platform_roles')
  .upsert({ user_id: target.id, role: 'admin' }, { onConflict: 'user_id' });

if (roleError) {
  console.error('Failed to assign role:', roleError.message);
  process.exit(1);
}

console.log(`Assigned admin role to ${target.email} (${target.id})`);
