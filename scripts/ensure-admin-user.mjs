// Ensures exactly one admin login exists for the Camber Co admin area and
// delivers its password to Charlie safely (never to stdout).
//
// Run with:  node --env-file=.env scripts/ensure-admin-user.mjs
//   --rotate   also set a NEW strong password on an existing user (opt-in)
//
// Behaviour:
//  - Paginates auth.admin.listUsers to find the admin email (never assumes page 1).
//  - If the user does NOT exist: creates it with a freshly generated strong
//    password (email_confirm: true), then reassigns existing blog_drafts to the
//    new user id so the blog list keeps rendering (reports the row count).
//  - If the user already exists: no-op UNLESS --rotate is passed. Re-running
//    without --rotate never changes the password (so a delivered one keeps working).
//  - If createUser reports "already registered", falls back to lookup+update so a
//    duplicate can never be created.
//  - Generated passwords are written to a git-ignored file with 0600 perms; only
//    the file location is printed. The service-role key is never printed.
//  - Other auth users are listed (never deleted) for manual review.

import { createClient } from '@supabase/supabase-js';
import { randomInt } from 'node:crypto';
import { chmodSync, writeFileSync } from 'node:fs';

const url = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  throw new Error(
    'PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. Run with node --env-file=.env',
  );
}

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'charlie@camberco.co.uk').toLowerCase();
const ROTATE = process.argv.includes('--rotate');
const CREDS_FILE = '.admin-credentials.local';

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// --- strong password generation (CSPRNG, guaranteed class coverage) ---
function generatePassword(length = 24) {
  // Ambiguous characters (0/O, 1/l/I) omitted to keep it transcribable.
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '23456789';
  const symbols = '!@#$%^&*-_=+?';
  const all = lower + upper + digits + symbols;
  const pick = (set) => set[randomInt(set.length)];
  const chars = [pick(lower), pick(upper), pick(digits), pick(symbols)];
  while (chars.length < length) chars.push(pick(all));
  // Fisher-Yates shuffle so the guaranteed characters are not always first.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function writeCredentials(email, password) {
  const contents = [
    'Camber Co — admin login',
    '========================',
    `email:    ${email}`,
    `password: ${password}`,
    `written:  ${new Date().toISOString()}`,
    '',
    'This file is git-ignored. Store the password in your password manager and delete this file.',
    '',
  ].join('\n');
  writeFileSync(CREDS_FILE, contents, { mode: 0o600 });
  chmodSync(CREDS_FILE, 0o600); // enforce perms even if the file pre-existed
}

async function findAdminAndOthers() {
  const perPage = 1000;
  let page = 1;
  let admin = null;
  const others = [];
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const users = data?.users ?? [];
    for (const u of users) {
      if ((u.email ?? '').toLowerCase() === ADMIN_EMAIL) admin = u;
      else others.push(u.email ?? '(no email)');
    }
    if (users.length < perPage) break;
    page += 1;
  }
  return { admin, others };
}

async function reassignBlogDrafts(newUserId) {
  const { data, error } = await supabase
    .from('blog_drafts')
    .update({ user_id: newUserId })
    .neq('user_id', newUserId)
    .select('id');
  if (error) {
    console.warn(`⚠️  Could not reassign blog_drafts: ${error.message}`);
    return 0;
  }
  return data?.length ?? 0;
}

async function main() {
  const { admin, others } = await findAdminAndOthers();

  if (others.length > 0) {
    console.warn(`\n⚠️  Found ${others.length} other auth user(s): ${others.join(', ')}`);
    console.warn('   These were NOT modified or deleted. Review them manually if unexpected.\n');
  }

  // --- Existing user ---
  if (admin) {
    if (!ROTATE) {
      console.log(`✓ Admin user ${ADMIN_EMAIL} already exists (id ${admin.id}). No changes made.`);
      console.log('  Re-run with --rotate to set and deliver a new password.');
      return;
    }
    const password = generatePassword();
    const { error } = await supabase.auth.admin.updateUserById(admin.id, { password });
    if (error) throw new Error(`Failed to rotate password: ${error.message}`);
    writeCredentials(ADMIN_EMAIL, password);
    console.log(`✓ Rotated password for ${ADMIN_EMAIL} (id ${admin.id}).`);
    console.log(`  New password written to ${CREDS_FILE} (git-ignored, 0600). It is not printed here.`);
    return;
  }

  // --- Create fresh ---
  const password = generatePassword();
  const { data: created, error: createErr } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password,
    email_confirm: true,
  });

  if (createErr) {
    // Safety net: a race/duplicate means the user actually exists. Fall back to
    // update so we can never create a second admin row.
    if (/already.*registered|already exists/i.test(createErr.message)) {
      const { admin: again } = await findAdminAndOthers();
      if (again) {
        if (!ROTATE) {
          console.log(`✓ Admin user ${ADMIN_EMAIL} already exists (id ${again.id}). No changes made.`);
          return;
        }
        const { error } = await supabase.auth.admin.updateUserById(again.id, { password });
        if (error) throw new Error(`Failed to set password on existing user: ${error.message}`);
        writeCredentials(ADMIN_EMAIL, password);
        console.log(`✓ Set password on existing ${ADMIN_EMAIL}. Written to ${CREDS_FILE}.`);
        return;
      }
    }
    throw new Error(`Failed to create admin user: ${createErr.message}`);
  }

  const newId = created.user.id;
  writeCredentials(ADMIN_EMAIL, password);
  const reassigned = await reassignBlogDrafts(newId);
  console.log(`✓ Created admin user ${ADMIN_EMAIL} (id ${newId}).`);
  console.log(`  Password written to ${CREDS_FILE} (git-ignored, 0600). It is not printed here.`);
  console.log(`  Reassigned ${reassigned} existing blog_drafts row(s) to the new user id.`);
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
