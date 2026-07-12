# Database Rebuild Design

**Date:** 2026-07-12
**Status:** Approved by Charlie (approach A, recovery plan, dashboard actions)

## Context

The production Supabase project (`cgippqarwcizzrwqfjot`) is lost. A fresh, empty project exists and is reachable via MCP: `https://tgyrlohcvmtjklmajuhk.supabase.co`. The site's last deploy predates the loss, so the 10 published blog posts are still rendered on https://camberco.co.uk and are recoverable by scraping our own pages. Post images are NOT recoverable from the live site: they point at the dead project's storage host and are already broken.

The code on local `main` (71 unpushed commits from the July 2026 site elevation) is the source of truth for the schema. A five-agent audit (workflow `wf_2631c189-ba6`) inventoried every table, column, RPC, auth call, storage call, and env var with file:line evidence; a completeness critic verified no gaps.

Decisions made by Charlie:
- Recover blog posts from the live site. Start clean (empty) on subscribers, enquiries, rate_limits.
- Approach A: apply the four committed migration files verbatim, plus one new gap-filling migration.

## Goal

The new Supabase project fully supports the code on local `main`: schema, RPC, storage, auth, and recovered blog content — verified end to end — so Charlie can update env vars and push main to deploy.

## Schema

### Existing migrations, applied verbatim in filename order

1. `supabase/migrations/20260317_create_enquiries.sql` — `enquiries` (id, name, email, company, service, message, source CHECK form|bot, chat_transcript jsonb, status CHECK new|contacted|booked|closed DEFAULT 'new', created_at, updated_at). RLS enabled, no policies (service-role only).
2. `supabase/migrations/20260710090000_create_subscribers.sql` — `subscribers` (id, email, confirmed DEFAULT false, unsubscribe_token DEFAULT gen_random_uuid()::text, created_at, status DEFAULT 'active', unsubscribed_at, last_sent_at). Unique indexes on email and unsubscribe_token. RLS enabled, no policies.
3. `supabase/migrations/20260710090001_create_blog_drafts.sql` — `blog_drafts` (id, user_id uuid NOT NULL, title, slug, description, author DEFAULT 'Charlie', category DEFAULT 'ai-strategy', tags jsonb DEFAULT '[]', cover_image, cover_image_alt, content, status CHECK draft|published DEFAULT 'draft', featured DEFAULT false, published_at, created_at, updated_at). Index on (status, published_at DESC). RLS enabled, no policies. This table holds BOTH drafts and published posts.
4. `supabase/migrations/20260710090002_create_rate_limits.sql` — `rate_limits` (key text PK, count, window_started_at) plus `bump_rate_limit(p_key text, p_limit integer, p_window_minutes integer) returns boolean`, SECURITY DEFINER, search_path pinned, EXECUTE granted to service_role only.

### New migration: `supabase/migrations/20260712100000_create_blog_images_bucket.sql`

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
-- be unique. Partial index only — drafts share the default '' slug.
create unique index if not exists blog_drafts_published_slug_key
  on public.blog_drafts (slug)
  where status = 'published';
