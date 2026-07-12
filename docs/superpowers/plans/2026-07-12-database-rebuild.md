# Database Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the lost Supabase database on the new project (`tgyrlohcvmtjklmajuhk`) — schema, storage, RPC, recovered blog content — verified end to end so Charlie can update env vars and push main.

**Architecture:** The four committed migration files are applied verbatim via the Supabase MCP; one new migration adds the `blog-images` bucket, storage policies, and a published-slug unique index. A pure-function recovery library (tested with vitest) reconstructs the 10 published posts from the live site's rendered HTML, RSS, and sitemap; an orchestrator script writes a committed seed SQL file plus a recovery report, and attempts image recovery via the Wayback Machine.

**Tech Stack:** Supabase MCP tools (`apply_migration`, `execute_sql`, `list_tables`, `get_advisors`, `get_publishable_keys`), Node 22 ESM scripts (built-in `fetch`, `--env-file`), vitest, @supabase/supabase-js.

## Global Constraints

- New Supabase project: `https://tgyrlohcvmtjklmajuhk.supabase.co` (ref `tgyrlohcvmtjklmajuhk`). Dead project: `cgippqarwcizzrwqfjot` — its URLs appear only as rewrite/strip targets.
- NEVER read or print the VALUES in `.env` or any secrets file. Env var NAMES only. Charlie edits `.env` and Vercel himself.
- Do NOT push `main` or any branch to origin. Pushing deploys the site.
- Database DDL goes through `mcp__supabase__apply_migration`; data and verification queries through `mcp__supabase__execute_sql`.
- Seeded posts: `user_id = (select id from auth.users)`, guarded by a DO block requiring exactly one auth user. Seeding is blocked until Charlie creates the admin user (Task 6).
- All new copy (comments, report text): British English, short sentences, NO em dashes.
- Commits end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- Work happens on branch `database-rebuild` off local `main`.
- Category slugs are exactly: `ai-strategy`, `automation`, `case-study`, `tools-and-workflows`, `founder-journey`, `industry-trends` (from `src/pages/blog/[slug].astro:49-56`). The RSS feed's FIRST `<category>` per item is the raw slug; remaining `<category>` entries are tags.

---

### Task 1: Branch and apply the four committed migrations

**Files:**
- Read: `supabase/migrations/20260317_create_enquiries.sql`, `supabase/migrations/20260710090000_create_subscribers.sql`, `supabase/migrations/20260710090001_create_blog_drafts.sql`, `supabase/migrations/20260710090002_create_rate_limits.sql`
- No repo modifications (branch creation only).

**Interfaces:**
- Consumes: empty `public` schema on the new project (verified: `list_tables` returns `{"tables":[]}`).
- Produces: tables `enquiries`, `subscribers`, `blog_drafts`, `rate_limits` and function `bump_rate_limit(text, integer, integer)`, exactly as the migration files define them. Later tasks rely on `blog_drafts` columns `(id, user_id, title, slug, description, author, category, tags, cover_image, cover_image_alt, content, status, featured, published_at, created_at, updated_at)`.

- [ ] **Step 1: Create the working branch**

```bash
cd /Users/charlie/workspace/camber-co && git checkout -b database-rebuild
```

- [ ] **Step 2: Apply each migration file verbatim, in filename order**

For each file below, Read it and pass its full contents as `query` to `mcp__supabase__apply_migration` with the given name:

| File | migration name |
|---|---|
| `supabase/migrations/20260317_create_enquiries.sql` | `create_enquiries` |
| `supabase/migrations/20260710090000_create_subscribers.sql` | `create_subscribers` |
| `supabase/migrations/20260710090001_create_blog_drafts.sql` | `create_blog_drafts` |
| `supabase/migrations/20260710090002_create_rate_limits.sql` | `create_rate_limits` |

Expected: each call succeeds. Do not edit the SQL in any way.

- [ ] **Step 3: Verify the schema**

Run `mcp__supabase__list_tables` with `schemas: ["public"], verbose: true`.

