// Uploads recovered blog images to the new project's blog-images bucket.
// Run with: node --env-file=.env scripts/upload-recovered-images.mjs

import { createClient } from '@supabase/supabase-js';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error(
    'PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. Run with node --env-file=.env',
  );
}
if (!url.includes('tgyrlohcvmtjklmajuhk')) {
  throw new Error(`refusing to run: PUBLIC_SUPABASE_URL is not the new project (${url})`);
}

const TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
};

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const dir = 'supabase/seed/images';
const files = (await readdir(dir).catch(() => [])).filter((f) => !f.startsWith('.'));
if (files.length === 0) {
  console.log('no recovered images to upload');
  process.exit(0);
}

let failed = 0;
for (const file of files) {
  const ext = file.split('.').pop().toLowerCase();
  const body = await readFile(path.join(dir, file));
  const { error } = await supabase.storage
    .from('blog-images')
    .upload(file, body, { contentType: TYPES[ext] ?? 'application/octet-stream', upsert: true });
  if (error) {
    console.error(`upload failed: ${file}: ${error.message}`);
    failed += 1;
    continue;
  }
  const publicUrl = `${url}/storage/v1/object/public/blog-images/${file}`;
  const check = await fetch(publicUrl);
  console.log(`${check.ok ? 'ok' : `HTTP ${check.status}`}: ${publicUrl}`);
  if (!check.ok) failed += 1;
}
if (failed > 0) {
  console.error(`${failed} uploads failed`);
  process.exit(1);
}
