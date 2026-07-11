#!/usr/bin/env node
// Downloads Football IQ screenshots from the App Store listing into
// src/assets/projects/football-iq/. Safe to re-run. Never fails the build:
// on any error it prints a warning and exits 0 so cards render without shots.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const APP_ID = '6757344691';
const COUNTRY = 'gb';
const OUT_DIR = path.join('src', 'assets', 'projects', 'football-iq');
const MAX_SHOTS = 3;

async function main() {
  let data;
  try {
    const res = await fetch(`https://itunes.apple.com/lookup?id=${APP_ID}&country=${COUNTRY}`);
    if (!res.ok) throw new Error(`lookup returned HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.warn(`[fetch-appstore-screenshots] lookup failed: ${err.message}. Skipping.`);
    return;
  }

  const app = data.results?.[0];
  const urls = app?.screenshotUrls ?? [];
  if (urls.length === 0) {
    console.warn('[fetch-appstore-screenshots] no screenshots in lookup response. Skipping.');
    return;
  }

  await mkdir(OUT_DIR, { recursive: true });
  const saved = [];
  for (const [i, url] of urls.slice(0, MAX_SHOTS).entries()) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`download returned HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      const ext = path.extname(new URL(url).pathname) || '.png';
      const file = path.join(OUT_DIR, `screenshot-${i + 1}${ext}`);
      await writeFile(file, buf);
      saved.push(file);
      console.log(`[fetch-appstore-screenshots] saved ${file} (${buf.length} bytes)`);
    } catch (err) {
      console.warn(`[fetch-appstore-screenshots] failed ${url}: ${err.message}`);
    }
  }

  if (saved.length > 0) {
    const paths = saved.map((f) => '/' + f.split(path.sep).join('/'));
    console.log('\nWire these into src/data/projects.ts (football-iq entry):');
    console.log(`  screenshots: ${JSON.stringify(paths)},`);
  }
}

main();
