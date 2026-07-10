# Foundations: Shared Data + Complete Email System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox ('- [ ]') syntax for tracking.

**Goal:** Create the shared data modules (site constants, services, projects), durable Supabase-backed rate limiting, checked-in migrations, and a complete, reliable email system (waitUntil on every send, reply-to, welcome + owner-alert emails, batch digest with one-click unsubscribe, soft-delete unsubscribe) so no lead or subscriber is ever silently lost.

**Architecture:** Pure TypeScript data modules under `src/lib/` and `src/data/` feed every later plan; all Resend sends live in `src/lib/email.ts` and are wrapped in `waitUntil` from `@vercel/functions` at each API call site; rate limiting moves from per-instance in-memory maps to a `public.rate_limits` table mutated atomically by a Postgres function. Confirm/unsubscribe become GET-renders-button, POST-mutates endpoints so scanner prefetch can never corrupt state.

**Tech Stack:** Astro 5 (server output, @astrojs/vercel adapter), Supabase (service-role from API routes), Resend 6 (single + batch send), @vercel/functions, Vitest, pnpm.

## Global Constraints

- pnpm only
- Astro 5
- British English copy, short sentences, NO em dashes anywhere in site copy
- prices exactly as the contract table
- every animation respects prefers-reduced-motion with a static fallback
- all Resend sends wrapped in waitUntil from @vercel/functions
- free 30-minute audit call is never conflated with the paid £750 AI Readiness Audit
- commit messages end with "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"

## Context for a zero-context executor

- Repo root: `/Users/charlie/workspace/camber-co`. All paths below are relative to it.
- The site is Astro 5 with `output` defaulting to server via `@astrojs/vercel` (see `astro.config.mjs`). API routes live in `src/pages/api/` and set `export const prerender = false;`.
- API routes talk to Supabase with the service-role key via a local `serverSupabase()` helper duplicated per file (see `src/pages/api/enquiries.ts:7-11`). Leave that duplication alone; it is not this plan's job.
- `src/lib/blog.ts` exports a shared `serverSupabase()` used for blog reads. `src/lib/email.ts` holds all Resend senders.
- There is no test runner yet (`package.json` has no test script, no vitest).
- `src/data/` does not exist yet.
- Existing migration style: `supabase/migrations/20260317_create_enquiries.sql` (lowercase SQL, RLS enabled, no policies because API routes use the service-role key which bypasses RLS). Follow it.
- Local `.env` exists (dev and build work locally). `.env.example` currently only lists the two OpenAI vars.
- Em dash rule: none of the strings written in this plan contain `—` (U+2014). Tests enforce this for the data modules. Keep it that way in any copy you adjust.

### Task overview

1. Vitest setup
2. `src/lib/site.ts`
3. `src/data/services.ts`
4. `src/data/projects.ts`
5. Migrations: `subscribers`, `blog_drafts`, `rate_limits`
6. `src/lib/rate-limit.ts` (TDD)
7. Wire durable rate limiting into enquiries, subscribe, chat
8. Email library overhaul (constants, reply-to, new senders, batch digest)
9. waitUntil reliability: enquiries, subscribe, publish
10. Confirm/unsubscribe GET-to-button-POST + welcome/alert wiring
11. Chat enquiry validation + chat email reliability
12. `.env.example` completion

---

### Task 1: Vitest setup

**Files:**
- Modify: `package.json` (scripts block, lines 6-10; devDependencies, lines 41-45)
- Create: `vitest.config.ts`
- Create: `src/lib/smoke.test.ts` (temporary, deleted in Task 2)

**Interfaces:**
- Produces: `pnpm vitest run` and `pnpm test` as the repo's test commands. Tests are colocated as `src/**/*.test.ts`.

**Steps:**

- [ ] Install vitest:
  ```bash
  pnpm add -D vitest
  ```
- [ ] Create `vitest.config.ts` at the repo root:
  ```ts
  import { defineConfig } from 'vitest/config';

  export default defineConfig({
    test: {
      include: ['src/**/*.test.ts'],
    },
  });
  ```
- [ ] Add a `test` script to `package.json`. In the `"scripts"` block (currently lines 6-10) add after `"preview"`:
  ```json
  "preview": "astro preview",
  "test": "vitest run"
  ```
- [ ] Create `src/lib/smoke.test.ts` proving the runner works:
  ```ts
  import { describe, expect, it } from 'vitest';

  describe('vitest runner', () => {
    it('runs colocated tests under src/', () => {
      expect(1 + 1).toBe(2);
    });
  });
  ```
- [ ] Run `pnpm vitest run`. Expected: `1 passed` (1 test file).
- [ ] Run `pnpm build`. Expected: success (vitest config must not break the Astro build).
- [ ] Commit:
  ```bash
  git add package.json pnpm-lock.yaml vitest.config.ts src/lib/smoke.test.ts
  git commit -m "Add vitest test runner" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 2: src/lib/site.ts

**Files:**
- Create: `src/lib/site.ts`
- Test: `src/lib/site.test.ts`
- Delete: `src/lib/smoke.test.ts`

**Interfaces:**
- Produces (binding contract, consumed by Plans 2-5):
  - `export const SITE_URL = 'https://camberco.co.uk'`
  - `export const BOOKING_URL: string | null = null`
  - `export const AUDIT_CTA_LABEL = 'Book a free 30-minute audit'`
  - `export const COMPANY_NUMBER: string | null = null` (rendered on /privacy only when set; contract addition requested by Plan 3)

**Steps:**

- [ ] Write the failing test `src/lib/site.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { AUDIT_CTA_LABEL, BOOKING_URL, SITE_URL } from './site';

  describe('site constants', () => {
    it('uses the apex domain with no trailing slash', () => {
      expect(SITE_URL).toBe('https://camberco.co.uk');
    });

    it('routes audit CTAs to /contact until the Cal.com URL exists', () => {
      expect(BOOKING_URL).toBeNull();
    });

    it('labels the audit CTA as the free 30-minute audit', () => {
      expect(AUDIT_CTA_LABEL).toBe('Book a free 30-minute audit');
    });
  });
  ```
- [ ] Run `pnpm vitest run`. Expected failure: `Cannot find module './site'` (or `Failed to resolve import "./site"`).
- [ ] Create `src/lib/site.ts`:
  ```ts
  // Single source of truth for site-wide URLs and CTA labels.
  // Consumed by Layout, Nav, Footer, CTA components, email templates and JSON-LD.

  export const SITE_URL = 'https://camberco.co.uk';

  // Becomes the Cal.com booking URL when Charlie supplies it.
  // CTA components: when BOOKING_URL is null, audit CTAs link to /contact.
  export const BOOKING_URL: string | null = null;

  // The free 30-minute audit call. Never conflate with the paid AI Readiness Audit.
  export const AUDIT_CTA_LABEL = 'Book a free 30-minute audit';

  // Companies House number, shown on /privacy once Charlie supplies it.
  export const COMPANY_NUMBER: string | null = null;
  ```
- [ ] Delete the temporary smoke test:
  ```bash
  rm src/lib/smoke.test.ts
  ```
- [ ] Run `pnpm vitest run`. Expected: `3 passed`.
- [ ] Commit:
  ```bash
  git add src/lib/site.ts src/lib/site.test.ts
  git rm --cached src/lib/smoke.test.ts 2>/dev/null; git add -u
  git commit -m "Add shared site constants module" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 3: src/data/services.ts

**Files:**
- Create: `src/data/services.ts`
- Test: `src/data/services.test.ts`

**Interfaces:**
- Produces (binding contract, consumed by homepage cards, /services grid, contact chips, chat drawer, JSON-LD in Plans 2-4):
  - `export type Service = { slug: string; title: string; href: string; fromPrice: string; blurb: string; chat: string }`
  - `export const services: Service[]` (seven entries, exact order and prices below)

**Steps:**

- [ ] Write the failing test `src/data/services.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { services } from './services';

  describe('services data', () => {
    it('has exactly seven services in the agreed order', () => {
      expect(services.map((s) => s.slug)).toEqual([
        'automation',
        'builds',
        'apps',
        'consultations',
        'seo',
        'training',
        'personal-ai',
      ]);
    });

    it('uses the exact contract titles', () => {
      expect(services.map((s) => s.title)).toEqual([
        'Workflow automation',
        'Website builds',
        'Mobile apps',
        'AI consultations',
        'SEO services',
        'Training & coaching',
        'Personal AI',
      ]);
    });

    it('uses the exact contract prices', () => {
      expect(services.map((s) => s.fromPrice)).toEqual([
        'from £1,200',
        'from £2,500',
        'from £4,500',
        '£297 per session',
        'from £750',
        'from £197',
        'from £497',
      ]);
    });

    it('links every service to its own page', () => {
      for (const s of services) {
        expect(s.href).toBe(`/services/${s.slug}`);
      }
    });

    it('has a non-empty blurb and chat key for every service', () => {
      for (const s of services) {
        expect(s.blurb.length).toBeGreaterThan(0);
        expect(s.chat.length).toBeGreaterThan(0);
      }
    });

    it('contains no em dashes anywhere', () => {
      expect(JSON.stringify(services)).not.toContain('—');
    });
  });
  ```