Expected: exactly 4 tables. Check column-by-column:
- `enquiries`: id, name, email, company, service, message, source, chat_transcript, status, created_at, updated_at. RLS enabled.
- `subscribers`: id, email, confirmed, unsubscribe_token, created_at, status, unsubscribed_at, last_sent_at. RLS enabled.
- `blog_drafts`: id, user_id, title, slug, description, author, category, tags, cover_image, cover_image_alt, content, status, featured, published_at, created_at, updated_at. RLS enabled.
- `rate_limits`: key, count, window_started_at. RLS enabled.

Then run `mcp__supabase__list_migrations`. Expected: 4 entries named as in Step 2.

Then verify the unique indexes and function exist via `mcp__supabase__execute_sql`:

```sql
select indexname from pg_indexes where schemaname = 'public' order by indexname;
```

Expected to include: `subscribers_email_key`, `subscribers_unsubscribe_token_key`, `blog_drafts_status_published_at_idx` (plus the four `*_pkey` indexes).

```sql
select proname, prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and proname = 'bump_rate_limit';
```

Expected: one row, `prosecdef = true`.

- [ ] **Step 4: Report**

No commit (no repo changes). Report the verbatim `list_tables` and index/function query outputs.

---

### Task 2: New migration — blog-images bucket, storage policies, slug index

**Files:**
- Create: `supabase/migrations/20260712100000_create_blog_images_bucket.sql`

**Interfaces:**
- Consumes: `blog_drafts` table from Task 1.
- Produces: public storage bucket `blog-images`; storage policies `blog_images_public_read` and `blog_images_authenticated_insert`; partial unique index `blog_drafts_published_slug_key`. Task 5's seed SQL relies on this index as its `on conflict` arbiter; Task 9 uploads into this bucket.

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260712100000_create_blog_images_bucket.sql`:

```sql
-- Storage bucket for blog images. Public read (published posts embed public
-- URLs); the admin editor uploads client-side with the admin's auth session,
-- so authenticated needs an insert policy. Service-role uploads bypass RLS.

insert into storage.buckets (id, name, public)
values ('blog-images', 'blog-images', true)
on conflict (id) do nothing;

create policy "blog_images_public_read"
  on storage.objects for select
  to public
  using (bucket_id = 'blog-images');

create policy "blog_images_authenticated_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'blog-images');

-- Hardening: getPostBySlug() uses .single() on slug, so published slugs must
-- be unique. Partial index only. Drafts share the default '' slug.
create unique index if not exists blog_drafts_published_slug_key
  on public.blog_drafts (slug)
  where status = 'published';
```

- [ ] **Step 2: Apply it**

Call `mcp__supabase__apply_migration` with name `create_blog_images_bucket` and the file's full contents as query.

Expected: success. **Known fallback:** if it fails with `must be owner of table objects` or `permission denied` on the `create policy` statements, split the work: apply a migration containing only the `insert into storage.buckets` and `create unique index` statements, then STOP and report BLOCKED with this exact note for the controller: "Charlie must create two policies in Dashboard -> Storage -> Policies on bucket blog-images: (1) name blog_images_public_read, operation SELECT, target roles public, USING expression `bucket_id = 'blog-images'`; (2) name blog_images_authenticated_insert, operation INSERT, target roles authenticated, WITH CHECK expression `bucket_id = 'blog-images'`."

- [ ] **Step 3: Verify**

Via `mcp__supabase__execute_sql`:

```sql
select id, public from storage.buckets where id = 'blog-images';
```

Expected: one row, `public = true`.

```sql
select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects'
and policyname like 'blog_images%' order by policyname;
```

Expected: `blog_images_authenticated_insert`, `blog_images_public_read` (unless the Step 2 fallback fired).

```sql
select indexdef from pg_indexes where indexname = 'blog_drafts_published_slug_key';
```

Expected: one row containing `UNIQUE` and `WHERE (status = 'published'::text)`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260712100000_create_blog_images_bucket.sql
git commit -m "feat: add blog-images bucket, storage policies and published-slug index

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Behavioural verification of bump_rate_limit

**Files:** none (database verification only, via `mcp__supabase__execute_sql`).

**Interfaces:**
- Consumes: `bump_rate_limit(p_key text, p_limit integer, p_window_minutes integer) returns boolean` from Task 1. Semantics (from `supabase/migrations/20260710090002_create_rate_limits.sql`): atomic insert-or-increment; resets the counter when the window has expired; returns `count <= p_limit`.
- Produces: confidence only. No downstream dependency.

- [ ] **Step 1: Under the limit returns true**

```sql
select public.bump_rate_limit('test:rebuild-plan', 3, 60) as r1,
       public.bump_rate_limit('test:rebuild-plan', 3, 60) as r2,
       public.bump_rate_limit('test:rebuild-plan', 3, 60) as r3;
