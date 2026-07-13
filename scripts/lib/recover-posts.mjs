// Pure helpers for rebuilding blog_drafts rows from the live site's rendered
// HTML after the July 2026 database loss. No network or filesystem access in
// this module. The orchestrator (scripts/recover-blog-posts.mjs) does the IO
// so everything here stays unit-testable.

export const OLD_HOST = 'https://cgippqarwcizzrwqfjot.supabase.co';
export const NEW_HOST = 'https://tgyrlohcvmtjklmajuhk.supabase.co';

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const OLD_STORAGE_RE = new RegExp(
  escapeRe(`${OLD_HOST}/storage/v1/object/public/blog-images/`) + '[A-Za-z0-9._-]+',
  'g',
);

export function decodeXml(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

export function parseRssItems(rssXml) {
  const items = [];
  for (const m of rssXml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1];
    const text = (tag) => {
      const mm = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
      return mm ? decodeXml(mm[1]) : null;
    };
    const categories = [...block.matchAll(/<category>([\s\S]*?)<\/category>/g)].map((c) =>
      decodeXml(c[1]),
    );
    items.push({
      title: text('title'),
      link: text('link'),
      description: text('description'),
      pubDate: text('pubDate'),
      // The feed emits the raw category slug first, then the tags.
      category: categories[0] ?? 'ai-strategy',
      tags: categories.slice(1),
    });
  }
  return items;
}