- [ ] Run `pnpm vitest run`. Expected failure: `Failed to resolve import "./services"`.
- [ ] Create `src/data/services.ts` (final copy, British English, no em dashes):
  ```ts
  // Single source of truth for every service surface:
  // homepage cards, /services grid, contact chips, chat drawer prompts and JSON-LD offers.
  // Titles and prices are contractual. Do not edit them without updating the schema too.

  export type Service = {
    slug: string;
    title: string;
    href: string;
    fromPrice: string;
    blurb: string;
    chat: string;
  };

  export const services: Service[] = [
    {
      slug: 'automation',
      title: 'Workflow automation',
      href: '/services/automation',
      fromPrice: 'from £1,200',
      blurb: 'n8n workflows that connect your tools and do the repetitive work. Most clients get 10-30 hours a month back.',
      chat: 'automation',
    },
    {
      slug: 'builds',
      title: 'Website builds',
      href: '/services/builds',
      fromPrice: 'from £2,500',
      blurb: 'Fast, findable websites that make the offer obvious. Designed, built and shipped end to end.',
      chat: 'builds',
    },
    {
      slug: 'apps',
      title: 'Mobile apps',
      href: '/services/apps',
      fromPrice: 'from £4,500',
      blurb: 'From idea to App Store without hiring a dev team. React Native or SwiftUI, shipped for real.',
      chat: 'apps',
    },
    {
      slug: 'consultations',
      title: 'AI consultations',
      href: '/services/consultations',
      fromPrice: '£297 per session',
      blurb: 'A 60-minute session with an AI consultant who builds. Leave with a prioritised plan, not a slide deck.',
      chat: 'consultations',
    },
    {
      slug: 'seo',
      title: 'SEO services',
      href: '/services/seo',
      fromPrice: 'from £750',
      blurb: 'Technical SEO and content that gets small businesses found. Built into the site, not bolted on.',
      chat: 'seo',
    },
    {
      slug: 'training',
      title: 'Training & coaching',
      href: '/services/training',
      fromPrice: 'from £197',
      blurb: 'Hands-on AI coaching for founders and teams. Practical skills you can use the same day.',
      chat: 'training',
    },
    {
      slug: 'personal-ai',
      title: 'Personal AI',
      href: '/services/personal-ai',
      fromPrice: 'from £497',
      blurb: 'Your own AI assistant, set up on your accounts and your data. Private by default.',
      chat: 'personal-ai',
    },
  ];
  ```
- [ ] Run `pnpm vitest run`. Expected: all pass (site + services suites).
- [ ] Commit:
  ```bash
  git add src/data/services.ts src/data/services.test.ts
  git commit -m "Add shared services data module" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 4: src/data/projects.ts

**Files:**
- Create: `src/data/projects.ts`
- Test: `src/data/projects.test.ts`

**Interfaces:**
- Produces (binding contract, consumed by /work, about-me.astro, services/apps.astro, services/builds.astro, about-terminal.ts in Plan 3):
  - `export type Project` exactly as below
  - `export const projects: Project[]` (eight entries)
- Copy source: taglines/stories adapted from `src/pages/about-me.astro:135-186` (the existing `projects` array) with em dashes removed and tech naming standardised on Supabase.

**Steps:**

- [ ] Write the failing test `src/data/projects.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { projects } from './projects';

  const STATUSES = ['live', 'in-submission', 'in-development', 'open-source', 'professional-work'];
  const DIVISIONS = ['camber-builds', 'professional-credential'];

  describe('projects data', () => {
    it('has exactly eight projects', () => {
      expect(projects).toHaveLength(8);
    });

    it('has unique slugs covering the agreed set', () => {
      expect(projects.map((p) => p.slug).sort()).toEqual([
        'ai-native-qa',
        'bio-core',
        'clippin',
        'football-iq',
        'gazzetta-ai-predictor',
        'jodz',
        'oddschecker-plus',
        'whoscored-plus',
      ]);
    });

    it('only uses valid statuses and divisions', () => {
      for (const p of projects) {
        expect(STATUSES).toContain(p.status);
        expect(DIVISIONS).toContain(p.division);
      }
    });

    it('marks Football IQ live with the storefront-neutral App Store link', () => {
      const fiq = projects.find((p) => p.slug === 'football-iq');
      expect(fiq?.status).toBe('live');
      expect(fiq?.division).toBe('camber-builds');
      expect(fiq?.links.appStore).toBe('https://apps.apple.com/app/id6757344691');
    });

    it('links ClipPin to GitHub as open source', () => {
      const clippin = projects.find((p) => p.slug === 'clippin');
      expect(clippin?.status).toBe('open-source');
      expect(clippin?.links.github).toBe('https://github.com/charliearlie/ClipPin');
    });

    it('files professional work under professional-credential', () => {
      for (const slug of ['whoscored-plus', 'oddschecker-plus', 'gazzetta-ai-predictor', 'ai-native-qa']) {
        const p = projects.find((x) => x.slug === slug);
        expect(p?.status).toBe('professional-work');
        expect(p?.division).toBe('professional-credential');
      }
    });

    it('ships no metrics until Charlie approves numbers', () => {
      for (const p of projects) {
        expect(p.metrics).toEqual([]);
      }
    });

    it('has a tagline, story and tech list for every project', () => {
      for (const p of projects) {
        expect(p.tagline.length).toBeGreaterThan(0);
        expect(p.story.length).toBeGreaterThan(0);
        expect(p.tech.length).toBeGreaterThan(0);
      }
    });

    it('contains no em dashes anywhere', () => {
      expect(JSON.stringify(projects)).not.toContain('—');
    });
  });
  ```
- [ ] Run `pnpm vitest run`. Expected failure: `Failed to resolve import "./projects"`.
- [ ] Create `src/data/projects.ts` (final copy; renderers must handle empty `screenshots`):
  ```ts
  // Single source of truth for every project surface:
  // /work, about-me, services/apps, services/builds and the about terminal.
  // metrics stays empty until Charlie approves numbers for publication.
  // screenshots paths live under /src/assets/projects/; renderers must handle empty arrays.

  export type Project = {
    slug: string;
    name: string;
    tagline: string;
    status: 'live' | 'in-submission' | 'in-development' | 'open-source' | 'professional-work';
    division: 'camber-builds' | 'professional-credential';
    links: { appStore?: string; github?: string; web?: string };
    tech: string[];
    metrics: { label: string; value: string }[];
    story: string;
    screenshots: string[];
    ogImage?: string;
  };

  export const projects: Project[] = [
    {
      slug: 'football-iq',
      name: 'Football IQ',
      tagline: 'Daily football trivia with 8+ game modes. AI-generated content nightly.',
      status: 'live',
      division: 'camber-builds',
      links: { appStore: 'https://apps.apple.com/app/id6757344691' },
      tech: ['React Native', 'Expo', 'Supabase', 'AI agents', 'PostHog', 'RevenueCat'],
      metrics: [],
      story:
        'A Wordle-style daily football trivia app with 8+ game modes: Career Path, Transfer Guess, Goalscorer Recall, Starting XI and more. Built with React Native and Expo on Supabase. An AI agent pipeline generates fresh puzzles nightly from real match data. Free for the last 7 days, with a one-time premium unlock for the growing archive.',
      screenshots: [],
    },
    {
      slug: 'jodz',
      name: 'Jodz',
      tagline: 'Privacy-first cashflow forecasting for iPhone and Mac.',
      status: 'in-submission',
      division: 'camber-builds',
      links: {},
      tech: ['Swift 6', 'SwiftUI', 'SwiftData', 'CloudKit'],
      metrics: [],
      story:
        'Jodz answers "where will my money be?" instead of "where did it go?". A single continuous timeline projects every bill, payday, subscription and scheduled event months ahead. Built end to end in Swift 6 and SwiftUI with SwiftData and a CloudKit private database. No third-party SDKs, no analytics, no tracking. Universal Purchase across iPhone and Mac with a Home Screen widget.',
      screenshots: [],
    },
    {
      slug: 'bio-core',
      name: 'bio-core',
      tagline: 'Specialist consumer e-commerce platform with AI support.',
      status: 'in-development',
      division: 'camber-builds',
      links: {},
      tech: ['Next.js 15', 'Supabase', 'WebGL', 'TanStack Query', 'Stripe'],
      metrics: [],
      story:
        'A high-performance specialist consumer e-commerce platform. Next.js 15, Supabase and Tailwind, with a custom WebGL aurora hero, a full admin dashboard for inventory, orders and content, and an AI-powered support chatbot with a configurable knowledge base. Adaptive performance tiering keeps it smooth from low-end Android to high-DPR desktop.',
      screenshots: [],
    },
    {
      slug: 'clippin',
      name: 'ClipPin',
      tagline: 'Open-source Mac clipboard history manager.',
      status: 'open-source',
      division: 'camber-builds',
      links: { github: 'https://github.com/charliearlie/ClipPin' },
      tech: ['Swift', 'macOS'],
      metrics: [],
      story:
        'A native Mac clipboard history manager, open source on GitHub. Built for the kind of person who copies twelve things in a row and needs them all back later.',
      screenshots: [],
    },
    {
      slug: 'whoscored-plus',
      name: 'WhoScored Plus',
      tagline: 'AI-assisted match analysis for one of the biggest football stats sites.',
      status: 'professional-work',
      division: 'professional-credential',
      links: {},
      tech: ['AI', 'Subscriptions', 'Sports Analytics'],
      metrics: [],
      story:
        'An AI-assisted analysis product shipped to the high-volume WhoScored audience. Part of a suite architected for rapid experimentation on pricing, bundles and content surfaces.',
      screenshots: [],
    },
    {
      slug: 'oddschecker-plus',
      name: 'Oddschecker Plus',
      tagline: 'AI-assisted analysis tools for the UK betting comparison leader.',
      status: 'professional-work',
      division: 'professional-credential',
      links: {},
      tech: ['AI', 'Subscriptions', 'Sports Analytics'],
      metrics: [],
      story:
        'AI-assisted analysis tools shipped to the Oddschecker audience. Charlie previously led the frontend rebrand of the Oddschecker website through an 800x traffic surge, so this is home turf.',
      screenshots: [],
    },
    {
      slug: 'gazzetta-ai-predictor',
      name: 'Gazzetta AI Predictor',
      tagline: 'AI match predictions for La Gazzetta dello Sport readers.',
      status: 'professional-work',
      division: 'professional-credential',
      links: {},
      tech: ['AI', 'Sports Analytics'],
      metrics: [],
      story:
        'An AI prediction product shipped to the readership of La Gazzetta dello Sport, one of the biggest sports titles in Europe. Built as part of a suite of AI-assisted sports analysis tools serving high-volume audiences.',
      screenshots: [],
    },
    {
      slug: 'ai-native-qa',
      name: 'AI-Native QA Systems',
      tagline: 'AI-driven browser automation with Playwright.',
      status: 'professional-work',
      division: 'professional-credential',
      links: {},
      tech: ['Playwright', 'AI Testing', 'Browser Automation', 'CI/CD'],
      metrics: [],
      story:
        'Playwright-based testing systems augmented with AI: tests that understand what they are looking at, not just what they are clicking. Built early as a productivity layer and shipped into production before most teams were paying attention.',
      screenshots: [],
    },
  ];
  ```
- [ ] Run `pnpm vitest run`. Expected: all pass.
- [ ] Commit:
  ```bash
  git add src/data/projects.ts src/data/projects.test.ts
  git commit -m "Add shared projects data module" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 5: Migrations for subscribers, blog_drafts and rate_limits

