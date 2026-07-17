// Post-build guardrail: fail the build if the service-role key leaked into any
// client-facing output. The admin token lives in a non-httpOnly cookie and
// localStorage, so a service-role key in the client bundle would be a full
// database compromise. Runs as part of `pnpm build`.
//
// Scans only client/static output (never the server functions, which legitimately
// hold the key) for the key's actual value and its env-var name.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const KEY_VALUE = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

const needles = [{ label: 'SUPABASE_SERVICE_ROLE_KEY (name)', value: 'SUPABASE_SERVICE_ROLE_KEY' }];
if (KEY_VALUE) needles.push({ label: '<service-role-key-value>', value: KEY_VALUE });

// Client-facing build directories only. Vercel puts SSR functions under
// .vercel/output/functions, which we deliberately do NOT scan.
const CLIENT_DIRS = ['.vercel/output/static', 'dist/client'].filter(existsSync);

if (CLIENT_DIRS.length === 0) {
  console.log('ℹ check-client-bundle: no client build output found to scan (skipping).');
  process.exit(0);
}

const SCAN_EXT = /\.(js|mjs|cjs|css|html|json|map|txt)$/i;
const hits = [];
let scanned = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      walk(p);
    } else if (SCAN_EXT.test(entry)) {
      scanned++;
      const text = readFileSync(p, 'utf8');
      for (const needle of needles) {
        if (text.includes(needle.value)) hits.push({ file: p, needle: needle.label });
      }
    }
  }
}

for (const dir of CLIENT_DIRS) walk(dir);

if (hits.length > 0) {
  console.error(`\n✗ check-client-bundle: service-role secret found in client output:`);
  for (const h of hits) console.error(`    ${h.file} → ${h.needle}`);
  console.error('\nThe service-role key must never reach the browser. Aborting.\n');
  process.exit(1);
}

console.log(
  `✓ check-client-bundle: ${scanned} client file(s) scanned across ${CLIENT_DIRS.join(', ')}, no service-role secret found.`,
);