```

Expected: `r1 = true, r2 = true, r3 = true`.

- [ ] **Step 2: Over the limit returns false**

```sql
select public.bump_rate_limit('test:rebuild-plan', 3, 60) as r4;
```

Expected: `r4 = false`. Also check the row state:

```sql
select count from public.rate_limits where key = 'test:rebuild-plan';
```

Expected: `count = 4`.

- [ ] **Step 3: Expired window resets**

```sql
update public.rate_limits set window_started_at = now() - interval '61 minutes'
where key = 'test:rebuild-plan';
select public.bump_rate_limit('test:rebuild-plan', 3, 60) as after_reset;
select count, window_started_at > now() - interval '5 minutes' as window_reset
from public.rate_limits where key = 'test:rebuild-plan';
```

Expected: `after_reset = true`, then `count = 1, window_reset = true`.

- [ ] **Step 4: Clean up**

```sql
delete from public.rate_limits where key = 'test:rebuild-plan';
select count(*) from public.rate_limits;
```

Expected: delete succeeds; final count `0`.

- [ ] **Step 5: Report**

No commit. Report each query's verbatim result.

---

### Task 4: Recovery library (pure functions, TDD)

**Files:**
- Create: `scripts/lib/recover-posts.mjs`
- Test: `scripts/lib/recover-posts.test.mjs`
- Modify: `vitest.config.ts` (extend `include`)

**Interfaces:**
- Consumes: nothing from other tasks (pure string functions; no network, no filesystem).
- Produces (consumed verbatim by Tasks 5 and 10):
  - `OLD_HOST: string`, `NEW_HOST: string`
  - `parseRssItems(rssXml: string) -> Array<{title, link, description, pubDate, category, tags}>`
  - `slugFromUrl(url: string) -> string`
  - `parseSitemapLastmod(xml: string) -> Map<string, string>` (key: `<loc>` with any trailing slash stripped)
  - `extractFeaturedSlugs(indexHtml: string) -> string[]`
  - `extractArticleBody(pageHtml: string) -> string` (throws if the article marker is missing)
  - `extractJsonLdArticle(pageHtml: string) -> object | null`
  - `stripProcessingArtifacts(bodyHtml: string) -> string`
  - `extractCoverImage(pageHtml: string) -> {coverImage: string|null, coverImageAlt: string|null}`
  - `buildPostRow({pageHtml, url, rssItem, lastmod, featuredSlugs}) -> row` (row fields: slug, title, description, author, category, tags, cover_image, cover_image_alt, content, featured, published_at, updated_at)
  - `collectOldStorageUrls(rows) -> string[]`
  - `rewriteStorageHost(html: string) -> string`
  - `removeDeadImages(html: string, deadUrls: string[]) -> string`
  - `dollarQuote(text: string) -> string`
  - `buildSeedSql(rows) -> string`

- [ ] **Step 1: Extend vitest include**

In `vitest.config.ts`, change:

```ts
    include: ['src/**/*.test.ts'],
```

to:

```ts
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
```

- [ ] **Step 2: Write the failing tests**

Create `scripts/lib/recover-posts.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import {
  OLD_HOST,
  NEW_HOST,
  parseRssItems,
  slugFromUrl,
  parseSitemapLastmod,
  extractFeaturedSlugs,
  extractArticleBody,
  extractJsonLdArticle,
  stripProcessingArtifacts,
  extractCoverImage,
  buildPostRow,
  collectOldStorageUrls,
  rewriteStorageHost,
  removeDeadImages,
  dollarQuote,
  buildSeedSql,
} from './recover-posts.mjs';

const IMG = `${OLD_HOST}/storage/v1/object/public/blog-images/aaaa-1111.png`;
const COVER = `${OLD_HOST}/storage/v1/object/public/blog-images/bbbb-2222.png`;