**Files:**
- Create: `supabase/migrations/20260710090000_create_subscribers.sql`
- Create: `supabase/migrations/20260710090001_create_blog_drafts.sql`
- Create: `supabase/migrations/20260710090002_create_rate_limits.sql`

**Interfaces:**
- Produces: `public.subscribers` gains `status`, `unsubscribed_at`, `last_sent_at`; `public.rate_limits` table plus atomic `public.bump_rate_limit(p_key text, p_limit integer, p_window_minutes integer) returns boolean`; `public.blog_drafts` documented as CREATE TABLE IF NOT EXISTS.
- Column derivation (every column the code touches):
  - `subscribers`: `email` (`src/pages/api/subscribe.ts:64-79`, upsert onConflict 'email'), `confirmed` (`subscribe.ts:66`, `confirm-subscription.ts:22`, `publish.ts:90`), `unsubscribe_token` (`subscribe.ts:78`, `confirm-subscription.ts:23`, `unsubscribe.ts:23`, `publish.ts:89`). New: `status`, `unsubscribed_at` (soft delete, Task 10), `last_sent_at` (digest tracking, Task 9).
  - `blog_drafts`: `id`, `user_id`, `title`, `slug`, `description`, `category`, `tags`, `cover_image`, `cover_image_alt`, `content`, `status`, `created_at`, `updated_at` (`src/pages/api/admin/drafts.ts:80-97`), `published_at` (`publish.ts:72`, `blog.ts:36`), `author` (`blog.ts:64`, `publish.ts:97`), `featured` (`blog.ts:69`).

**Steps:**

- [ ] Create `supabase/migrations/20260710090000_create_subscribers.sql`:
  ```sql
  -- Subscribers: newsletter list. Matches every column the code reads/writes,
  -- plus soft-delete + digest-tracking columns added by the elevation work.
  -- Idempotent: safe on the live database where the base table already exists.

  create table if not exists public.subscribers (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    confirmed boolean not null default false,
    unsubscribe_token text not null default gen_random_uuid()::text,
    created_at timestamptz not null default now()
  );

  alter table public.subscribers add column if not exists status text not null default 'active';
  alter table public.subscribers add column if not exists unsubscribed_at timestamptz;
  alter table public.subscribers add column if not exists last_sent_at timestamptz;

  create unique index if not exists subscribers_email_key on public.subscribers (email);
  create unique index if not exists subscribers_unsubscribe_token_key on public.subscribers (unsubscribe_token);

  -- RLS: service role only (API routes use the service role key, which bypasses RLS)
  alter table public.subscribers enable row level security;
  ```
- [ ] Create `supabase/migrations/20260710090001_create_blog_drafts.sql`:
  ```sql
  -- Blog drafts + published posts. Matches every column the code reads/writes:
  -- admin editor CRUD (src/pages/api/admin/drafts.ts), publish flow
  -- (src/pages/api/admin/publish.ts) and public reads (src/lib/blog.ts).
  -- Idempotent: safe on the live database where the table already exists.

  create table if not exists public.blog_drafts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null,
    title text not null default 'Untitled',
    slug text not null default '',
    description text not null default '',
    author text not null default 'Charlie',
    category text not null default 'ai-strategy',
    tags jsonb not null default '[]'::jsonb,
    cover_image text,
    cover_image_alt text,
    content text not null default '',
    status text not null default 'draft' check (status in ('draft', 'published')),
    featured boolean not null default false,
    published_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index if not exists blog_drafts_status_published_at_idx
    on public.blog_drafts (status, published_at desc);

  -- RLS: service role only (API routes use the service role key, which bypasses RLS)
  alter table public.blog_drafts enable row level security;
  ```
- [ ] Create `supabase/migrations/20260710090002_create_rate_limits.sql`:
  ```sql
  -- Durable rate limiting, replacing per-instance in-memory maps that reset on
  -- every cold start. One row per key (e.g. 'enquiries:1.2.3.4'). The
  -- bump_rate_limit function is atomic: insert-or-increment in one statement.

  create table if not exists public.rate_limits (
    key text primary key,
    count integer not null default 1,
    window_started_at timestamptz not null default now()
  );

  -- RLS: service role only (API routes use the service role key, which bypasses RLS)
  alter table public.rate_limits enable row level security;

  create or replace function public.bump_rate_limit(
    p_key text,
    p_limit integer,
    p_window_minutes integer
  ) returns boolean
  language plpgsql
  security definer
  set search_path = public
  as $$
  declare
    allowed boolean;
  begin
    insert into rate_limits as rl (key, count, window_started_at)
    values (p_key, 1, now())
    on conflict (key) do update
      set count = case
            when rl.window_started_at < now() - make_interval(mins => p_window_minutes)
              then 1
            else rl.count + 1
          end,
          window_started_at = case
            when rl.window_started_at < now() - make_interval(mins => p_window_minutes)
              then now()
            else rl.window_started_at
          end
    returning rl.count <= p_limit into allowed;
    return allowed;
  end;
  $$;

  revoke execute on function public.bump_rate_limit(text, integer, integer) from public;
  revoke execute on function public.bump_rate_limit(text, integer, integer) from anon;
  revoke execute on function public.bump_rate_limit(text, integer, integer) from authenticated;
  grant execute on function public.bump_rate_limit(text, integer, integer) to service_role;
  ```