```

Migrations are applied through the Supabase MCP `apply_migration` tool so they are recorded in the project's migration history under matching names.

## Auth

The admin area is a single Supabase Auth user. Every `/api/admin/*` route and `/api/enquiries` GET/PATCH validates a Bearer JWT with `supabase.auth.getUser()`; `src/middleware.ts` validates the `camber-admin-token` cookie the same way. The gate trusts ANY authenticated user, so:

- **Charlie (dashboard):** create one admin user (Auth → Add user, email confirmed) with an email he will log in with, and **disable public signups** (Auth providers → Email → turn off new-user signups / "Allow new users to sign up"). Both must be done before go-live; the user must exist **before post seeding** because `blog_drafts.user_id` is NOT NULL.
- Seeded posts use `user_id = (select id from auth.users)`. Precondition, enforced in the seed script: exactly one row in `auth.users`; abort with a clear message otherwise.

## Content recovery

Sources (all already verified reachable):

| Field | Source |
|---|---|
| slug | post URL path (10 URLs from /blog and rss.xml) |
| title | RSS item title (fallback: page h1) |
| description | RSS item description |
| published_at | RSS pubDate |
| updated_at | sitemap lastmod for the post URL |
| category | RSS categories cross-checked against live `/blog/category/<slug>` URLs for the exact DB slug values |
| tags | remaining RSS categories after removing the category label |
| content | article body HTML scraped from the rendered post page |
| featured | which post the blog index renders in the featured slot; if the layout does not clearly distinguish one, all posts get featured=false (the blog index handles zero featured posts) |
| author | as rendered live ("Charlie W") |
| status | 'published' for all 10 |

The extraction runs as a script that writes `supabase/seed/2026-07-12-recovered-posts.sql` (idempotent: `on conflict do nothing` against the published-slug unique index). The seed file is committed to the repo so the recovery is inspectable and re-runnable, then applied via MCP `execute_sql`.

Content fidelity check: after seeding and env rewiring, one recovered post rendered by local `astro dev` is diffed against the live page's article body.

### Image recovery

All image URLs in content and cover fields point at `https://cgippqarwcizzrwqfjot.supabase.co/storage/v1/object/public/blog-images/<uuid>.<ext>` (dead host). Pipeline:

1. Collect every such URL across the 10 posts (content `img src` + `cover_image` + any srcset).
2. For each, query the Wayback Machine availability API and download the latest snapshot if one exists.
3. Re-upload recovered files to the new `blog-images` bucket under the **same filename** (service-role upload).
4. Rewrite the host in `content` and `cover_image` from the dead project URL to `https://tgyrlohcvmtjklmajuhk.supabase.co` for recovered images.
5. Unrecoverable images: remove the enclosing `<img>`/`<figure>` element from content (set `cover_image`/`cover_image_alt` to null if it is the cover), and report the full list to Charlie — he may hold originals locally and can re-upload through the admin editor.

## Env rewiring

From the audit, the Supabase-related env var names the code reads:

| Variable | New value | Who sets it |
|---|---|---|
| `PUBLIC_SUPABASE_URL` | `https://tgyrlohcvmtjklmajuhk.supabase.co` | Charlie: Vercel + local `.env` |
| `PUBLIC_SUPABASE_ANON_KEY` | anon/publishable key (I fetch via MCP and hand over) | Charlie: Vercel + local `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | service-role secret (dashboard → API keys; only Charlie can see it) | Charlie: Vercel + local `.env` |
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | optional aliases preferred by `src/lib/blog.ts`; not required (fallbacks exist). If present anywhere, update or remove them. | Charlie |

Unchanged: `RESEND_API_KEY`, `VERCEL_DEPLOY_HOOK`, `OPENAI_API_KEY`, `OPENAI_MODEL`. Already fixed by Charlie: `.mcp.json` `SUPABASE_ACCESS_TOKEN`.

Secrets discipline: I never read `.env` values. Charlie edits `.env` and Vercel himself; I provide the exact variable names and where each value comes from.

## Verification (acceptance criteria)

1. `list_tables` (verbose) shows the 4 tables with every column the audit inventoried.
2. Supabase security + performance advisors: no unresolved errors (RLS enabled on all 4 tables, `bump_rate_limit` search_path pinned).
3. `bump_rate_limit` exercised via `execute_sql`: returns true up to the limit, false past it, resets after the window; test rows deleted afterwards.
4. `select count(*) from blog_drafts where status='published'` returns 10; slugs byte-identical to the live URL paths.
5. Storage: `blog-images` bucket exists, public; recovered images (if any) serve 200 from the new public URL.
6. After Charlie updates local `.env`: `pnpm build` succeeds (first successful local build since fail-loud hardening) — this also clears the deferred build-check sweep from the elevation ledger (`.superpowers/sdd/progress.md`): sitemap-0.xml lastmod entries, dist grep checks.
7. `pnpm test` still green (91 tests; none touch the live DB).
8. One recovered post rendered locally matches the live article body.

## Ordering constraints

1. Schema migrations: immediately (no dependencies).
2. Charlie creates the admin user → then post seeding (user_id NOT NULL).
3. Charlie disables public signups: before go-live.
4. Charlie updates local `.env` → then local build verification.
5. Charlie updates Vercel env → **then** push main (pushing deploys; deploying against the old env fails at the blog fetch, by design).
6. After deploy: live signup + enquiry smoke tests (Resend logs), per the existing runbook.

## Out of scope

- Recreating subscribers/enquiries data (Charlie chose clean start).
- The post-merge cleanup list from the elevation review (separate PR).
- Any schema hardening beyond the partial slug index (no new columns, no RLS policy redesign — the service-role-only model is what the code expects).

## Branch strategy

Implementation work (new migration file, recovery script, seed file) happens on a branch `database-rebuild` off local `main`, merged the same way as the elevation branch. Database-side actions (apply_migration, execute_sql) are inherently live but are additive and idempotent on an empty project.
