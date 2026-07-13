// Rebuilds the blog_drafts seed from the live site. Run with:
//   node scripts/recover-blog-posts.mjs
// Network access required. Writes supabase/seed/ outputs; commits are manual.

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  parseRssItems,
  parseSitemapLastmod,
  extractFeaturedSlugs,
  buildPostRow,
  collectOldStorageUrls,
  rewriteStorageHost,
  removeDeadImages,
  buildSeedSql,
  slugFromUrl,
} from './lib/recover-posts.mjs';

const SITE = 'https://camberco.co.uk';
const OUT_DIR = 'supabase/seed';
const IMG_DIR = path.join(OUT_DIR, 'images');

async function fetchText(url) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

const rssItems = parseRssItems(await fetchText(`${SITE}/rss.xml`));
if (rssItems.length === 0) throw new Error('RSS returned no items');
console.log(`rss: ${rssItems.length} posts`);

const lastmodByUrl = parseSitemapLastmod(await fetchText(`${SITE}/sitemap-0.xml`));
const featuredSlugs = extractFeaturedSlugs(await fetchText(`${SITE}/blog`));
console.log(`featured: ${featuredSlugs.join(', ') || 'none detected'}`);

const rows = [];
for (const item of rssItems) {
  const pageHtml = await fetchText(item.link);
  const lastmod = lastmodByUrl.get(item.link.replace(/\/$/, '')) ?? null;
  rows.push(buildPostRow({ pageHtml, url: item.link, rssItem: item, lastmod, featuredSlugs }));
  console.log(`post: ${slugFromUrl(item.link)}`);
}

// Image recovery. The original storage host is dead, so the only public
// copies live in the Wayback Machine, if it crawled them.
const oldUrls = collectOldStorageUrls(rows);
await mkdir(IMG_DIR, { recursive: true });
const recoveredUrls = [];
const lostUrls = [];
for (const url of oldUrls) {
  let snap = null;
  try {
    const avail = await (
      await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(30000),
      })
    ).json();
    snap = avail?.archived_snapshots?.closest;
  } catch {
    snap = null;
  }
  if (!snap?.available) {
    lostUrls.push(url);
    console.log(`image lost: ${url}`);
    continue;
  }
  // The id_ flag returns the original bytes, not the Wayback-rewritten page.
  const rawUrl = snap.url.replace(/\/web\/(\d+)\//, '/web/$1id_/');
  try {
    const res = await fetch(rawUrl, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const filename = url.split('/').pop();
    await writeFile(path.join(IMG_DIR, filename), Buffer.from(await res.arrayBuffer()));
    recoveredUrls.push(url);
    console.log(`image recovered: ${filename}`);
  } catch (err) {
    lostUrls.push(url);
    console.log(`image lost (${err.message}): ${url}`);
  }
}

// Strip dead images first (they are old-host URLs), then move survivors to
// the new host.
for (const row of rows) {
  row.content = rewriteStorageHost(removeDeadImages(row.content, lostUrls));
  if (row.cover_image && lostUrls.includes(row.cover_image)) {
    row.cover_image = null;
    row.cover_image_alt = null;
  } else if (row.cover_image) {
    row.cover_image = rewriteStorageHost(row.cover_image);
  }
}

await writeFile(path.join(OUT_DIR, '2026-07-12-recovered-posts.sql'), buildSeedSql(rows));

const report = [
  '# Blog recovery report (2026-07-12)',
  '',
  `Posts recovered: ${rows.length}`,
  ...rows.map(
    (r) =>
      `- ${r.slug} (${r.featured ? 'featured, ' : ''}category ${r.category}, ${r.tags.length} tags, content ${r.content.length} chars, cover ${r.cover_image ? 'yes' : 'no'})`,
  ),
  '',
  `Images referenced by the old posts: ${oldUrls.length}`,
  `Recovered via Wayback into supabase/seed/images/: ${recoveredUrls.length}`,
  ...recoveredUrls.map((u) => `- ${u.split('/').pop()}`),
  `Unrecoverable (stripped from content and covers): ${lostUrls.length}`,
  ...lostUrls.map((u) => `- ${u}`),
  '',
  'Charlie: if you have originals of the unrecoverable images, re-upload them',
  'through the admin editor after go-live.',
  '',
].join('\n');
await writeFile(path.join(OUT_DIR, '2026-07-12-recovery-report.md'), report);

console.log(`\ndone: ${rows.length} posts, ${recoveredUrls.length}/${oldUrls.length} images recovered`);