- [ ] Apply the three migrations to the live Camber Co Supabase project. Prefer the Supabase MCP `apply_migration` tool (one call per file, name = filename without extension, query = file contents). Do not use `supabase db push` against the live project: it would also attempt the unrecorded `20260317_create_enquiries.sql`, whose `create table enquiries` has no IF NOT EXISTS and errors on the live database. Confirm you are targeting the Camber Co project, not another org's project, before applying. If the supabase-migration-safety skill is available, run it first.
- [ ] Verify by running this SQL against the project (MCP `execute_sql`, or `psql "$SUPABASE_DB_URL"` against the project's connection string):
  ```sql
  select column_name from information_schema.columns
  where table_schema = 'public' and table_name = 'subscribers'
  order by column_name;
  ```
  Expected: includes `status`, `unsubscribed_at`, `last_sent_at`. Then:
  ```sql
  select public.bump_rate_limit('migration-test:1', 5, 60);
  ```
  Expected: `true`. Clean up: `delete from public.rate_limits where key = 'migration-test:1';`
- [ ] Commit:
  ```bash
  git add supabase/migrations/20260710090000_create_subscribers.sql supabase/migrations/20260710090001_create_blog_drafts.sql supabase/migrations/20260710090002_create_rate_limits.sql
  git commit -m "Check in migrations for subscribers, blog_drafts and rate_limits" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 6: src/lib/rate-limit.ts (TDD)

**Files:**
- Create: `src/lib/rate-limit.ts`
- Test: `src/lib/rate-limit.test.ts`

**Interfaces:**
- Produces (binding contract): `export async function checkRateLimit(opts: { key: string; limit: number; windowMinutes: number }): Promise<boolean>` (true = allowed). A second optional injectable-client parameter is added for testing; single-argument calls match the contract exactly.
- Consumes: `public.bump_rate_limit` RPC (Task 5), `import.meta.env.PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.
- Behaviour: fails OPEN (returns true and logs) if the RPC errors or throws, so a Supabase outage never takes down forms or chat.

**Steps:**

- [ ] Write the failing test `src/lib/rate-limit.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { checkRateLimit, type RateLimitClient } from './rate-limit';

  function fakeClient(
    result: { data: unknown; error: { message: string } | null },
    calls: unknown[][] = [],
  ): RateLimitClient {
    return {
      rpc(fn: string, args: Record<string, unknown>) {
        calls.push([fn, args]);
        return Promise.resolve(result);
      },
    };
  }

  describe('checkRateLimit', () => {
    it('allows when the database says the count is within the limit', async () => {
      const allowed = await checkRateLimit(
        { key: 'enquiries:1.2.3.4', limit: 5, windowMinutes: 60 },
        fakeClient({ data: true, error: null }),
      );
      expect(allowed).toBe(true);
    });

    it('blocks when the database says the limit is exceeded', async () => {
      const allowed = await checkRateLimit(
        { key: 'enquiries:1.2.3.4', limit: 5, windowMinutes: 60 },
        fakeClient({ data: false, error: null }),
      );
      expect(allowed).toBe(false);
    });

    it('fails open when the rpc errors', async () => {
      const allowed = await checkRateLimit(
        { key: 'chat:1.2.3.4', limit: 30, windowMinutes: 60 },
        fakeClient({ data: null, error: { message: 'connection refused' } }),
      );
      expect(allowed).toBe(true);
    });

    it('fails open when the client throws', async () => {
      const throwing: RateLimitClient = {
        rpc() {
          return Promise.reject(new Error('network down'));
        },
      };
      const allowed = await checkRateLimit(
        { key: 'subscribe:1.2.3.4', limit: 5, windowMinutes: 60 },
        throwing,
      );
      expect(allowed).toBe(true);
    });

    it('passes the key, limit and window through to bump_rate_limit', async () => {
      const calls: unknown[][] = [];
      await checkRateLimit(
        { key: 'subscribe:9.9.9.9', limit: 5, windowMinutes: 60 },
        fakeClient({ data: true, error: null }, calls),
      );
      expect(calls).toEqual([
        ['bump_rate_limit', { p_key: 'subscribe:9.9.9.9', p_limit: 5, p_window_minutes: 60 }],
      ]);
    });
  });
  ```
- [ ] Run `pnpm vitest run`. Expected failure: `Failed to resolve import "./rate-limit"`.
- [ ] Create `src/lib/rate-limit.ts`:
  ```ts
  import { createClient } from '@supabase/supabase-js';

  // Minimal surface so tests can inject a fake without a real Supabase client.
  export interface RateLimitClient {
    rpc(
      fn: string,
      args: Record<string, unknown>,
    ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  }

  let cachedClient: RateLimitClient | null = null;

  function serviceClient(): RateLimitClient {
    if (!cachedClient) {
      const url = import.meta.env.PUBLIC_SUPABASE_URL ?? '';
      const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
      cachedClient = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
    }
    return cachedClient;
  }

  /**
   * Durable rate limit backed by public.rate_limits (see
   * supabase/migrations/20260710090002_create_rate_limits.sql).
   * Returns true when the request is allowed.
   * Fails OPEN on any database error: availability beats strictness here.
   *
   * Callers: /api/enquiries (5/60min), /api/subscribe (5/60min), /api/chat (30/60min).
   */
  export async function checkRateLimit(
    opts: { key: string; limit: number; windowMinutes: number },
    client: RateLimitClient = serviceClient(),
  ): Promise<boolean> {
    try {
      const { data, error } = await client.rpc('bump_rate_limit', {
        p_key: opts.key,
        p_limit: opts.limit,
        p_window_minutes: opts.windowMinutes,
      });
      if (error) {
        console.error('Rate limit check failed:', error.message);
        return true;
      }
      return data === true;
    } catch (err) {
      console.error('Rate limit check failed:', err);
      return true;
    }
  }
  ```
- [ ] Run `pnpm vitest run`. Expected: all pass (5 new tests).
- [ ] Commit:
  ```bash
  git add src/lib/rate-limit.ts src/lib/rate-limit.test.ts
  git commit -m "Add Supabase-backed durable rate limiting" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 7: Wire durable rate limiting into enquiries, subscribe and chat

**Files:**
- Modify: `src/pages/api/enquiries.ts` (delete lines 31-46, the in-memory map; change lines 64-68, the POST rate check)
- Modify: `src/pages/api/subscribe.ts` (delete lines 20-34; change lines 39-42)
- Modify: `src/pages/api/chat.ts` (delete lines 11-26; change lines 56-62)

**Interfaces:**
- Consumes: `checkRateLimit` from `src/lib/rate-limit.ts` (Task 6). Keys: `enquiries:${ip}` (5/60), `subscribe:${ip}` (5/60), `chat:${ip}` (30/60).

**Steps:**

- [ ] In `src/pages/api/enquiries.ts`: add the import after the existing email import (line 5):
  ```ts
  import { checkRateLimit } from '../../lib/rate-limit';
  ```
  Delete the whole in-memory block (lines 31-46: the `rateLimit` map, `RATE_LIMIT`, `RATE_WINDOW` and the local `checkRateLimit` function). Replace the top of `POST` (lines 65-68) with:
  ```ts
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const allowed = await checkRateLimit({ key: `enquiries:${ip}`, limit: 5, windowMinutes: 60 });
  if (!allowed) {
    return jsonRes({ error: 'Too many submissions. Please try again later.' }, 429);
  }
  ```
- [ ] In `src/pages/api/subscribe.ts`: add after line 5 (`import { Resend } from 'resend';`):
  ```ts
  import { checkRateLimit } from '../../lib/rate-limit';
  ```
  Delete lines 20-34 (map + local `checkRateLimit`). Replace the top of `POST` (lines 39-42) with:
  ```ts
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const allowed = await checkRateLimit({ key: `subscribe:${ip}`, limit: 5, windowMinutes: 60 });
  if (!allowed) {
    return jsonRes({ error: 'Too many requests. Please try again later.' }, 429);
  }
  ```
- [ ] In `src/pages/api/chat.ts`: add after line 3 (the chat-prompts import):
  ```ts
  import { checkRateLimit } from '../../lib/rate-limit';
  ```
  Delete lines 11-26 (the in-memory block including the comment `// In-memory rate limit (cost protection — resets on cold start)`). Replace the rate check inside `POST` (lines 56-62) with:
  ```ts
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const allowed = await checkRateLimit({ key: `chat:${ip}`, limit: 30, windowMinutes: 60 });
  if (!allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests. Try again later.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  ```
- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify no in-memory maps remain:
  ```bash
  grep -rn "new Map<string, { count" src/pages/api/ ; echo "exit: $?"
  ```
  Expected: no matches, exit 1.
- [ ] Verify all three endpoints use the shared limiter:
  ```bash
  grep -rn "checkRateLimit({ key" src/pages/api/
  ```
  Expected: three matches (enquiries, subscribe, chat) with limits 5, 5 and 30.
- [ ] Commit:
  ```bash
  git add src/pages/api/enquiries.ts src/pages/api/subscribe.ts src/pages/api/chat.ts
  git commit -m "Replace in-memory rate limits with durable Supabase-backed limiter" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 8: Email library overhaul

**Files:**
- Modify: `src/lib/email.ts` (full rewrite, current lines 1-171)
- Test: `src/lib/email.test.ts`

**Interfaces:**
- Produces (binding contract):
  - `export const FROM_EMAIL = 'Camber Co <noreply@camberco.co.uk>'`
  - `export const ADMIN_EMAIL = 'charlie@camberco.co.uk'`
  - `export const REPLY_TO = 'hello@camberco.co.uk'`
  - `export async function sendSubscriberAlert(subscriberEmail: string): Promise<void>`
  - `export async function sendWelcomeEmail(subscriberEmail: string, unsubscribeToken: string): Promise<void>`
  - `sendAdminNotification` / `sendSenderConfirmation` / `sendBlogDigest` keep their names and signatures, gain reply-to + batch + headers.
  - Extra exports used by later tasks and tests: `sendSubscribeConfirmation(subscriberEmail: string, unsubscribeToken: string): Promise<void>`, `buildDigestBatch(subscribers, post): DigestEmail[]`, `chunk<T>(items: T[], size: number): T[][]`.
- Consumes: `SITE_URL` from `src/lib/site.ts`, `serverSupabase` from `src/lib/blog.ts` (welcome email fetches the three latest published posts), Resend 6 (`replyTo`, `headers`, `resend.batch.send`, verified available in `node_modules/resend/dist/index.d.mts`).
- Error convention: single sends throw on Resend `{ error }` so callers' catch/allSettled logging fires; the digest logs per-batch and continues.

**Steps:**

- [ ] Write the failing test `src/lib/email.test.ts`:
  ```ts
  import { describe, expect, it } from 'vitest';
  import { FROM_EMAIL, REPLY_TO, buildDigestBatch, chunk } from './email';

  describe('chunk', () => {
    it('splits an array into batches of the given size', () => {
      const items = Array.from({ length: 250 }, (_, i) => i);
      expect(chunk(items, 100).map((b) => b.length)).toEqual([100, 100, 50]);
    });

    it('returns no batches for an empty array', () => {
      expect(chunk([], 100)).toEqual([]);
    });
  });

  describe('buildDigestBatch', () => {
    const post = {
      title: 'Automate the boring bits',
      slug: 'automate-the-boring-bits',
      description: 'Practical automation for small teams.',
      author: 'Charlie',
    };
    const subs = [
      { email: 'a@example.com', unsubscribe_token: 'tok-a' },
      { email: 'b@example.com', unsubscribe_token: 'tok-b' },
    ];

    it('builds one email per subscriber with from, replyTo and subject set', () => {
      const batch = buildDigestBatch(subs, post);
      expect(batch).toHaveLength(2);
      for (const email of batch) {
        expect(email.from).toBe(FROM_EMAIL);
        expect(email.replyTo).toBe(REPLY_TO);
        expect(email.subject).toBe('New post: Automate the boring bits');
      }
      expect(batch[0].to).toBe('a@example.com');
      expect(batch[1].to).toBe('b@example.com');
    });

    it('sets one-click unsubscribe headers per subscriber', () => {
      const [first] = buildDigestBatch(subs, post);
      expect(first.headers['List-Unsubscribe']).toBe(
        '<https://camberco.co.uk/api/unsubscribe?token=tok-a>',
      );
      expect(first.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
    });

    it('links to the post and the unsubscribe URL in the body', () => {
      const [first] = buildDigestBatch(subs, post);
      expect(first.html).toContain('https://camberco.co.uk/blog/automate-the-boring-bits/');
      expect(first.html).toContain('https://camberco.co.uk/api/unsubscribe?token=tok-a');
    });
  });
  ```
- [ ] Run `pnpm vitest run`. Expected failure: `email.ts` has no exported member `buildDigestBatch` (and `FROM_EMAIL`/`REPLY_TO` are not exported).
- [ ] Replace the entire contents of `src/lib/email.ts` with:
  ```ts
  import { Resend } from 'resend';
  import { SITE_URL } from './site';
  import { serverSupabase } from './blog';

  export const FROM_EMAIL = 'Camber Co <noreply@camberco.co.uk>';
  export const ADMIN_EMAIL = 'charlie@camberco.co.uk';
  export const REPLY_TO = 'hello@camberco.co.uk';

  function getResend(): Resend {
    const key = import.meta.env.RESEND_API_KEY ?? '';
    return new Resend(key);
  }

  interface EnquiryData {
    name: string;
    email: string;
    company?: string;
    service: string;
    message: string;
    source: 'form' | 'bot';
  }

  const terminalStyles = `
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    background: #0a0a0a;
    color: #f0f0f0;
    padding: 32px;
    border-radius: 8px;
  `;

  const greenText = 'color: #22c55e;';
  const mutedText = 'color: #8a8a8a;';
  const labelStyle = `${mutedText} font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em;`;
  const ctaButtonStyle = `display: inline-block; background: #22c55e; color: #000; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 10px 20px; border-radius: 4px; text-decoration: none;`;

  export async function sendAdminNotification(data: EnquiryData): Promise<void> {
    const resend = getResend();

    const html = `
      <div style="${terminalStyles}">
        <h2 style="${greenText} font-size: 18px; margin: 0 0 24px 0;">$ new CamberCo enquiry</h2>

        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="${labelStyle} padding: 8px 16px 8px 0; vertical-align: top; width: 100px;">name</td>
            <td style="padding: 8px 0; color: #f0f0f0;">${escapeHtml(data.name)}</td>
          </tr>
          <tr>
            <td style="${labelStyle} padding: 8px 16px 8px 0; vertical-align: top;">email</td>
            <td style="padding: 8px 0;"><a href="mailto:${escapeHtml(data.email)}" style="color: #4ade80; text-decoration: none;">${escapeHtml(data.email)}</a></td>
          </tr>
          ${data.company ? `
          <tr>
            <td style="${labelStyle} padding: 8px 16px 8px 0; vertical-align: top;">company</td>
            <td style="padding: 8px 0; color: #f0f0f0;">${escapeHtml(data.company)}</td>
          </tr>
          ` : ''}
          <tr>
            <td style="${labelStyle} padding: 8px 16px 8px 0; vertical-align: top;">service</td>
            <td style="padding: 8px 0; color: #f0f0f0;">${escapeHtml(data.service)}</td>
          </tr>
          <tr>
            <td style="${labelStyle} padding: 8px 16px 8px 0; vertical-align: top;">source</td>
            <td style="padding: 8px 0; color: #f0f0f0;">${data.source === 'bot' ? 'AI chat' : 'Contact form'}</td>
          </tr>
          <tr>
            <td style="${labelStyle} padding: 8px 16px 8px 0; vertical-align: top;">message</td>
            <td style="padding: 8px 0; color: #f0f0f0; white-space: pre-wrap;">${escapeHtml(data.message)}</td>
          </tr>
        </table>

        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #1f1f1f;">
          <a href="${SITE_URL}/admin/enquiries" style="color: #22c55e; text-decoration: none; font-size: 13px;">→ view in dashboard</a>
        </div>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      replyTo: data.email,
      subject: `New CamberCo enquiry from ${data.name}`,
      html,
    });
    if (error) throw new Error(`Admin notification failed: ${error.message}`);
  }

  export async function sendSenderConfirmation(data: EnquiryData): Promise<void> {
    const resend = getResend();

    const html = `
      <div style="${terminalStyles}">
        <h2 style="${greenText} font-size: 18px; margin: 0 0 16px 0;">$ thanks for reaching out</h2>

        <p style="color: #d0d0d0; line-height: 1.6; margin: 0 0 24px 0;">
          Hey ${escapeHtml(data.name)}, thanks for getting in touch with Camber Co.
          Charlie will review your enquiry and get back to you within one working day.
        </p>

        <div style="background: #111111; border: 1px solid #1f1f1f; border-radius: 4px; padding: 16px; margin-bottom: 24px;">
          <p style="${labelStyle} margin: 0 0 8px 0;">what you submitted</p>
          <p style="color: #d0d0d0; margin: 0 0 4px 0;"><strong style="color: #f0f0f0;">Service:</strong> ${escapeHtml(data.service)}</p>
          <p style="color: #d0d0d0; margin: 0; white-space: pre-wrap;"><strong style="color: #f0f0f0;">Message:</strong> ${escapeHtml(data.message)}</p>
        </div>

        <p style="${mutedText} font-size: 13px; margin: 0;">
          Camber Co. The AI consultant who builds.
        </p>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: data.email,
      replyTo: REPLY_TO,
      subject: 'Thanks for reaching out to Camber Co',
      html,
    });
    if (error) throw new Error(`Sender confirmation failed: ${error.message}`);
  }

  export async function sendSubscribeConfirmation(
    subscriberEmail: string,
    unsubscribeToken: string,
  ): Promise<void> {
    const resend = getResend();
    const confirmUrl = `${SITE_URL}/api/confirm-subscription?token=${unsubscribeToken}`;

    const html = `
      <div style="${terminalStyles}">
        <h2 style="${greenText} font-size: 18px; margin: 0 0 16px 0;">$ confirm your subscription</h2>

        <p style="color: #d0d0d0; line-height: 1.6; margin: 0 0 24px 0;">
          You asked to receive new posts from Camber Co. Click below to confirm.
        </p>

        <a href="${confirmUrl}" style="${ctaButtonStyle}">&gt; Confirm Subscription</a>

        <p style="${mutedText} font-size: 13px; margin: 24px 0 0 0;">
          If you did not request this, just ignore this email.
        </p>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: subscriberEmail,
      replyTo: REPLY_TO,
      subject: 'Confirm your Camber Co subscription',
      html,
    });
    if (error) throw new Error(`Subscribe confirmation failed: ${error.message}`);
  }

  export async function sendSubscriberAlert(subscriberEmail: string): Promise<void> {
    const resend = getResend();

    const html = `
      <div style="${terminalStyles}">
        <h2 style="${greenText} font-size: 18px; margin: 0 0 16px 0;">$ new newsletter subscriber</h2>
        <p style="color: #d0d0d0; line-height: 1.6; margin: 0;">
          <a href="mailto:${escapeHtml(subscriberEmail)}" style="color: #4ade80; text-decoration: none;">${escapeHtml(subscriberEmail)}</a>
          just confirmed their subscription.
        </p>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: ADMIN_EMAIL,
      replyTo: subscriberEmail,
      subject: `New subscriber: ${subscriberEmail}`,
      html,
    });
    if (error) throw new Error(`Subscriber alert failed: ${error.message}`);
  }

  export async function sendWelcomeEmail(
    subscriberEmail: string,
    unsubscribeToken: string,
  ): Promise<void> {
    const resend = getResend();
    const unsubUrl = `${SITE_URL}/api/unsubscribe?token=${unsubscribeToken}`;

    let posts: { title: string; slug: string }[] = [];
    try {
      const supabase = serverSupabase();
      const { data } = await supabase
        .from('blog_drafts')
        .select('title, slug')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(3);
      posts = data ?? [];
    } catch (err) {
      console.error('Welcome email: failed to fetch posts:', err);
    }

    const postList = posts.length
      ? `
        <p style="${labelStyle} margin: 0 0 8px 0;">start here</p>
        <ul style="margin: 0 0 24px 0; padding: 0 0 0 18px; color: #d0d0d0;">
          ${posts
            .map(
              (p) =>
                `<li style="margin: 0 0 8px 0;"><a href="${SITE_URL}/blog/${p.slug}/" style="color: #4ade80; text-decoration: none;">${escapeHtml(p.title)}</a></li>`,
            )
            .join('')}
        </ul>
      `
      : `
        <p style="color: #d0d0d0; line-height: 1.6; margin: 0 0 24px 0;">
          <a href="${SITE_URL}/blog/" style="color: #4ade80; text-decoration: none;">Browse the blog</a> for practical writing on AI and automation.
        </p>
      `;

    const html = `
      <div style="${terminalStyles}">
        <h2 style="${greenText} font-size: 18px; margin: 0 0 16px 0;">$ welcome to Camber Co</h2>

        <p style="color: #d0d0d0; line-height: 1.6; margin: 0 0 24px 0;">
          Thanks for confirming. You will get each new post by email.
          Short, practical writing on AI and automation for small businesses. No spam.
        </p>

        ${postList}

        <p style="color: #d0d0d0; line-height: 1.6; margin: 0 0 16px 0;">
          Got a process that eats your week? The 30-minute audit call is free.
          No pitch, just a look at what could run itself.
        </p>

        <a href="${SITE_URL}/contact" style="${ctaButtonStyle}">&gt; Book a Free Audit Call</a>

        <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #1f1f1f;">
          <p style="${mutedText} font-size: 11px; margin: 0;">
            You received this because you subscribed at camberco.co.uk.
            <a href="${unsubUrl}" style="color: #8a8a8a; text-decoration: underline;">Unsubscribe</a>
          </p>
        </div>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: subscriberEmail,
      replyTo: REPLY_TO,
      subject: 'Welcome to Camber Co',
      html,
      headers: {
        'List-Unsubscribe': `<${unsubUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
    if (error) throw new Error(`Welcome email failed: ${error.message}`);
  }

  interface BlogDigestData {
    title: string;
    slug: string;
    description: string;
    author: string;
  }

  interface Subscriber {
    email: string;
    unsubscribe_token: string;
  }

  export interface DigestEmail {
    from: string;
    to: string;
    replyTo: string;
    subject: string;
    html: string;
    headers: Record<string, string>;
  }

  export function chunk<T>(items: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      out.push(items.slice(i, i + size));
    }
    return out;
  }

  export function buildDigestBatch(subscribers: Subscriber[], post: BlogDigestData): DigestEmail[] {
    const postUrl = `${SITE_URL}/blog/${post.slug}/`;

    return subscribers.map((sub) => {
      const unsubUrl = `${SITE_URL}/api/unsubscribe?token=${sub.unsubscribe_token}`;

      const html = `
        <div style="${terminalStyles}">
          <h2 style="${greenText} font-size: 18px; margin: 0 0 16px 0;">$ new post from Camber Co</h2>

          <h3 style="color: #f0f0f0; font-size: 20px; margin: 0 0 12px 0; font-family: 'JetBrains Mono', monospace;">${escapeHtml(post.title)}</h3>

          <p style="color: #d0d0d0; line-height: 1.6; margin: 0 0 24px 0;">
            ${escapeHtml(post.description)}
          </p>

          <a href="${postUrl}" style="${ctaButtonStyle}">&gt; Read the Post</a>

          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #1f1f1f;">
            <p style="${mutedText} font-size: 11px; margin: 0;">
              You received this because you subscribed to Camber Co.
              <a href="${unsubUrl}" style="color: #8a8a8a; text-decoration: underline;">Unsubscribe</a>
            </p>
          </div>
        </div>
      `;

      return {
        from: FROM_EMAIL,
        to: sub.email,
        replyTo: REPLY_TO,
        subject: `New post: ${post.title}`,
        html,
        headers: {
          'List-Unsubscribe': `<${unsubUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      };
    });
  }

  export async function sendBlogDigest(subscribers: Subscriber[], post: BlogDigestData): Promise<void> {
    const resend = getResend();

    for (const batch of chunk(buildDigestBatch(subscribers, post), 100)) {
      const { error } = await resend.batch.send(batch);
      if (error) console.error('Digest batch failed:', error);
    }
  }

  function escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  ```
- [ ] Run `pnpm vitest run`. Expected: all pass (including the 5 new email tests).
- [ ] Run `pnpm build`. Expected: success (publish.ts still calls `sendBlogDigest(subscribers, post)` with the same signature; enquiries.ts and chat.ts still call the enquiry senders unchanged).
- [ ] Commit:
  ```bash
  git add src/lib/email.ts src/lib/email.test.ts
  git commit -m "Overhaul email library: reply-to, welcome and alert emails, batch digest with one-click unsubscribe" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 9: waitUntil reliability for enquiries, subscribe and publish

**Files:**
- Modify: `package.json` (dependencies)
- Modify: `src/pages/api/enquiries.ts` (the send block, currently lines 113-118 of the original file)
- Modify: `src/pages/api/subscribe.ts` (lines 61-115 of the original file: the confirmed check, upsert and inline Resend send)
- Modify: `src/pages/api/admin/publish.ts` (lines 80-103: deploy hook + digest block)

**Interfaces:**
- Consumes: `waitUntil` from `@vercel/functions` (new dependency; a safe no-op outside the Vercel runtime, so `pnpm dev` still works), `sendSubscribeConfirmation` / `sendBlogDigest` from Task 8, `subscribers.status` and `subscribers.last_sent_at` columns from Task 5.
- Produces: no send can be dropped when the serverless function freezes after the response; digest only goes to `confirmed = true AND status = 'active'`; `last_sent_at` stamped after each digest.

**Steps:**

- [ ] Add the dependency:
  ```bash
  pnpm add @vercel/functions
  ```
- [ ] In `src/pages/api/enquiries.ts`: add to the imports:
  ```ts
  import { waitUntil } from '@vercel/functions';
  ```
  Replace the fire-and-forget send block (lines 113-118: the comment `// Send emails (non-blocking — don't fail the response if email fails)`, the `const enquiryData = ...` declaration and the `Promise.all([...])` call) with:
  ```ts
  // Emails must survive the response: waitUntil keeps the function alive until they settle.
  const enquiryData = { name, email, company: company ?? undefined, service, message, source: source as 'form' | 'bot' };
  waitUntil(
    Promise.allSettled([
      sendAdminNotification(enquiryData),
      sendSenderConfirmation(enquiryData),
    ]).then((results) => {
      for (const r of results) {
        if (r.status === 'rejected') console.error('Enquiry email failed:', r.reason);
      }
    }),
  );
  ```
- [ ] Rewrite `src/pages/api/subscribe.ts` from the `const supabase = serverSupabase();` line to the end of `POST` (this removes the duplicated `noreply@camberco.co.uk` literal, the inline Resend HTML and the `Resend` import; keep the honeypot and email validation above it unchanged):
  ```ts
  const supabase = serverSupabase();

  // Check if already confirmed and active
  const { data: existing } = await supabase
    .from('subscribers')
    .select('confirmed, status')
    .eq('email', email)
    .maybeSingle();

  if (existing?.confirmed && existing?.status === 'active') {
    return jsonRes({ success: true, message: 'Already subscribed.' });
  }

  // Upsert subscriber; re-subscribing after an unsubscribe reactivates the row
  const { data: subscriber, error } = await supabase
    .from('subscribers')
    .upsert({ email, status: 'active', unsubscribed_at: null }, { onConflict: 'email' })
    .select('unsubscribe_token')
    .single();

  if (error || !subscriber) {
    console.error('Subscribe error:', error);
    return jsonRes({ error: 'Something went wrong.' }, 500);
  }

  waitUntil(
    sendSubscribeConfirmation(email, subscriber.unsubscribe_token).catch((err) =>
      console.error('Confirmation email failed:', err),
    ),
  );

  return jsonRes({ success: true });
  ```
  Final import block for subscribe.ts:
  ```ts
  import type { APIRoute } from 'astro';
  import { createClient } from '@supabase/supabase-js';
  import { waitUntil } from '@vercel/functions';
  import { checkRateLimit } from '../../lib/rate-limit';
  import { sendSubscribeConfirmation } from '../../lib/email';
  ```
- [ ] In `src/pages/api/admin/publish.ts`: add to the imports:
  ```ts
  import { waitUntil } from '@vercel/functions';
  ```
  Replace everything from `// Trigger Vercel deploy hook (fire-and-forget)` down to (but not including) the final `return jsonRes({ ok: true, slug });` with:
  ```ts
  // Trigger Vercel deploy hook; waitUntil keeps it alive past the response
  const deployHook = import.meta.env.VERCEL_DEPLOY_HOOK ?? '';
  if (deployHook) {
    waitUntil(fetch(deployHook, { method: 'POST' }).catch(() => {}));
  }

  // Send blog digest to confirmed, active subscribers and stamp last_sent_at
  waitUntil(
    (async () => {
      const { data: subscribers, error: subErr } = await supabase
        .from('subscribers')
        .select('email, unsubscribe_token')
        .eq('confirmed', true)
        .eq('status', 'active');

      if (subErr) {
        console.error('Failed to fetch subscribers:', subErr);
        return;
      }
      if (!subscribers || subscribers.length === 0) return;

      await sendBlogDigest(subscribers, {
        title,
        slug,
        description: (draft.description as string) || '',
        author: (draft.author as string) || 'Charlie',
      });

      const { error: sentErr } = await supabase
        .from('subscribers')
        .update({ last_sent_at: new Date().toISOString() })
        .eq('confirmed', true)
        .eq('status', 'active');
      if (sentErr) console.error('Failed to update last_sent_at:', sentErr);
    })().catch((err) => console.error('Blog digest send failed:', err)),
  );
  ```
- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify every targeted send is wrapped:
  ```bash
  grep -rn "waitUntil" src/pages/api/enquiries.ts src/pages/api/subscribe.ts src/pages/api/admin/publish.ts
  ```
  Expected: at least one `waitUntil(` in each file, plus the import lines. Then confirm the duplicated literal is gone:
  ```bash
  grep -rn "noreply@camberco" src/pages/api/ ; echo "exit: $?"
  ```
  Expected: no matches, exit 1 (the address now lives only in `src/lib/email.ts`).
- [ ] Commit:
  ```bash
  git add package.json pnpm-lock.yaml src/pages/api/enquiries.ts src/pages/api/subscribe.ts src/pages/api/admin/publish.ts
  git commit -m "Wrap email sends in waitUntil and filter digest to active subscribers" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 10: Confirm/unsubscribe button-POST conversion + welcome and alert wiring

**Files:**
- Modify: `src/pages/api/confirm-subscription.ts` (full rewrite, current lines 1-57)
- Modify: `src/pages/api/unsubscribe.ts` (full rewrite, current lines 1-52)

**Interfaces:**
- Consumes: `sendWelcomeEmail`, `sendSubscriberAlert` from Task 8; `waitUntil`; `subscribers.status` / `unsubscribed_at` columns from Task 5.
- Produces: GET on either endpoint renders a page with a button and mutates nothing (scanner prefetch safe). POST mutates. Unsubscribe is a soft delete. `POST /api/unsubscribe?token=X` also satisfies RFC 8058 one-click (token in query, mutation on POST), matching the `List-Unsubscribe` headers from Task 8.
- Emailed URLs are unchanged: `/api/confirm-subscription?token=X` and `/api/unsubscribe?token=X`, so links already in inboxes keep working.

**Steps:**

- [ ] Replace the entire contents of `src/pages/api/confirm-subscription.ts` with:
  ```ts
  export const prerender = false;

  import type { APIRoute } from 'astro';
  import { createClient } from '@supabase/supabase-js';
  import { waitUntil } from '@vercel/functions';
  import { sendSubscriberAlert, sendWelcomeEmail } from '../../lib/email';

  function serverSupabase() {
    const url = import.meta.env.PUBLIC_SUPABASE_URL ?? '';
    const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }

  function escapeAttr(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function page(title: string, heading: string, bodyHtml: string, status = 200): Response {
    return new Response(
      `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <meta name="robots" content="noindex"/>
    <title>${title} | Camber Co</title>
    <style>
      body { margin: 0; background: #000; color: #f0f0f0; font-family: 'JetBrains Mono', monospace; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
      .card { background: #0a0a0a; border: 1px solid #1f1f1f; border-radius: 12px; padding: 48px; text-align: center; max-width: 420px; }
      h1 { color: #22c55e; font-size: 20px; margin: 0 0 12px 0; }
      p { color: #d0d0d0; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; }
      a { color: #22c55e; text-decoration: none; font-size: 13px; }
      a:hover { color: #4ade80; }
      button { background: #22c55e; color: #000; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 10px 20px; border-radius: 4px; border: none; cursor: pointer; }
      button:hover { background: #4ade80; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${heading}</h1>
      ${bodyHtml}
    </div>
  </body>
  </html>`,
      { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  // GET renders a confirm button. It never mutates, so inbox scanners that
  // prefetch links cannot corrupt subscription state.
  export const GET: APIRoute = async ({ url }) => {
    const token = url.searchParams.get('token');
    if (!token) {
      return new Response('Missing token.', { status: 400 });
    }

    const supabase = serverSupabase();
    const { data: sub } = await supabase
      .from('subscribers')
      .select('email, confirmed, status')
      .eq('unsubscribe_token', token)
      .maybeSingle();

    if (!sub) {
      return page(
        'Invalid link',
        '$ invalid link',
        `<p>This confirmation link is invalid or has expired.</p><a href="/blog/">Back to blog</a>`,
        404,
      );
    }

    if (sub.confirmed && sub.status === 'active') {
      return page(
        'Subscribed',
        '$ already confirmed',
        `<p>You are already subscribed. New posts will land in your inbox.</p><a href="/blog/">Back to blog</a>`,
      );
    }

    return page(
      'Confirm subscription',
      '$ confirm your subscription',
      `<p>One click and you are in. New posts from Camber Co, straight to your inbox.</p>
       <form method="POST" action="/api/confirm-subscription">
         <input type="hidden" name="token" value="${escapeAttr(token)}"/>
         <button type="submit">&gt; Confirm Subscription</button>
       </form>`,
    );
  };

  // POST performs the state change, then sends the welcome email and owner alert.
  export const POST: APIRoute = async ({ request }) => {
    let token = '';
    try {
      const form = await request.formData();
      token = String(form.get('token') ?? '');
    } catch {
      // fall through to the missing-token response
    }
    if (!token) {
      return new Response('Missing token.', { status: 400 });
    }

    const supabase = serverSupabase();

    const { data: updated, error } = await supabase
      .from('subscribers')
      .update({ confirmed: true, status: 'active', unsubscribed_at: null })
      .eq('unsubscribe_token', token)
      .eq('confirmed', false)
      .select('email')
      .maybeSingle();

    if (error) {
      console.error('Confirm subscription error:', error);
      return page(
        'Something went wrong',
        '$ something went wrong',
        `<p>We could not confirm your subscription. Please try the link again in a minute.</p>`,
        500,
      );
    }

    if (!updated) {
      // Either an invalid token, or a re-click on an already confirmed subscription.
      const { data: existing } = await supabase
        .from('subscribers')
        .select('email')
        .eq('unsubscribe_token', token)
        .maybeSingle();

      if (!existing) {
        return page(
          'Invalid link',
          '$ invalid link',
          `<p>This confirmation link is invalid or has expired.</p><a href="/blog/">Back to blog</a>`,
          404,
        );
      }

      return page(
        'Subscribed',
        '$ already confirmed',
        `<p>You are already subscribed. New posts will land in your inbox.</p><a href="/blog/">Back to blog</a>`,
      );
    }

    // Owner alert + welcome email, kept alive past the response.
    waitUntil(
      Promise.allSettled([
        sendWelcomeEmail(updated.email, token),
        sendSubscriberAlert(updated.email),
      ]).then((results) => {
        for (const r of results) {
          if (r.status === 'rejected') console.error('Post-confirmation email failed:', r.reason);
        }
      }),
    );

    return page(
      'Subscribed',
      '$ subscription confirmed',
      `<p>You will receive new posts from Camber Co in your inbox. A welcome email is on its way.</p><a href="/blog/">Back to blog</a>`,
    );
  };
  ```
- [ ] Replace the entire contents of `src/pages/api/unsubscribe.ts` with:
  ```ts
  export const prerender = false;

  import type { APIRoute } from 'astro';
  import { createClient } from '@supabase/supabase-js';

  function serverSupabase() {
    const url = import.meta.env.PUBLIC_SUPABASE_URL ?? '';
    const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  }

  function escapeAttr(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function page(title: string, heading: string, bodyHtml: string, status = 200): Response {
    return new Response(
      `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <meta name="robots" content="noindex"/>
    <title>${title} | Camber Co</title>
    <style>
      body { margin: 0; background: #000; color: #f0f0f0; font-family: 'JetBrains Mono', monospace; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
      .card { background: #0a0a0a; border: 1px solid #1f1f1f; border-radius: 12px; padding: 48px; text-align: center; max-width: 420px; }
      h1 { color: #f0f0f0; font-size: 20px; margin: 0 0 12px 0; }
      p { color: #d0d0d0; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; }
      p:last-child { margin-bottom: 0; }
      button { background: transparent; color: #f0f0f0; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 10px 20px; border-radius: 4px; border: 1px solid #3a3a3a; cursor: pointer; }
      button:hover { border-color: #f0f0f0; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${heading}</h1>
      ${bodyHtml}
    </div>
  </body>
  </html>`,
      { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  // GET renders an unsubscribe button. It never mutates, so inbox scanners that
  // prefetch links cannot unsubscribe people by accident.
  export const GET: APIRoute = async ({ url }) => {
    const token = url.searchParams.get('token');
    if (!token) {
      return new Response('Missing token.', { status: 400 });
    }

    return page(
      'Unsubscribe',
      '$ unsubscribe',
      `<p>Stop receiving new post emails from Camber Co?</p>
       <form method="POST" action="/api/unsubscribe">
         <input type="hidden" name="token" value="${escapeAttr(token)}"/>
         <button type="submit">&gt; Unsubscribe</button>
       </form>`,
    );
  };

  // POST performs a soft delete. The token may arrive as a query param
  // (RFC 8058 one-click unsubscribe posts to the List-Unsubscribe URL)
  // or as a form field (the button above).
  export const POST: APIRoute = async ({ request, url }) => {
    let token = url.searchParams.get('token') ?? '';
    if (!token) {
      try {
        const form = await request.formData();
        token = String(form.get('token') ?? '');
      } catch {
        // no parseable body; fall through
      }
    }
    if (!token) {
      return new Response('Missing token.', { status: 400 });
    }

    const supabase = serverSupabase();
    const { error } = await supabase
      .from('subscribers')
      .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
      .eq('unsubscribe_token', token);

    if (error) {
      console.error('Unsubscribe error:', error);
    }

    return page(
      'Unsubscribed',
      '$ unsubscribed',
      `<p>You have been removed from the mailing list. You will not receive further emails.</p>`,
    );
  };
  ```
- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify against the dev server (GET must not mutate; missing token 400s):
  ```bash
  pnpm dev > /tmp/astro-dev.log 2>&1 &
  sleep 6
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:4321/api/confirm-subscription"        # expect 400
  curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:4321/api/unsubscribe"                  # expect 400
  curl -s "http://localhost:4321/api/unsubscribe?token=any" | grep -c 'method="POST"'               # expect 1
  curl -s "http://localhost:4321/api/confirm-subscription?token=not-a-real-token" | grep -c "invalid link"  # expect 1
  kill %1
  ```
- [ ] Commit:
  ```bash
  git add src/pages/api/confirm-subscription.ts src/pages/api/unsubscribe.ts
  git commit -m "Convert confirm/unsubscribe to button-POST flows with welcome email and owner alert" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 11: Chat enquiry validation + chat email reliability

**Files:**
- Modify: `src/pages/api/chat.ts` (the `submit_enquiry` tool-call handler; in the original file this is lines 116-173, after Task 7's edits it starts at the `if (choice?.finish_reason === 'tool_calls' ...)` block)

**Interfaces:**
- Consumes: `waitUntil` from `@vercel/functions`, `sendAdminNotification` / `sendSenderConfirmation` from `src/lib/email.ts`.
- Produces: chat-sourced enquiries validated with the same `EMAIL_RE` as the form, with length caps (name 100, email 200, company 150, service 100, message 2000). Invalid data never reaches the `enquiries` table; the model gets a tool result telling it to echo the email back and retry.
- Note: the system-prompt change that makes the bot ALWAYS echo the email back before calling `submit_enquiry` lives in `src/scripts/chat-prompts.ts`, which belongs to Plan 4. This task ships only the server-side validation and the recovery loop.

**Steps:**

- [ ] In `src/pages/api/chat.ts`, add two imports at the top (after the `checkRateLimit` import added in Task 7):
  ```ts
  import { waitUntil } from '@vercel/functions';
  import { sendAdminNotification, sendSenderConfirmation } from '../../lib/email';
  ```
  And add the shared regex constant next to `MAX_MSG_LENGTH`:
  ```ts
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  ```
- [ ] Replace the body of the `submit_enquiry` handler, from immediately after the existing `args = JSON.parse(...)` try/catch down to the end of the `if (toolCall.function.name === 'submit_enquiry')` block (the Supabase insert, the dynamic-import email block and the follow-up completion), with:
  ```ts
  // Validate exactly like the contact form: same regex, hard length caps.
  const name = String(args.name ?? '').trim().slice(0, 100);
  const email = String(args.email ?? '').trim().slice(0, 200);
  const company = args.company ? String(args.company).trim().slice(0, 150) : null;
  const serviceRequested = String(args.service ?? '').trim().slice(0, 100);
  const message = String(args.message ?? '').trim().slice(0, 2000);

  const problems: string[] = [];
  if (!name) problems.push('the name is missing');
  if (!EMAIL_RE.test(email)) problems.push(`the email address "${email}" does not look valid`);
  if (!serviceRequested) problems.push('the service is missing');
  if (!message) problems.push('the message summary is missing');

  if (problems.length > 0) {
    // Tell the model what failed so it can echo the email back and retry.
    const retry = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPTS[service] },
        ...sanitized,
        choice.message as OpenAI.ChatCompletionMessageParam,
        {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: `The enquiry was NOT submitted: ${problems.join('; ')}. Repeat the email address back to the user exactly as you have it, ask them to confirm or correct it, then call submit_enquiry again.`,
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
      tools: [ENQUIRY_TOOL],
    });

    const retryText =
      retry.choices[0]?.message?.content ??
      'quick check before I send this: could you confirm your email address for me?';
    return textResponse(retryText);
  }

  // Submit enquiry internally
  const { createClient } = await import('@supabase/supabase-js');
  const url = import.meta.env.PUBLIC_SUPABASE_URL ?? '';
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  const { error } = await supabase.from('enquiries').insert({
    name,
    email,
    company,
    service: serviceRequested,
    message,
    source: 'bot',
    chat_transcript: sanitized,
  });

  if (error) {
    console.error('Enquiry insert from bot failed:', error);
    return textResponse('sorry, there was an issue submitting your enquiry. you can also reach us at /contact and Charlie will get back to you.');
  }

  // Emails must survive the response: waitUntil keeps the function alive until they settle.
  const emailData = {
    name,
    email,
    company: company ?? undefined,
    service: serviceRequested,
    message,
    source: 'bot' as const,
  };
  waitUntil(
    Promise.allSettled([
      sendAdminNotification(emailData),
      sendSenderConfirmation(emailData),
    ]).then((results) => {
      for (const r of results) {
        if (r.status === 'rejected') console.error('Chat enquiry email failed:', r.reason);
      }
    }),
  );

  // Get a follow-up response from the model
  const followUp = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS[service] },
      ...sanitized,
      choice.message as OpenAI.ChatCompletionMessageParam,
      {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: `Enquiry submitted successfully for ${name} (${email}). Charlie will review it and get back to them.`,
      },
    ],
    max_tokens: 200,
    temperature: 0.7,
  });

  const followUpText = followUp.choices[0]?.message?.content ?? "done, I've sent that through. Charlie will be in touch shortly.";
  return textResponse(followUpText);
  ```
- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify the validation and reliability wiring:
  ```bash
  grep -n "EMAIL_RE.test(email)" src/pages/api/chat.ts        # expect 1 match
  grep -n "slice(0, 2000)" src/pages/api/chat.ts              # expect 1 match (message cap)
  grep -n "waitUntil" src/pages/api/chat.ts                   # expect import + 1 usage
  grep -cn "import('../../lib/email')" src/pages/api/chat.ts ; echo "exit: $?"  # expect 0 matches, exit 1
  ```
- [ ] Commit:
  ```bash
  git add src/pages/api/chat.ts
  git commit -m "Validate chat-sourced enquiries and make chat emails survive the response" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

### Task 12: Complete .env.example

**Files:**
- Modify: `.env.example` (currently 2 lines: OPENAI_API_KEY, OPENAI_MODEL)

**Interfaces:**
- Produces: every environment variable the codebase reads, documented in one place. Derived from actual usage: `RESEND_API_KEY` (`src/lib/email.ts`), `PUBLIC_SUPABASE_URL` + `PUBLIC_SUPABASE_ANON_KEY` (`src/lib/supabase.ts`), `SUPABASE_SERVICE_ROLE_KEY` (every API route), `VERCEL_DEPLOY_HOOK` (`src/pages/api/admin/publish.ts`, `drafts.ts`), `OPENAI_API_KEY` + `OPENAI_MODEL` (`src/pages/api/chat.ts`).

**Steps:**

- [ ] Replace the entire contents of `.env.example` with:
  ```bash
  # Resend (transactional email: enquiry alerts, confirmations, welcome, digest)
  RESEND_API_KEY=re_your_api_key

  # Supabase (PUBLIC_ vars are exposed to the client; the service role key must never be)
  PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  PUBLIC_SUPABASE_ANON_KEY=your_anon_key
  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

  # Vercel deploy hook (rebuilds the site when a blog post is published)
  VERCEL_DEPLOY_HOOK=https://api.vercel.com/v1/integrations/deploy/your_hook_id

  # OpenAI (enquiry chatbot)
  OPENAI_API_KEY=your_openai_api_key_here
  OPENAI_MODEL=gpt-4o-mini
  ```
- [ ] Verify nothing the code reads is missing:
  ```bash
  grep -rhoE "import\.meta\.env\.[A-Z_]+" src | sort -u
  ```
  Expected output covers exactly: `OPENAI_API_KEY`, `OPENAI_MODEL`, `PUBLIC_SUPABASE_ANON_KEY`, `PUBLIC_SUPABASE_URL`, `RESEND_API_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `VERCEL_DEPLOY_HOOK`. (`SUPABASE_URL`/`SUPABASE_SECRET_KEY` are optional fallbacks in `src/lib/blog.ts:4-5` and deliberately stay out of the example.)
- [ ] Run `pnpm vitest run` and `pnpm build` one final time. Expected: all tests pass, build succeeds.
- [ ] Commit:
  ```bash
  git add .env.example
  git commit -m "Document every required environment variable in .env.example" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
  ```

---

## Post-plan verification (matches spec acceptance criteria)

- `pnpm vitest run`: all suites green (site, services, projects, rate-limit, email).
- `pnpm build`: succeeds.
- Live test once deployed: a newsletter signup produces a confirmation email; clicking through and pressing the confirm button produces a welcome email AND an owner alert to charlie@camberco.co.uk; a test enquiry produces an admin alert whose reply-to is the enquirer and a visitor auto-reply whose reply-to is hello@camberco.co.uk. Verify in the Resend logs.
- The unsubscribe button sets `status='unsubscribed'` and `unsubscribed_at`; the row is NOT deleted; a re-publish digest skips that subscriber.