export function slugFromUrl(url) {
  return new URL(url).pathname.replace(/^\/blog\//, '').replace(/\/$/, '');
}

export function parseSitemapLastmod(xml) {
  const map = new Map();
  for (const m of xml.matchAll(/<url>\s*<loc>([\s\S]*?)<\/loc>[\s\S]*?<\/url>/g)) {
    const lastmod = m[0].match(/<lastmod>([\s\S]*?)<\/lastmod>/);
    if (lastmod) map.set(decodeXml(m[1]).replace(/\/$/, ''), lastmod[1]);
  }
  return map;
}

export function extractFeaturedSlugs(indexHtml) {
  const start = indexHtml.indexOf('class="featured-section"');
  if (start === -1) return [];
  const end = indexHtml.indexOf('</section>', start);
  const section = indexHtml.slice(start, end === -1 ? undefined : end);
  const slugs = [...section.matchAll(/href="\/blog\/([a-z0-9-]+)\/?"/g)]
    .map((m) => m[1])
    .filter((s) => s !== 'category');
  return [...new Set(slugs)];
}

export function extractArticleBody(pageHtml) {
  const marker = '<article class="post-content prose"';
  const start = pageHtml.indexOf(marker);
  if (start === -1) throw new Error('article marker not found');
  const from = pageHtml.indexOf('>', start) + 1;
  const end = pageHtml.indexOf('</article>', from);
  if (end === -1) throw new Error('article close tag not found');
  return pageHtml.slice(from, end);
}

export function extractJsonLdArticle(pageHtml) {
  for (const m of pageHtml.matchAll(
    /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
  )) {
    let parsed;
    try {
      parsed = JSON.parse(m[1]);
    } catch {
      continue;
    }
    const items = Array.isArray(parsed) ? parsed : [parsed];
    const article = items.find((it) => it && it['@type'] === 'Article');
    if (article) return article;
  }
  return null;
}

export function stripProcessingArtifacts(bodyHtml) {
  // processHtml() in src/lib/blog.ts adds heading ids and img
  // loading/decoding/width/height at render time. Remove them so the stored
  // content matches what the editor saved and the build can re-derive them.
  let out = bodyHtml.replace(/<(h[23]) id="[^"]*">/gi, '<$1>');
  out = out.replace(/<img\b[^>]*>/gi, (tag) =>
    tag
      .replace(/\s+loading="[^"]*"/i, '')
      .replace(/\s+decoding="[^"]*"/i, '')
      .replace(/\s+width="\d+"/i, '')
      .replace(/\s+height="\d+"/i, ''),
  );
  return out;
}

export function extractCoverImage(pageHtml) {
  const m = pageHtml.match(
    /class="post-cover"[^>]*>\s*<img\s+src="([^"]+)"\s+alt="([^"]*)"/,
  );
  if (!m) return { coverImage: null, coverImageAlt: null };
  return { coverImage: m[1], coverImageAlt: decodeXml(m[2]) };
}

export function buildPostRow({ pageHtml, url, rssItem, lastmod, featuredSlugs }) {
  const slug = slugFromUrl(url);
  const article = extractJsonLdArticle(pageHtml);
  if (!article) throw new Error(`no Article JSON-LD on ${url}`);
  const content = stripProcessingArtifacts(extractArticleBody(pageHtml));
  const { coverImage, coverImageAlt } = extractCoverImage(pageHtml);
  const title = article.headline;
  return {
    slug,
    title,
    description: article.description ?? rssItem?.description ?? '',
    author: article.author?.name ?? 'Charlie W',
    category: rssItem?.category ?? 'ai-strategy',
    tags: rssItem?.tags ?? [],
    cover_image: coverImage,
    // The page renders alt = coverImageAlt ?? title, so alt === title means
    // the original alt was null.
    cover_image_alt: coverImageAlt && coverImageAlt !== title ? coverImageAlt : null,
    content,
    featured: featuredSlugs.includes(slug),
    published_at: article.datePublished,
    updated_at: lastmod ?? article.dateModified ?? article.datePublished,
  };
}

export function collectOldStorageUrls(rows) {
  const urls = new Set();
  for (const row of rows) {
    for (const src of [row.content ?? '', row.cover_image ?? '']) {
      for (const m of src.matchAll(OLD_STORAGE_RE)) urls.add(m[0]);
    }
  }
  return [...urls];
}

export function rewriteStorageHost(html) {
  return html.split(OLD_HOST).join(NEW_HOST);
}

export function removeDeadImages(html, deadUrls) {
  let out = html;
  for (const url of deadUrls) {
    out = out.replace(new RegExp(`<img\\b[^>]*${escapeRe(url)}[^>]*>`, 'g'), '');
  }
  // A figure whose img was removed is an orphaned caption. Drop it.
  out = out.replace(/<figure\b[^>]*>(?:(?!<img|<\/figure>)[\s\S])*<\/figure>/g, '');
  return out;
}

const q = (s) =>
  s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`;

export function dollarQuote(text) {
  let tag = 'seed';
  let i = 0;
  while (text.includes(`$${tag}$`)) {
    i += 1;
    tag = `seed${i}`;
  }
  return `$${tag}$${text}$${tag}$`;
}

export function buildSeedSql(rows) {
  const header = `-- Recovered published posts, scraped from https://camberco.co.uk on
-- 2026-07-12 after the loss of the original Supabase project. Idempotent:
-- re-running skips slugs that already exist as published posts.

do $$
begin
  if (select count(*) from auth.users) <> 1 then
    raise exception 'expected exactly 1 auth user (the admin), found %',
      (select count(*) from auth.users);
  end if;
end $$;
`;
  const inserts = rows.map(
    (r) => `insert into public.blog_drafts
  (user_id, title, slug, description, author, category, tags,
   cover_image, cover_image_alt, content, status, featured,
   published_at, created_at, updated_at)
select (select id from auth.users), ${q(r.title)}, ${q(r.slug)}, ${q(r.description)}, ${q(r.author)}, ${q(r.category)}, ${q(JSON.stringify(r.tags))}::jsonb,
  ${q(r.cover_image)}, ${q(r.cover_image_alt)}, ${dollarQuote(r.content)}, 'published', ${r.featured ? 'true' : 'false'},
  ${q(r.published_at)}, ${q(r.published_at)}, ${q(r.updated_at)}
on conflict (slug) where status = 'published' do nothing;`,
  );
  return `${header}\n${inserts.join('\n\n')}\n`;
}