// Mirrors the rendered output of src/pages/blog/[slug].astro, including the
// data-astro-cid scoping attributes Astro adds to styled elements.
const PAGE = `<!DOCTYPE html><html><head>
<script type="application/ld+json">[{"@context":"https://schema.org","@type":"Article","headline":"Test Post","description":"A test description.","datePublished":"2026-04-14T08:00:00.000Z","dateModified":"2026-04-20T09:00:00.000Z","author":{"@type":"Person","name":"Charlie W"},"keywords":"seo, growth","articleSection":"Case Study","image":"${COVER}"},{"@context":"https://schema.org","@type":"BreadcrumbList"}]</script>
</head><body>
<nav class="breadcrumb" data-astro-cid-x><a href="/blog/category/case-study" class="bc-link">case-study</a></nav>
<div class="post-cover" data-astro-cid-x><img src="${COVER}" alt="Dashboard screenshot" loading="eager" decoding="async"></div>
<article class="post-content prose" data-astro-cid-x><h2 id="the-problem">The problem</h2><p>It&apos;s hard.</p><img loading="lazy" decoding="async" width="800" height="400" src="${IMG}" alt="chart"><h3 id="a-fix">A fix</h3><p>Done.</p></article>
<div class="post-content" data-astro-cid-x>footer bits</div>
</body></html>`;

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Camber Co Blog</title>
<item><title>Meta&apos;s AI &amp; Chats</title><link>https://camberco.co.uk/blog/metas-ai-chats/</link><guid>x</guid><description>Meta&apos;s latest.</description><pubDate>Fri, 01 May 2026 07:35:30 GMT</pubDate><category>industry-trends</category><category>AI automation</category><category>Meta</category></item>
<item><title>Second</title><link>https://camberco.co.uk/blog/second-post/</link><guid>y</guid><description>Two.</description><pubDate>Sat, 02 May 2026 07:00:00 GMT</pubDate><category>case-study</category></item>
</channel></rss>`;

const SITEMAP = `<?xml version="1.0"?><urlset><url><loc>https://camberco.co.uk/</loc></url><url><loc>https://camberco.co.uk/blog/metas-ai-chats/</loc><lastmod>2026-05-03T10:00:00.000Z</lastmod></url></urlset>`;

const INDEX = `<section class="featured-section" data-astro-cid-y><p>Featured</p><a href="/blog/metas-ai-chats/">x</a><a href="/blog/category/case-study">cat</a></section><section><a href="/blog/second-post/">y</a></section>`;

describe('parseRssItems', () => {
  it('parses items with slug category first and tags after', () => {
    const items = parseRssItems(RSS);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Meta's AI & Chats");
    expect(items[0].link).toBe('https://camberco.co.uk/blog/metas-ai-chats/');
    expect(items[0].description).toBe("Meta's latest.");
    expect(items[0].category).toBe('industry-trends');
    expect(items[0].tags).toEqual(['AI automation', 'Meta']);
    expect(items[1].tags).toEqual([]);
  });
});

describe('slugFromUrl', () => {
  it('strips the /blog/ prefix and trailing slash', () => {
    expect(slugFromUrl('https://camberco.co.uk/blog/metas-ai-chats/')).toBe('metas-ai-chats');
    expect(slugFromUrl('https://camberco.co.uk/blog/no-slash')).toBe('no-slash');
  });
});

describe('parseSitemapLastmod', () => {
  it('maps trailing-slash-stripped locs to lastmod, skipping entries without one', () => {
    const map = parseSitemapLastmod(SITEMAP);
    expect(map.get('https://camberco.co.uk/blog/metas-ai-chats')).toBe('2026-05-03T10:00:00.000Z');
    expect(map.has('https://camberco.co.uk')).toBe(false);
  });
});

describe('extractFeaturedSlugs', () => {
  it('returns slugs only from the featured section, ignoring category links', () => {
    expect(extractFeaturedSlugs(INDEX)).toEqual(['metas-ai-chats']);
  });
  it('returns [] when there is no featured section', () => {
    expect(extractFeaturedSlugs('<main>no featured</main>')).toEqual([]);
  });
});

