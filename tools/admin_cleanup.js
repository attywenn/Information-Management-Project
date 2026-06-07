#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import process from 'node:process';

// Usage: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars, then run:
// node tools/admin_cleanup.js --adminPhone=+639511614532 --confirm

const argv = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [k, v] = arg.split('=');
  return [k.replace(/^--/, ''), v || ''];
}));

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const looksLikePlaceholder = (value) => {
  const text = String(value || '').trim();
  return !text || text.startsWith('<') || text.includes('YOUR_') || text === 'CHANGE_ME';
};

const hasPathSegments = (value) => {
  try {
    const parsed = new URL(String(value || '').trim());
    return parsed.pathname !== '/' || parsed.search !== '' || parsed.hash !== '';
  } catch {
    return true;
  }
};

if (!supabaseUrl || !serviceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in environment.');
  process.exit(1);
}

if (looksLikePlaceholder(supabaseUrl) || looksLikePlaceholder(serviceKey)) {
  console.error('Error: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY looks like a placeholder. Replace it with the real project URL and the rotated service role key.');
  process.exit(1);
}

if (hasPathSegments(supabaseUrl)) {
  console.error('Error: SUPABASE_URL must be only the project root, like https://<project-ref>.supabase.co. Do not include /rest/v1 or any other path.');
  process.exit(1);
}

const adminPhone = argv.adminPhone || argv.adminphone || '+639511614532';
const confirm = argv.confirm === 'true' || argv.confirm === '' || argv.yes === 'true';

if (!confirm) {
  console.log('Dry run: no changes will be made. Pass --confirm to execute.');
}

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  try {
    // Find admin user (first admin in admin_profiles join profiles)
    const { data: adminRows, error: adminError } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .eq('role', 'admin')
      .limit(1);

    if (adminError) throw adminError;
    const admin = (adminRows && adminRows[0]) || null;
    if (!admin) {
      console.log('No admin profile found.');
      return;
    }

    console.log('Admin found:', admin.id, admin.email || admin.display_name || '');

    if (confirm) {
      // Update admin auth phone number instead of a missing profiles.contact_number column
      const { error: updErr } = await supabase.auth.admin.updateUserById(admin.id, {
        phone: adminPhone,
        phone_confirm: true,
      });
      if (updErr) console.warn('Failed to update admin phone:', updErr.message || updErr);
      else console.log('Admin phone updated to', adminPhone);
    } else {
      console.log('Would update admin phone to', adminPhone);
    }

    // Find patient profiles with null or empty contact_number
    const { data: targets, error: targetsErr } = await supabase
      .from('patient_profiles')
      .select('user_id, contact_number');

    if (targetsErr) throw targetsErr;

    const idsToDelete = new Set();
    (targets || [])
      .filter((row) => !String(row.contact_number || '').trim())
      .forEach((row) => idsToDelete.add(row.user_id));

    // Remove admin id if present
    idsToDelete.delete(admin.id);

    console.log('Accounts found without contact_number (excluding admin):', idsToDelete.size);

    if (!confirm) return;

    for (const id of Array.from(idsToDelete)) {
      try {
        // delete auth user
        await supabase.auth.admin.deleteUser(id);
      } catch (e) {
        console.warn('Auth delete failed for', id, e?.message || e);
      }
      try {
        await supabase.from('profiles').delete().eq('id', id);
      } catch (e) {
        console.warn('Profile delete failed for', id, e?.message || e);
      }
      try {
        await supabase.from('patient_profiles').delete().eq('user_id', id);
      } catch (e) {
        console.warn('Patient profile delete failed for', id, e?.message || e);
      }
      console.log('Deleted account', id);
    }

    console.log('Cleanup complete. Deleted count:', idsToDelete.size);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(2);
  }
}

main();