describe('extractArticleBody', () => {
  it('returns the inner HTML despite astro scoping attributes', () => {
    const body = extractArticleBody(PAGE);
    expect(body.startsWith('<h2 id="the-problem">')).toBe(true);
    expect(body.endsWith('<p>Done.</p>')).toBe(true);
    expect(body).not.toContain('footer bits');
  });
  it('throws when the marker is missing', () => {
    expect(() => extractArticleBody('<html></html>')).toThrow('article marker');
  });
});

describe('extractJsonLdArticle', () => {
  it('finds the Article object inside the JSON-LD array', () => {
    const a = extractJsonLdArticle(PAGE);
    expect(a.headline).toBe('Test Post');
    expect(a.datePublished).toBe('2026-04-14T08:00:00.000Z');
  });
  it('returns null when absent', () => {
    expect(extractJsonLdArticle('<html></html>')).toBeNull();
  });
});

describe('stripProcessingArtifacts', () => {
  it('removes heading ids and img loading/decoding/width/height', () => {
    const out = stripProcessingArtifacts(extractArticleBody(PAGE));
    expect(out).toContain('<h2>The problem</h2>');
    expect(out).toContain('<h3>A fix</h3>');
    expect(out).toContain(`<img src="${IMG}" alt="chart">`);
    expect(out).not.toContain('loading=');
    expect(out).not.toContain('width=');
  });
});

describe('extractCoverImage', () => {
  it('reads src and alt from the post-cover img', () => {
    expect(extractCoverImage(PAGE)).toEqual({ coverImage: COVER, coverImageAlt: 'Dashboard screenshot' });
  });
  it('returns nulls when there is no cover', () => {
    expect(extractCoverImage('<html></html>')).toEqual({ coverImage: null, coverImageAlt: null });
  });
});

describe('buildPostRow', () => {
  const row = buildPostRow({
    pageHtml: PAGE,
    url: 'https://camberco.co.uk/blog/test-post/',
    rssItem: { description: 'rss desc', category: 'case-study', tags: ['seo', 'growth'] },
    lastmod: '2026-05-03T10:00:00.000Z',
    featuredSlugs: ['test-post'],
  });
  it('assembles the row from JSON-LD, page and rss', () => {
    expect(row.slug).toBe('test-post');
    expect(row.title).toBe('Test Post');
    expect(row.description).toBe('A test description.');
    expect(row.author).toBe('Charlie W');
    expect(row.category).toBe('case-study');
    expect(row.tags).toEqual(['seo', 'growth']);
    expect(row.cover_image).toBe(COVER);
    expect(row.cover_image_alt).toBe('Dashboard screenshot');
    expect(row.featured).toBe(true);
    expect(row.published_at).toBe('2026-04-14T08:00:00.000Z');
    expect(row.updated_at).toBe('2026-05-03T10:00:00.000Z');
    expect(row.content).toContain('<h2>The problem</h2>');
  });
  it('nulls the cover alt when it just repeats the title', () => {
    const page = PAGE.replace('alt="Dashboard screenshot"', 'alt="Test Post"');
    const r = buildPostRow({ pageHtml: page, url: 'https://camberco.co.uk/blog/t/', rssItem: null, lastmod: null, featuredSlugs: [] });
    expect(r.cover_image_alt).toBeNull();
    expect(r.updated_at).toBe('2026-04-20T09:00:00.000Z');
  });
});

describe('image helpers', () => {
  const rows = [{ content: `<p>x</p><img src="${IMG}" alt="chart">`, cover_image: COVER }];
  it('collects unique old-host storage urls from content and cover', () => {
    expect(collectOldStorageUrls(rows).sort()).toEqual([IMG, COVER].sort());
  });
  it('rewrites the storage host', () => {
    expect(rewriteStorageHost(`<img src="${IMG}">`)).toBe(`<img src="${IMG.replace(OLD_HOST, NEW_HOST)}">`);
  });
  it('removes dead imgs and figures that only wrapped a dead img', () => {
    const html = `<p>a</p><img src="${IMG}" alt="chart"><figure><img src="${COVER}"><figcaption>cap</figcaption></figure><figure><img src="https://elsewhere.example/x.png"></figure>`;
    const out = removeDeadImages(html, [IMG, COVER]);
    expect(out).not.toContain(IMG);
    expect(out).not.toContain('figcaption');
    expect(out).toContain('elsewhere.example');
  });
});

describe('seed sql', () => {
  it('dollar-quotes and avoids tag collisions', () => {
    expect(dollarQuote('abc')).toBe('$seed$abc$seed$');
    expect(dollarQuote('x $seed$ y')).toBe('$seed1$x $seed$ y$seed1$');
  });
  it('builds guarded idempotent inserts', () => {
    const sql = buildSeedSql([
      {
        slug: 's-one', title: "It's one", description: 'd', author: 'Charlie W',
        category: 'case-study', tags: ['a', 'b'], cover_image: null, cover_image_alt: null,
        content: '<p>hi</p>', featured: true,
        published_at: '2026-04-14T08:00:00.000Z', updated_at: '2026-04-20T09:00:00.000Z',
      },
    ]);
    expect(sql).toContain('from auth.users) <> 1');
    expect(sql).toContain("'It''s one'");
    expect(sql).toContain('$seed$<p>hi</p>$seed$');
    expect(sql).toContain(`'["a","b"]'::jsonb`);
    expect(sql).toContain("on conflict (slug) where status = 'published' do nothing");
    expect(sql).toContain('select (select id from auth.users)');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm test -- scripts/lib/recover-posts.test.mjs`
Expected: FAIL (module `./recover-posts.mjs` not found).

- [ ] **Step 4: Write the implementation**

Create `scripts/lib/recover-posts.mjs`:

```js
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test -- scripts/lib/recover-posts.test.mjs`
Expected: PASS, all tests green.

- [ ] **Step 6: Run the whole suite**

Run: `pnpm test`
Expected: previous 91 tests plus the new file, all green. If `.astro/` files churn, restore with `git checkout -- .astro/`.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/recover-posts.mjs scripts/lib/recover-posts.test.mjs vitest.config.ts
git commit -m "feat: add blog recovery library with tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Recovery orchestrator — scrape, recover images, write seed

**Files:**
- Create: `scripts/recover-blog-posts.mjs`
- Output (committed): `supabase/seed/2026-07-12-recovered-posts.sql`, `supabase/seed/2026-07-12-recovery-report.md`, `supabase/seed/images/*` (whatever Wayback yields)

**Interfaces:**
- Consumes: every export listed in Task 4's Produces block, imported from `./lib/recover-posts.mjs`.
- Produces: the seed SQL file (applied in Task 7), the images directory (uploaded in Task 9), and the report (read by the controller and Charlie).

- [ ] **Step 1: Write the orchestrator**

Create `scripts/recover-blog-posts.mjs`:

```js
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
```

- [ ] **Step 2: Run it**

Run: `node scripts/recover-blog-posts.mjs`
Expected: `rss: 10 posts`, ten `post: <slug>` lines, image lines, and a final `done: 10 posts, N/M images recovered`. Wayback misses are expected and handled; do not treat `image lost` lines as failures.

- [ ] **Step 3: Sanity-check the outputs**

```bash
grep -c "insert into public.blog_drafts" supabase/seed/2026-07-12-recovered-posts.sql
```
Expected: `10`.

```bash
grep -c "cgippqarwcizzrwqfjot" supabase/seed/2026-07-12-recovered-posts.sql || true
```
Expected: `0` (all old-host references rewritten or stripped).

```bash
cat supabase/seed/2026-07-12-recovery-report.md
```
Expected: 10 posts listed, each with content length over 1000 chars. If any post shows a suspiciously short content length (under 500 chars), STOP and report DONE_WITH_CONCERNS naming the slug.

- [ ] **Step 4: Run the test suite**

Run: `pnpm test`
Expected: all green (the orchestrator has no tests; this guards against accidental lib edits).

- [ ] **Step 5: Commit**

```bash
git add scripts/recover-blog-posts.mjs supabase/seed/
git commit -m "feat: recover published posts and images from the live site

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: CHECKPOINT — Charlie creates the admin user and disables signups

**Controller task, not a subagent dispatch.** Message Charlie:

1. Dashboard -> Authentication -> Users -> Add user: an email he will log in with, a strong password, tick auto-confirm.
2. Dashboard -> Authentication -> Sign In / Providers -> Email: disable new user signups ("Allow new users to sign up" OFF). The admin gate trusts any authenticated user, so this is the security boundary.

When he confirms, verify via `mcp__supabase__execute_sql`:

```sql
select count(*) as users, min(email) as email from auth.users;
```

Expected: `users = 1`, email as he stated. Do not proceed to Task 7 until this returns 1.

---

### Task 7: Apply the seed and verify the content

**Files:**
- Read: `supabase/seed/2026-07-12-recovered-posts.sql` (from Task 5)
- No repo modifications.

**Interfaces:**
- Consumes: seed SQL (Task 5), one auth user (Task 6), `blog_drafts` + partial unique index (Tasks 1-2).
- Produces: 10 published rows in `blog_drafts`, relied on by Task 10's build.

- [ ] **Step 1: Apply the seed**

Read `supabase/seed/2026-07-12-recovered-posts.sql` and run its full contents through `mcp__supabase__execute_sql` in one call.

Expected: success. If it raises `expected exactly 1 auth user`, Task 6 is incomplete; stop and report BLOCKED.

- [ ] **Step 2: Verify counts and slugs**

```sql
select count(*) as published from public.blog_drafts where status = 'published';
```
Expected: `10`.

```sql
select slug, featured, category, length(content) as content_chars,
       published_at is not null as has_pub, user_id is not null as has_user
from public.blog_drafts order by published_at desc;
```
Expected: 10 rows; every `content_chars` > 1000; every `has_pub` and `has_user` true; category values drawn only from the six slugs in Global Constraints; slugs matching the live site's ten post URLs.

- [ ] **Step 3: Verify no dead-host residue**

```sql
select count(*) as dead from public.blog_drafts
where content like '%cgippqarwcizzrwqfjot%'
   or coalesce(cover_image, '') like '%cgippqarwcizzrwqfjot%';
```
Expected: `0`.

- [ ] **Step 4: Verify idempotency**

Re-run the full seed SQL once more, then:

```sql
select count(*) from public.blog_drafts;
```
Expected: still `10` (the `on conflict` arbiter absorbed the duplicates).

- [ ] **Step 5: Report**

No commit. Report the verbatim query outputs.

---

### Task 8: CHECKPOINT — env rewiring (Charlie)

**Controller task, not a subagent dispatch.**

1. Fetch the anon key via `mcp__supabase__get_publishable_keys` (use the legacy anon key if the code's `createClient` gets a JWT-style key today; hand Charlie whichever key type is enabled).
2. Message Charlie the exact values to set, in BOTH local `.env` and Vercel project env:
   - `PUBLIC_SUPABASE_URL` = `https://tgyrlohcvmtjklmajuhk.supabase.co`
   - `PUBLIC_SUPABASE_ANON_KEY` = (the key fetched above)
   - `SUPABASE_SERVICE_ROLE_KEY` = from Dashboard -> Settings -> API keys (only he can see it)
   - If `SUPABASE_URL` or `SUPABASE_SECRET_KEY` exist anywhere (local or Vercel), update them to the new project or remove them; `src/lib/blog.ts` prefers them over the PUBLIC_ variants.
3. Remind him NOT to push yet; pushing deploys.

Wait for his confirmation that local `.env` is updated before Task 9. Vercel env must be done before he pushes (post-plan).

---

### Task 9: Upload recovered images

**Files:**
- Create: `scripts/upload-recovered-images.mjs`

**Interfaces:**
- Consumes: `supabase/seed/images/*` (Task 5), `blog-images` bucket (Task 2), updated local `.env` (Task 8).
- Produces: every recovered image serving 200 from `https://tgyrlohcvmtjklmajuhk.supabase.co/storage/v1/object/public/blog-images/<filename>`.

**If Task 5's report shows zero recovered images:** still create and commit the script (Charlie can reuse it after manually dropping originals into `supabase/seed/images/`), run it to confirm the graceful empty-directory path, and note "no images to upload" in the report.

- [ ] **Step 1: Write the upload script**

Create `scripts/upload-recovered-images.mjs`:

```js
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
```

- [ ] **Step 2: Run it**

Run: `node --env-file=.env scripts/upload-recovered-images.mjs`
Expected: one `ok: https://tgyrlohcvmtjklmajuhk...` line per file in `supabase/seed/images/`, exit code 0. (Or `no recovered images to upload` if Wayback yielded nothing.)

- [ ] **Step 3: Commit**

```bash
git add scripts/upload-recovered-images.mjs
git commit -m "feat: add recovered-image upload script

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Full local verification and fidelity check

**Files:** none created (verification only). Requires Tasks 7-9 complete and local `.env` pointing at the new project.

- [ ] **Step 1: Test suite**

Run: `pnpm test`
Expected: all green (91 original tests plus Task 4's file). Restore `.astro/` churn if any: `git checkout -- .astro/`.

- [ ] **Step 2: Full production build**

Run: `pnpm build`
Expected: succeeds. This is the first successful local build since the fail-loud hardening; `getPublishedPosts` now returns the 10 seeded posts. If it fails at the blog fetch, `.env` or the seed is wrong; report BLOCKED with the error verbatim.

- [ ] **Step 3: Deferred build checks from the elevation ledger**

Open `.superpowers/sdd/progress.md`, find the deferred build-check list recorded there, and run each check against the fresh build output (they cover sitemap-0.xml entries with per-post lastmod, and grep checks over the built dist/output). Report each check's command and verbatim result.

- [ ] **Step 4: Fidelity check on one post**

Compare the recovered content against the live article body for the Football IQ case study:

```bash
BUILT=$(find .vercel/output/static dist -path "*how-we-grew-football-iq*" -name "*.html" 2>/dev/null | head -1)
echo "built file: $BUILT"
curl -sL https://camberco.co.uk/blog/how-we-grew-football-iq-organic-traffic-400-percent/ > /tmp/live-post.html
node --input-type=module -e "
import { readFile } from 'node:fs/promises';
import { extractArticleBody, stripProcessingArtifacts, rewriteStorageHost } from './scripts/lib/recover-posts.mjs';
const norm = (h) => rewriteStorageHost(stripProcessingArtifacts(extractArticleBody(h))).replace(/\s+/g, ' ').trim();
const live = norm(await readFile('/tmp/live-post.html', 'utf8'));
const built = norm(await readFile(process.argv[1], 'utf8'));
console.log('live chars:', live.length, 'built chars:', built.length);
console.log(live === built ? 'MATCH' : 'MISMATCH');
if (live !== built) {
  for (let i = 0; i < Math.min(live.length, built.length); i++) {
    if (live[i] !== built[i]) { console.log('first divergence at', i); console.log('live:  ...' + live.slice(Math.max(0,i-60), i+60)); console.log('built: ...' + built.slice(Math.max(0,i-60), i+60)); break; }
  }
}
" "$BUILT"
```

Expected: `MATCH`. **Acceptable mismatch:** if the recovery report says images were stripped from this post, the built side lacks those img tags; confirm the divergence shown is exactly a stripped image and report DONE_WITH_CONCERNS quoting the divergence. Any other mismatch is a failure; report BLOCKED.

- [ ] **Step 5: Report**

No commit. Report: test summary, build result, each deferred check's output, fidelity verdict.

---

### Task 11: Advisors and wrap-up

**Files:** none.

- [ ] **Step 1: Security advisors**

Run `mcp__supabase__get_advisors` with type `security`.
Expected: no errors about RLS being disabled on public tables and no function search_path warnings for `bump_rate_limit`. Auth warnings that require dashboard toggles (e.g. leaked-password protection) are report-only: list them verbatim with their remediation URLs; do not attempt to fix.

- [ ] **Step 2: Performance advisors**

Run `mcp__supabase__get_advisors` with type `performance`.
Expected: nothing beyond info-level notices on a near-empty database. List anything found verbatim.

- [ ] **Step 3: Final state summary**

Report, in one block: migration list (`mcp__supabase__list_migrations`), published post count, storage bucket state, advisor findings, and the outstanding Charlie actions (Vercel env if not yet done, then push main, then live smoke tests per the existing runbook).

---

## Post-plan (outside this plan's scope)

Merged via superpowers:finishing-a-development-branch as usual. Charlie then: Vercel env (if not already done in Task 8) -> push main (deploys) -> live signup + enquiry smoke tests in Resend logs -> flip Vercel primary domain to apex if still pending -> resubmit sitemap in Search Console.
