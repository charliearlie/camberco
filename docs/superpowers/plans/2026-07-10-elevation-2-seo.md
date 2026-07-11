# Site Elevation Plan 2: SEO Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox ('- [ ]') syntax for tracking.

**Goal:** Fix the site's SEO plumbing end to end: derived canonicals on the apex domain with no trailing slashes, llms.txt for AI assistants, a real 1200x630 OG image, loud blog build failures, sitemap lastmod, enriched RSS, corrected structured data, a server-side admin gate, and server-rendered stats.

**Architecture:** All meta derivation moves into `src/layouts/Layout.astro` (canonical and og:url computed from `Astro.url` + `Astro.site`, never hand-typed). Pure logic (sitemap lastmod mapping, admin path guard, blog HTML processing) lives in small `src/lib/*.ts` modules with colocated vitest tests. Admin routes become server-rendered and are gated by `src/middleware.ts` using the existing Supabase token-validation mechanism, carried in a cookie set by the existing login/callback scripts.

**Tech Stack:** Astro 5 (server output, prerendered public pages), @astrojs/vercel, @astrojs/sitemap, @astrojs/rss, Supabase (blog content + admin auth), vitest, sharp (dev-only, OG image generation), image-size (build-time image probing).

## Global Constraints

- pnpm only
- Astro 5
- British English copy, short sentences, NO em dashes anywhere in site copy
- prices exactly as the contract table
- every animation respects prefers-reduced-motion with a static fallback
- all Resend sends wrapped in waitUntil from @vercel/functions
- free 30-minute audit call is never conflated with the paid £750 AI Readiness Audit
- commit messages end with "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"

## Preconditions

- Plan 1 has landed: vitest is installed and configured (`pnpm vitest run` works, tests colocated as `src/**/*.test.ts`).
- `.env` contains `PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (already true; `pnpm build` needs them because blog pages fetch from Supabase at build time).
- Work on a branch: `git checkout -b elevation-2-seo` (skip if the executor session already created a work branch/worktree).
- Build output paths in verification steps refer to the Vercel adapter output: prerendered HTML lives in `.vercel/output/static/`.

---

### Task 1: Derive canonical URLs in Layout, remove hand-typed canonicals from every page

**Files:**
- Modify: `src/layouts/Layout.astro` (lines 6-39 front matter; lines 88-89 canonical; line 99 og:url; line 126 twitter:url)
- Modify: `src/pages/index.astro` (line 287)
- Modify: `src/pages/contact.astro` (line 9)
- Modify: `src/pages/about-me.astro` (line 268)
- Modify: `src/pages/blog/index.astro` (line 66)
- Modify: `src/pages/blog/[slug].astro` (lines 47, 141)
- Modify: `src/pages/blog/category/[category].astro` (line 52)
- Modify: `src/pages/services/index.astro` (line 93)
- Modify: `src/pages/services/automation.astro` (line 94)
- Modify: `src/pages/services/apps.astro` (line 93)
- Modify: `src/pages/services/builds.astro` (line 100)

**Interfaces:**
- Produces: `Layout.astro` Props WITHOUT `canonicalUrl`. Canonical is derived: `new URL(Astro.url.pathname.replace(/\/+$/, '') || '/', Astro.site).href`. Plans 3/4/5 must NOT pass a canonical prop.
- Consumes: `Astro.site` (`https://camberco.co.uk` from `astro.config.mjs` line 7).

**Steps:**

- [ ] In `src/layouts/Layout.astro`, replace the front matter (everything between the opening `---` and the closing `---`, currently lines 1-40) with:

```astro
---
import Nav from '../components/Nav.astro';
import Footer from '../components/Footer.astro';
import '../styles/tokens.css';

interface Props {
  title: string;
  description: string;
  schema?: string;
  ogType?: string;
  ogImage?: string;
  ogImageAlt?: string;
  ogImageWidth?: number;
  ogImageHeight?: number;
  articleMeta?: {
    publishedTime: string;
    modifiedTime?: string;
    author: string;
    section: string;
    tags?: string[];
  };
}

const {
  title,
  description,
  schema,
  ogType = 'website',
  ogImage: ogImageProp,
  ogImageAlt: ogImageAltProp,
  ogImageWidth,
  ogImageHeight,
  articleMeta,
} = Astro.props;

// Canonical is always derived: apex host from Astro.site, path from the
// request URL with any trailing slash stripped. Pages never pass it in.
const site = Astro.site ?? new URL('https://camberco.co.uk');
const canonicalPath = Astro.url.pathname.replace(/\/+$/, '') || '/';
const canonicalUrl = new URL(canonicalPath, site).href;

const ogImage = ogImageProp ?? 'https://camberco.co.uk/social.png';
const ogImageAlt = ogImageAltProp ?? 'Camber Co — AI services for founders who move fast.';
---
```

(Note: `ogImage`/`ogImageAlt` defaults change again in Task 4; leave them as above for now so this task stays reviewable on its own.)

- [ ] Template lines 89, 99 and 126 already interpolate `{canonicalUrl}`; they now pick up the derived value with no template change. Confirm nothing else references the removed prop: `grep -n "canonicalUrl" src/layouts/Layout.astro` should show only the derivation const and the three template usages.
- [ ] Remove the `canonicalUrl` prop from every `<Layout ...>` call site. Delete exactly these lines:
  - `src/pages/index.astro:287` → delete `  canonicalUrl="https://camberco.co.uk/"`
  - `src/pages/contact.astro:9` → delete `  canonicalUrl="https://camberco.co.uk/contact/"`
  - `src/pages/about-me.astro:268` → delete `  canonicalUrl="https://camberco.co.uk/about-me"`
  - `src/pages/blog/index.astro:66` → delete `  canonicalUrl="https://camberco.co.uk/blog/"`
  - `src/pages/blog/category/[category].astro:52` → delete `` canonicalUrl={`https://camberco.co.uk/blog/category/${category}/`} ``
  - `src/pages/services/index.astro:93` → delete `  canonicalUrl="https://camberco.co.uk/services"`
  - `src/pages/services/automation.astro:94` → delete `  canonicalUrl="https://camberco.co.uk/services/automation"`
  - `src/pages/services/apps.astro:93` → delete `  canonicalUrl="https://camberco.co.uk/services/apps"`
  - `src/pages/services/builds.astro:100` → delete `  canonicalUrl="https://camberco.co.uk/services/builds"`
- [ ] In `src/pages/blog/[slug].astro`: the local `canonicalUrl` const is still needed for the Article schema and ShareButtons. Replace line 47:

```ts
const canonicalUrl = `https://camberco.co.uk/blog/${post.slug}/`;
```

with:

```ts
const canonicalUrl = new URL(`/blog/${post.slug}`, Astro.site ?? 'https://camberco.co.uk').href;
```

  and delete line 141 (`  canonicalUrl={canonicalUrl}`) from the `<Layout>` call. Keep the `schema`, `ogType`, `ogImage*` and `articleMeta` props.
- [ ] Run `pnpm build`. Expected: build succeeds with no errors.
- [ ] Verify derived canonicals in the output:

```bash
grep -o '<link rel="canonical" href="[^"]*"' .vercel/output/static/index.html
# expected: <link rel="canonical" href="https://camberco.co.uk/"
grep -o '<link rel="canonical" href="[^"]*"' .vercel/output/static/contact/index.html
# expected: <link rel="canonical" href="https://camberco.co.uk/contact"
grep -o '<meta property="og:url" content="[^"]*"' .vercel/output/static/contact/index.html
# expected: <meta property="og:url" content="https://camberco.co.uk/contact"
grep -rn 'canonicalUrl=' src/pages/
# expected: no matches
```

- [ ] Commit:

```bash
git add src/layouts/Layout.astro src/pages/
git commit -m "$(cat <<'EOF'
Derive canonical and og:url in Layout from Astro.url and Astro.site

Pages no longer pass hand-typed canonical strings. Trailing slashes are
stripped so every canonical is apex + no-trailing-slash.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Trailing-slash normalisation (vercel.json, astro.config, internal hrefs)

**Files:**
- Modify: `vercel.json` (whole file, currently 9 lines)
- Modify: `astro.config.mjs` (whole file, currently 15 lines)
- Modify: `src/components/Nav.astro` (lines 55, 102)
- Modify: `src/components/Footer.astro` (line 56)
- Modify: `src/components/blog/AuthorBio.astro` (line 21)
- Modify: `src/components/blog/BlogCard.astro` (line 20)
- Modify: `src/components/blog/RelatedPosts.astro` (line 30)
- Modify: `src/pages/blog/[slug].astro` (lines 158, 160)
- Modify: `src/pages/blog/index.astro` (line 90)
- Modify: `src/pages/blog/category/[category].astro` (line 70)
- Modify: `src/pages/index.astro` (lines 313, 706)
- Modify: `src/pages/about-me.astro` (line 595)
- Modify: `src/pages/services/index.astro` (line 150)
- Modify: `src/pages/services/automation.astro` (lines 114, 340)
- Modify: `src/pages/services/apps.astro` (lines 113, 252)
- Modify: `src/pages/services/builds.astro` (lines 120, 297)
- Modify: `src/scripts/chat-drawer.ts` (line 109)

**Interfaces:**
- Produces: site-wide no-trailing-slash URL policy. `@astrojs/vercel` reads Astro's `trailingSlash: 'never'` and writes it into the Vercel build output config; `vercel.json` `"trailingSlash": false` states the same policy at project level (the adapter only errors when the two disagree, e.g. `true` + `'never'`). `@astrojs/sitemap` reads `trailingSlash: 'never'` and emits slash-free `<loc>` URLs, matching the Task 1 canonicals.

**Steps:**

- [ ] Replace `vercel.json` with:

```json
{
  "trailingSlash": false,
  "redirects": [
    {
      "source": "/sitemap.xml",
      "destination": "/sitemap-index.xml",
      "permanent": true
    }
  ]
}
```

- [ ] Replace `astro.config.mjs` with:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://camberco.co.uk',
  trailingSlash: 'never',
  integrations: [
    sitemap({
      filter: (page) => !new URL(page).pathname.startsWith('/admin'),
    }),
    react(),
  ],
  adapter: vercel(),
});
```

(The filter change from `!page.includes('/admin/')` to a pathname prefix check is deliberate: with no-slash URLs, `https://camberco.co.uk/admin` no longer contains `/admin/`.)

- [ ] Align every internal trailing-slash href. Each is a mechanical one-character deletion:
  - `src/components/Nav.astro:55` and `:102`: `href="/contact/"` → `href="/contact"`
  - `src/components/Footer.astro:56`: `href="/contact/"` → `href="/contact"`
  - `src/components/blog/AuthorBio.astro:21`: `href="/contact/"` → `href="/contact"`
  - `src/components/blog/BlogCard.astro:20`: `` const postUrl = `/blog/${post.slug}/`; `` → `` const postUrl = `/blog/${post.slug}`; ``
  - `src/components/blog/RelatedPosts.astro:30`: `` href={`/blog/${post.slug}/`} `` → `` href={`/blog/${post.slug}`} ``
  - `src/pages/blog/[slug].astro:158`: `href="/blog/"` → `href="/blog"`; `:160`: `` href={`/blog/category/${category}/`} `` → `` href={`/blog/category/${category}`} ``
  - `src/pages/blog/index.astro:90`: `href={cat.value === 'all' ? '/blog/' : `/blog/category/${cat.value}/`}` → `href={cat.value === 'all' ? '/blog' : `/blog/category/${cat.value}`}`
  - `src/pages/blog/category/[category].astro:70`: same change as blog/index.astro line 90
  - `src/pages/index.astro:313` and `:706`: `href="/contact/"` → `href="/contact"`
  - `src/pages/about-me.astro:595`: `href="/contact/"` → `href="/contact"`
  - `src/pages/services/index.astro:150`: `href="/contact/"` → `href="/contact"`
  - `src/pages/services/automation.astro:114` and `:340`: `href="/contact/"` → `href="/contact"`
  - `src/pages/services/apps.astro:113` and `:252`: `href="/contact/"` → `href="/contact"`
  - `src/pages/services/builds.astro:120` and `:297`: `href="/contact/"` → `href="/contact"`
  - `src/scripts/chat-drawer.ts:109`: `connection lost. <a href="/contact/">get in touch directly</a>` → `connection lost. <a href="/contact">get in touch directly</a>`

  (Leave `src/pages/rss.xml.ts:15` alone; Task 7 rewrites that file.)
- [ ] Run `pnpm build`. Expected: success, and NO adapter error about conflicting trailingSlash configuration.
- [ ] Verify:

```bash
grep -rn 'href="/contact/"' src/ ; echo "exit=$?"
# expected: no matches, exit=1
grep -o '<loc>[^<]*</loc>' .vercel/output/static/sitemap-0.xml
# expected: every URL except https://camberco.co.uk/ has NO trailing slash
```

- [ ] Commit:

```bash
git add vercel.json astro.config.mjs src/
git commit -m "$(cat <<'EOF'
Normalise the site to no-trailing-slash URLs

vercel.json trailingSlash false, Astro trailingSlash never (sitemap now
emits slash-free URLs), and all internal hrefs aligned.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: public/llms.txt and public/llms-full.txt

**Files:**
- Create: `public/llms.txt`
- Create: `public/llms-full.txt`

**Interfaces:**
- Produces: static files served at `/llms.txt` and `/llms-full.txt`. Prices are exactly the contract table. Links use apex + no trailing slash.
- Note: `/work`, `/services/consultations`, `/services/seo`, `/services/training`, `/services/personal-ai` ship in Plan 3. These links are written now and become live when Plan 3 lands.

**Steps:**

- [ ] Create `public/llms.txt` with exactly this content:

```markdown
# Camber Co

> Camber Co is a London-based AI automation consultancy for UK small businesses, run by Charlie Waite. The AI consultant who builds: not just advice, but working systems. Camber Co designs, builds and ships workflow automations, websites, mobile apps, SEO improvements and personal AI assistants. Every engagement starts with a free 30-minute audit call.

## Services

- [Workflow automation](https://camberco.co.uk/services/automation): n8n and AI workflows that remove repetitive admin. From £1,200.
- [Website builds](https://camberco.co.uk/services/builds): fast, conversion-focused websites and web apps. From £2,500.
- [Mobile apps](https://camberco.co.uk/services/apps): iOS and cross-platform apps, from idea to App Store. From £4,500.
- [AI consultations](https://camberco.co.uk/services/consultations): a 60-minute session with clear decisions and next steps. £297 per session.
- [SEO services](https://camberco.co.uk/services/seo): technical audits, on-page fixes and keyword strategy for small businesses. From £750.
- [Training & coaching](https://camberco.co.uk/services/training): hands-on AI coaching for founders and teams. From £197 solo, team workshops from £1,500.
- [Personal AI](https://camberco.co.uk/services/personal-ai): private AI assistants on WhatsApp, Telegram, Slack or Discord. From £497.

## Company

- [Home](https://camberco.co.uk/)
- [Work](https://camberco.co.uk/work): the Camber Builds product showcase, including Football IQ on the App Store.
- [About](https://camberco.co.uk/about-me): Charlie Waite, Tech Lead and AI engineer, 12 years shipping software.
- [Blog](https://camberco.co.uk/blog): practical writing on AI strategy and automation for UK founders.
- [Contact](https://camberco.co.uk/contact)

## Pricing summary

- Workflow automation: from £1,200
- Website builds: from £2,500
- Mobile apps: from £4,500
- AI consultations: £297 per session
- SEO services: from £750
- Training & coaching: from £197 solo, £1,500 team workshops
- Personal AI: from £497
- AI Readiness Audit: £750. A paid half-day assessment with a written report. This is separate from the free 30-minute audit call, which is always free with no pitch.

## Contact

- Email: hello@camberco.co.uk
- Every enquiry gets a reply within 24 hours.
```

- [ ] Create `public/llms-full.txt` with exactly this content:

```markdown
# Camber Co

> Camber Co is a London-based AI automation consultancy for UK small businesses, run by Charlie Waite. The AI consultant who builds: not just advice, but working systems. Camber Co designs, builds and ships workflow automations, websites, mobile apps, SEO improvements and personal AI assistants. Every engagement starts with a free 30-minute audit call.

Charlie Waite has 12 years of software engineering experience, including Trainline, Just Eat and Fairplay Sports Media. Camber Co is the consultancy side of that work. Camber Builds is its product division, which has shipped Football IQ to the App Store. Clients get the person who builds, not an account manager.

## Workflow automation (from £1,200)

https://camberco.co.uk/services/automation

Custom n8n and AI workflows for small businesses. Camber Co connects the tools already in the business (email, CRM, Slack, Notion, Stripe, Sheets) and removes the manual joins. Typical automations: lead capture to CRM enrichment, support email triage, weekly KPI digests, invoice chasing. Builds include logging, retries, alerting and a runbook at handover. Typical saving: 10 to 30 hours per month on repetitive processes.

## Website builds (from £2,500)

https://camberco.co.uk/services/builds

Clean, fast websites, landing pages, web apps and MVPs. Built with Astro, Next.js, React and Supabase. Every build is performance-focused and designed around one clear conversion path. Handover means the owner can edit content without a developer.

## Mobile apps (from £4,500)

https://camberco.co.uk/services/apps

Mobile apps from tappable prototype to App Store submission. React Native, Expo and SwiftUI. Camber Builds has shipped Football IQ to the App Store and handles screenshots, metadata, privacy notes, subscriptions, TestFlight and review fixes as part of the project.

## AI consultations (£297 per session)

https://camberco.co.uk/services/consultations

A focused 60-minute session that audits where AI will actually move the needle in a business. Output: clear decisions, a prioritised action list and concrete next steps. No jargon.

## SEO services (from £750)

https://camberco.co.uk/services/seo

Practical SEO for UK small businesses: technical audits, on-page optimisation, keyword research and content strategy. The focus is traffic that converts, not vanity metrics.

## Training & coaching (from £197 solo, team workshops from £1,500)

https://camberco.co.uk/services/training

Hands-on AI coaching for non-technical founders and small teams. Covers evaluating AI tools, building simple automations, prompting well and shipping AI-powered features. Solo sessions are 1:1 and tailored. Team workshops run from £1,500.

## Personal AI (from £497)

https://camberco.co.uk/services/personal-ai

A private AI assistant trained on your business context, running on platforms you already use: WhatsApp, Telegram, Slack or Discord. Deployed with OpenClaw, an open-source platform that keeps data private and local.

## AI Readiness Audit (£750)

A paid half-day assessment of your operations with a written report: which tasks to automate first, which tools to use and what the return looks like. This is separate from the free 30-minute audit call. The free call is always free, with no pitch.

## Proof

- Work showcase: https://camberco.co.uk/work
- Football IQ (live on the App Store): https://apps.apple.com/app/id6757344691
- About Charlie: https://camberco.co.uk/about-me
- Blog: https://camberco.co.uk/blog

## Contact

- Email: hello@camberco.co.uk
- Contact page: https://camberco.co.uk/contact
- Based in London, working with businesses across the UK. Delivery is remote-friendly.
```

- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify the files are served from the build output:

```bash
grep -c '£1,200' .vercel/output/static/llms.txt
# expected: 2
grep -c 'free 30-minute audit call' .vercel/output/static/llms-full.txt
# expected: 2 or more
```

- [ ] Commit:

```bash
git add public/llms.txt public/llms-full.txt
git commit -m "$(cat <<'EOF'
Add llms.txt and llms-full.txt for AI assistant discoverability

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Default 1200x630 OG image, always-emitted OG dimensions, real logo in Article schema

**Files:**
- Create: `scripts/generate-og-image.mjs`
- Create: `public/og-default.png` (generated by the script, committed)
- Modify: `package.json` (add sharp devDependency via pnpm)
- Modify: `src/layouts/Layout.astro` (ogImage defaults from Task 1, lines 104-105 og:image:width/height)
- Modify: `src/pages/blog/[slug].astro` (lines 76-84 publisher block)

**Interfaces:**
- Produces: `public/og-default.png` (1200x630, dark terminal aesthetic, tagline). Layout always emits `og:image:width`/`og:image:height` (default 1200/630).
- Consumes: `public/logo.png` is 1024x1024 (verified with sips); Article `publisher.logo` points at it.

**Steps:**

- [ ] Install sharp as a dev dependency: `pnpm add -D sharp`
- [ ] Create `scripts/generate-og-image.mjs`:

```js
// Generates public/og-default.png (1200x630).
// Dark terminal aesthetic matching the site: dark base, terminal window
// chrome with traffic-light dots, green prompt, tagline.
// Run: node scripts/generate-og-image.mjs
import sharp from 'sharp';

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#050505"/>
  <rect x="90" y="105" width="1020" height="420" rx="16" fill="#0b0f0d" stroke="#1f2a24" stroke-width="2"/>
  <path d="M90 161 h1020 v-40 a16 16 0 0 0 -16 -16 h-988 a16 16 0 0 0 -16 16 z" fill="#101613"/>
  <circle cx="130" cy="133" r="8" fill="#ef4444"/>
  <circle cx="158" cy="133" r="8" fill="#eab308"/>
  <circle cx="186" cy="133" r="8" fill="#22c55e"/>
  <text x="600" y="140" font-family="Menlo, 'DejaVu Sans Mono', monospace" font-size="18" fill="#6b7280" text-anchor="middle">camber ~ zsh</text>
  <text x="150" y="235" font-family="Menlo, 'DejaVu Sans Mono', monospace" font-size="26" fill="#4ade80">$ camber --intro</text>
  <text x="150" y="330" font-family="Menlo, 'DejaVu Sans Mono', monospace" font-size="76" font-weight="700" fill="#f9fafb">Camber Co</text>
  <text x="150" y="395" font-family="Menlo, 'DejaVu Sans Mono', monospace" font-size="34" fill="#9ca3af">The AI consultant who builds.</text>
  <rect x="150" y="428" width="20" height="40" fill="#4ade80"/>
  <text x="150" y="580" font-family="Menlo, 'DejaVu Sans Mono', monospace" font-size="22" fill="#4b5563">camberco.co.uk</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile('public/og-default.png');
console.log('Wrote public/og-default.png');
```

- [ ] Run it and check the output dimensions:

```bash
node scripts/generate-og-image.mjs
# expected: Wrote public/og-default.png
node -e "import('sharp').then(async (s) => { const m = await s.default('public/og-default.png').metadata(); console.log(m.width, m.height, m.format); })"
# expected: 1200 630 png
```

- [ ] Open `public/og-default.png` and eyeball it: dark background, terminal window with three dots, green `$ camber --intro`, white "Camber Co", grey "The AI consultant who builds.", green block cursor. If a font fell back badly (unreadable text), change the `font-family` attributes to `monospace` only and regenerate.
- [ ] In `src/layouts/Layout.astro`, update the front matter defaults (from Task 1's version). Replace:

```ts
const {
  title,
  description,
  schema,
  ogType = 'website',
  ogImage: ogImageProp,
  ogImageAlt: ogImageAltProp,
  ogImageWidth,
  ogImageHeight,
  articleMeta,
} = Astro.props;
```

with:

```ts
const {
  title,
  description,
  schema,
  ogType = 'website',
  ogImage: ogImageProp,
  ogImageAlt: ogImageAltProp,
  ogImageWidth = 1200,
  ogImageHeight = 630,
  articleMeta,
} = Astro.props;
```

and replace:

```ts
const ogImage = ogImageProp ?? 'https://camberco.co.uk/social.png';
const ogImageAlt = ogImageAltProp ?? 'Camber Co — AI services for founders who move fast.';
```

with:

```ts
const ogImage = ogImageProp ?? new URL('/og-default.png', site).href;
const ogImageAlt = ogImageAltProp ?? 'Camber Co. The AI consultant who builds.';
```

- [ ] In the Layout template, replace the conditional width/height lines (currently):

```astro
    {ogImageWidth && <meta property="og:image:width" content={String(ogImageWidth)} />}
    {ogImageHeight && <meta property="og:image:height" content={String(ogImageHeight)} />}
```

with unconditional emission:

```astro
    <meta property="og:image:width" content={String(ogImageWidth)} />
    <meta property="og:image:height" content={String(ogImageHeight)} />
```

- [ ] In `src/pages/blog/[slug].astro`, fix the Article publisher logo (currently points at `social.png` with no dimensions). Replace lines 76-84:

```ts
    publisher: {
      '@type': 'Organization',
      name: 'Camber Co',
      url: 'https://camberco.co.uk',
      logo: {
        '@type': 'ImageObject',
        url: 'https://camberco.co.uk/social.png',
      },
    },
```

with:

```ts
    publisher: {
      '@type': 'Organization',
      name: 'Camber Co',
      url: 'https://camberco.co.uk',
      logo: {
        '@type': 'ImageObject',
        url: 'https://camberco.co.uk/logo.png',
        width: 1024,
        height: 1024,
      },
    },
```

- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify:

```bash
grep -o '<meta property="og:image" content="[^"]*"' .vercel/output/static/index.html
# expected: <meta property="og:image" content="https://camberco.co.uk/og-default.png"
grep -c 'og:image:width' .vercel/output/static/contact/index.html
# expected: 1
grep -o '"logo":{"@type":"ImageObject","url":"https://camberco.co.uk/logo.png","width":1024,"height":1024}' "$(find .vercel/output/static/blog -mindepth 2 -maxdepth 2 -name index.html -not -path '*category*' | head -1)"
# expected: the matched string (skip this check if no blog posts are published)
```

- [ ] Commit:

```bash
git add scripts/generate-og-image.mjs public/og-default.png package.json pnpm-lock.yaml src/layouts/Layout.astro src/pages/blog/
git commit -m "$(cat <<'EOF'
Add 1200x630 default OG image and always emit OG dimensions

Generated with sharp from an inline SVG (terminal aesthetic, tagline).
Article publisher.logo now points at the real 1024x1024 logo.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Blog hardening: getPublishedPosts throws, in-article images get lazy/async/dimensions (TDD)

**Files:**
- Create: `src/lib/blog.test.ts`
- Modify: `src/lib/blog.ts` (lines 30-41 getPublishedPosts; lines 81-96 processHtml; new import)
- Modify: `src/pages/blog/[slug].astro` (line 23)
- Modify: `package.json` (add image-size via pnpm)

**Interfaces:**
- Produces: `getPublishedPosts(): Promise<BlogPost[]>` THROWS on Supabase error (build fails loudly). `processHtml(html: string): Promise<{ html: string; headings: Heading[] }>` is now ASYNC and adds `loading="lazy" decoding="async"` plus probed `width`/`height` to in-article `<img>` tags.
- Consumes: `image-size` v2 named export `imageSize(buffer)`.

**Steps:**

- [ ] Install the image probe dependency (used at build time when pages prerender): `pnpm add image-size`
- [ ] Write the failing tests. Create `src/lib/blog.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublishedPosts, processHtml } from './blog';

const state = vi.hoisted(() => ({
  orderResult: { data: [] as unknown[] | null, error: null as { message: string } | null },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve(state.orderResult),
        }),
      }),
    }),
  }),
}));

const row = {
  slug: 'test-post',
  title: 'Test post',
  description: 'A test post.',
  published_at: '2026-01-05T09:00:00.000Z',
  updated_at: '2026-02-01T10:00:00.000Z',
  author: 'Charlie W',
  category: 'automation',
  tags: ['n8n'],
  cover_image: null,
  cover_image_alt: null,
  featured: false,
  content: '<p>Hello</p>',
};

describe('getPublishedPosts', () => {
  it('throws when Supabase returns an error', async () => {
    state.orderResult = { data: null, error: { message: 'connection refused' } };
    await expect(getPublishedPosts()).rejects.toThrow('connection refused');
  });

  it('returns mapped posts on success', async () => {
    state.orderResult = { data: [row], error: null };
    const posts = await getPublishedPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0].slug).toBe('test-post');
    expect(posts[0].updatedAt?.toISOString()).toBe('2026-02-01T10:00:00.000Z');
  });
});

// 1x1 transparent PNG, 68 bytes.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('processHtml', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(PNG_1X1, { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds ids to h2 and h3 headings', async () => {
    const { html, headings } = await processHtml('<h2>First Section</h2><p>text</p>');
    expect(html).toContain('<h2 id="first-section">First Section</h2>');
    expect(headings).toEqual([{ depth: 2, slug: 'first-section', text: 'First Section' }]);
  });

  it('adds loading, decoding and probed dimensions to images', async () => {
    const { html } = await processHtml('<p>Hi</p><img src="https://example.com/pic.png" alt="x">');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain('width="1"');
    expect(html).toContain('height="1"');
  });

  it('does not override existing loading attributes', async () => {
    const { html } = await processHtml('<img loading="eager" src="https://example.com/pic.png">');
    expect(html).not.toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
  });

  it('leaves images without a probe result usable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })));
    const { html } = await processHtml('<img src="https://example.com/missing.png">');
    expect(html).toContain('loading="lazy"');
    expect(html).not.toContain('width=');
  });
});
```

- [ ] Run `pnpm vitest run src/lib/blog.test.ts`. Expected failures: "throws when Supabase returns an error" fails (resolves to `[]` instead of rejecting) and the three image tests fail (no `loading="lazy"` in output).
- [ ] Implement in `src/lib/blog.ts`. Add the import at the top (after line 1):

```ts
import { imageSize } from 'image-size';
```

  Replace `getPublishedPosts` (lines 30-41) with:

```ts
export async function getPublishedPosts(): Promise<BlogPost[]> {
  const supabase = serverSupabase();
  const { data, error } = await supabase
    .from('blog_drafts')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  // Fail the build loudly instead of silently publishing an empty blog.
  if (error) {
    throw new Error(`getPublishedPosts: Supabase error: ${error.message}`);
  }

  return (data ?? []).map(mapRow);
}
```

  Replace `processHtml` (lines 81-96) with:

```ts
const imageSizeCache = new Map<string, { width: number; height: number } | null>();

async function probeImageSize(src: string): Promise<{ width: number; height: number } | null> {
  const cached = imageSizeCache.get(src);
  if (cached !== undefined) return cached;

  let result: { width: number; height: number } | null = null;
  try {
    const res = await fetch(src, {
      headers: { Range: 'bytes=0-131071' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok || res.status === 206) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      const size = imageSize(bytes);
      if (size.width && size.height) {
        result = { width: size.width, height: size.height };
      }
    }
  } catch {
    result = null;
  }
  imageSizeCache.set(src, result);
  return result;
}

export async function processHtml(html: string): Promise<{ html: string; headings: Heading[] }> {
  const headings: Heading[] = [];

  const withIds = html.replace(
    /<(h[23])>([\s\S]*?)<\/\1>/gi,
    (_match, tag: string, inner: string) => {
      const depth = parseInt(tag.charAt(1), 10);
      const text = inner.replace(/<[^>]+>/g, '').trim();
      const slug = slugify(text);
      headings.push({ depth, slug, text });
      return `<${tag} id="${slug}">${inner}</${tag}>`;
    },
  );

  // In-article images: lazy-load, async decode, and add intrinsic
  // dimensions (probed at build time) to prevent layout shift.
  const imgTags = Array.from(new Set(withIds.match(/<img\b[^>]*>/gi) ?? []));
  let processed = withIds;
  for (const tag of imgTags) {
    let updated = tag;
    if (!/\bloading=/i.test(updated)) {
      updated = updated.replace(/^<img/i, '<img loading="lazy"');
    }
    if (!/\bdecoding=/i.test(updated)) {
      updated = updated.replace(/^<img/i, '<img decoding="async"');
    }
    const srcMatch = updated.match(/\bsrc="([^"]+)"/i);
    const hasDims = /\bwidth=/i.test(updated) && /\bheight=/i.test(updated);
    if (srcMatch && !hasDims && /^https?:\/\//i.test(srcMatch[1])) {
      const size = await probeImageSize(srcMatch[1]);
      if (size) {
        updated = updated.replace(/^<img/i, `<img width="${size.width}" height="${size.height}"`);
      }
    }
    processed = processed.split(tag).join(updated);
  }

  return { html: processed, headings };
}
```

- [ ] Update the one caller: in `src/pages/blog/[slug].astro` line 23, replace:

```ts
const { html: articleHtml, headings } = processHtml(post.content);
```

with:

```ts
const { html: articleHtml, headings } = await processHtml(post.content);
```

- [ ] Run `pnpm vitest run src/lib/blog.test.ts`. Expected: all 6 tests pass.
- [ ] Run `pnpm build`. Expected: success. Spot-check a built post (skip if no post has in-article images; the unit tests are authoritative):

```bash
POST=$(find .vercel/output/static/blog -mindepth 2 -maxdepth 2 -name index.html -not -path '*category*' | head -1)
grep -o '<img [^>]*loading="lazy"[^>]*>' "$POST" | head -3
```

- [ ] Commit:

```bash
git add src/lib/blog.ts src/lib/blog.test.ts src/pages/blog/ package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
Harden blog build: throw on Supabase error, optimise in-article images

getPublishedPosts now fails the build loudly. processHtml adds
loading=lazy, decoding=async and probed width/height to article images.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Category pages only for non-empty categories, filter chips derived from real posts

**Files:**
- Modify: `src/pages/blog/category/[category].astro` (lines 7-20 getStaticPaths; lines 38-46 allCategories)
- Modify: `src/pages/blog/index.astro` (lines 12-20 categories)

**Interfaces:**
- Consumes: `getPublishedPosts` from `src/lib/blog.ts` (Task 5 version).
- Produces: `getStaticPaths` emits only categories that have at least one published post; filter chips on both pages list only those categories (plus All Posts), so no chip links to a 404.

**Steps:**

- [ ] In `src/pages/blog/category/[category].astro`, replace `getStaticPaths` (lines 7-20) with:

```ts
export async function getStaticPaths() {
  const posts = await getPublishedPosts();
  const categories = [...new Set(posts.map((p) => p.category))];
  return categories.map((cat) => ({ params: { category: cat } }));
}
```

- [ ] In the same file, replace the hardcoded `allCategories` (lines 38-46) with:

```ts
const presentCategories = [...new Set(allPosts.map((p) => p.category))];
const allCategories = [
  { value: 'all', label: 'All Posts' },
  ...presentCategories.map((value) => ({ value, label: categoryLabels[value] ?? value })),
];
```

  (`categoryLabels` and `allPosts` already exist above in the file; keep them.)
- [ ] In `src/pages/blog/index.astro`, replace the hardcoded `categories` (lines 12-20) with:

```ts
const categoryLabels: Record<string, string> = {
  'ai-strategy': 'AI Strategy',
  'automation': 'Automation',
  'case-study': 'Case Study',
  'tools-and-workflows': 'Tools & Workflows',
  'founder-journey': 'Founder Journey',
  'industry-trends': 'Industry Trends',
};

const presentCategories = [...new Set(posts.map((p) => p.category))];
const categories = [
  { value: 'all', label: 'All Posts' },
  ...presentCategories.map((value) => ({ value, label: categoryLabels[value] ?? value })),
];
```

- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify only non-empty categories were generated:

```bash
ls .vercel/output/static/blog/category/
# expected: one directory per category that has at least one published post, nothing else
grep -c 'class="filter-chip' .vercel/output/static/blog/index.html
# expected: (number of directories above) + 1
```

- [ ] Commit:

```bash
git add src/pages/blog/
git commit -m "$(cat <<'EOF'
Generate blog category pages only for categories with posts

Filter chips on the blog index and category pages are derived from real
posts, so no chip links to an empty or missing page.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Sitemap lastmod from post updatedAt, RSS with full content and author (TDD)

**Files:**
- Create: `src/lib/sitemap.ts`
- Create: `src/lib/sitemap.test.ts`
- Modify: `astro.config.mjs` (whole file, Task 2 version)
- Modify: `src/pages/rss.xml.ts` (whole file, 21 lines)

**Interfaces:**
- Produces:
  - `blogSlugFromUrl(url: string): string | null` in `src/lib/sitemap.ts`
  - `withLastmod(item: SitemapItem, lastmodBySlug: Map<string, string>): SitemapItem` in `src/lib/sitemap.ts`
- Consumes: `@astrojs/sitemap` `serialize` hook (may be async, verified in `node_modules/@astrojs/sitemap/dist/index.js:101`); Supabase REST endpoint `GET {url}/rest/v1/blog_drafts?status=eq.published&select=slug,updated_at,published_at` (config-time fetch, avoids import.meta.env in astro.config).

**Steps:**

- [ ] Write the failing test. Create `src/lib/sitemap.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { blogSlugFromUrl, withLastmod } from './sitemap';

describe('blogSlugFromUrl', () => {
  it('extracts the slug from a blog post URL with or without trailing slash', () => {
    expect(blogSlugFromUrl('https://camberco.co.uk/blog/my-post')).toBe('my-post');
    expect(blogSlugFromUrl('https://camberco.co.uk/blog/my-post/')).toBe('my-post');
  });

  it('returns null for non-post URLs', () => {
    expect(blogSlugFromUrl('https://camberco.co.uk/blog')).toBeNull();
    expect(blogSlugFromUrl('https://camberco.co.uk/blog/category/automation')).toBeNull();
    expect(blogSlugFromUrl('https://camberco.co.uk/contact')).toBeNull();
    expect(blogSlugFromUrl('not a url')).toBeNull();
  });
});

describe('withLastmod', () => {
  const map = new Map([['my-post', '2026-02-01T10:00:00.000Z']]);

  it('adds lastmod for known blog posts', () => {
    const item = withLastmod({ url: 'https://camberco.co.uk/blog/my-post' }, map);
    expect(item.lastmod).toBe('2026-02-01T10:00:00.000Z');
  });

  it('leaves other URLs untouched', () => {
    const item = withLastmod({ url: 'https://camberco.co.uk/contact' }, map);
    expect(item.lastmod).toBeUndefined();
  });
});
```

- [ ] Run `pnpm vitest run src/lib/sitemap.test.ts`. Expected failure: cannot resolve `./sitemap` (module does not exist).
- [ ] Create `src/lib/sitemap.ts`:

```ts
export interface SitemapItem {
  url: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
  links?: unknown[];
}

export function blogSlugFromUrl(url: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const normalised = pathname.replace(/\/+$/, '');
  const match = normalised.match(/^\/blog\/([^/]+)$/);
  if (!match || match[1] === 'category') return null;
  return match[1];
}

export function withLastmod(
  item: SitemapItem,
  lastmodBySlug: Map<string, string>,
): SitemapItem {
  const slug = blogSlugFromUrl(item.url);
  if (!slug) return item;
  const lastmod = lastmodBySlug.get(slug);
  if (!lastmod) return item;
  return { ...item, lastmod };
}
```

- [ ] Run `pnpm vitest run src/lib/sitemap.test.ts`. Expected: all 4 tests pass.
- [ ] Wire the serialize hook. Replace `astro.config.mjs` (the Task 2 version) with:

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import { loadEnv } from 'vite';
import { withLastmod } from './src/lib/sitemap.ts';

const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');

let lastmodPromise;

async function fetchBlogLastmod() {
  const url = env.PUBLIC_SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Map();
  try {
    const res = await fetch(
      `${url}/rest/v1/blog_drafts?status=eq.published&select=slug,updated_at,published_at`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) return new Map();
    const rows = await res.json();
    return new Map(rows.map((row) => [row.slug, row.updated_at ?? row.published_at]));
  } catch {
    return new Map();
  }
}

export default defineConfig({
  site: 'https://camberco.co.uk',
  trailingSlash: 'never',
  integrations: [
    sitemap({
      filter: (page) => !new URL(page).pathname.startsWith('/admin'),
      serialize: async (item) => withLastmod(item, await (lastmodPromise ??= fetchBlogLastmod())),
    }),
    react(),
  ],
  adapter: vercel(),
});
```

- [ ] Replace `src/pages/rss.xml.ts` with:

```ts
import rss from '@astrojs/rss';
import { getPublishedPosts } from '../lib/blog';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();
  return rss({
    title: 'Camber Co Blog',
    description: 'AI strategy, automation, and insights for founders and small teams.',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.title,
      pubDate: post.publishedAt,
      description: post.description,
      link: `/blog/${post.slug}`,
      categories: [post.category, ...post.tags],
      author: `hello@camberco.co.uk (${post.author})`,
      content: post.content,
    })),
    customData: `<language>en-gb</language>`,
  });
}
```

- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify:

```bash
grep -o '<url><loc>[^<]*</loc><lastmod>[^<]*</lastmod></url>' .vercel/output/static/sitemap-0.xml | head -3
# expected: blog post URLs carry a <lastmod> ISO date (skip if no posts are published)
grep -c 'content:encoded' .vercel/output/static/rss.xml
# expected: 1 or more (one per published post)
grep -o '<author>[^<]*</author>' .vercel/output/static/rss.xml | head -1
# expected: <author>hello@camberco.co.uk (Charlie W)</author>
```

- [ ] Commit:

```bash
git add src/lib/sitemap.ts src/lib/sitemap.test.ts astro.config.mjs src/pages/rss.xml.ts
git commit -m "$(cat <<'EOF'
Add sitemap lastmod for blog posts and enrich RSS with content and author

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Structured data fixes: LocalBusiness/Organization nits, single-source FAQ, BreadcrumbList on services/about/contact

**Files:**
- Modify: `src/pages/index.astro` (lines 10-45 Organization; line 73 telephone; lines 170-280 FAQPage; lines 561-693 FAQ markup)
- Modify: `src/pages/contact.astro` (lines 1-10)
- Modify: `src/pages/about-me.astro` (lines 240-262)
- Modify: `src/pages/services/index.astro` (lines 72-88)
- Modify: `src/pages/services/automation.astro` (lines 75-88)
- Modify: `src/pages/services/apps.astro` (schema const ending at the `---` before the Layout call; object spans ~14 lines)
- Modify: `src/pages/services/builds.astro` (schema const ending at the `---` before the Layout call; object spans ~14 lines)

**Interfaces:**
- Consumes: Footer's LinkedIn URL `https://linkedin.com/company/camber-co` (`src/components/Footer.astro:46`) as the single company LinkedIn everywhere; `public/og-default.png` from Task 4; `public/logo.png` is 1024x1024.
- Produces: homepage `faqs` array as the single source for both the visible FAQ and the FAQPage schema (they can never drift again).

**Steps:**

- [ ] In `src/pages/index.astro`, fix the Organization block. Replace lines 24-33:

```ts
    "logo": {
      "@type": "ImageObject",
      "url": "https://camberco.co.uk/logo.png",
      "width": 409,
      "height": 431
    },
    "image": "https://camberco.co.uk/social.png",
    "description": "Camber Co is a London-based digital consultancy specialising in AI systems, SEO, web development, n8n workflow automation, solo founder coaching, and personal AI assistants for UK founders and small businesses.",
    "email": "hello@camberco.co.uk",
    "sameAs": ["https://linkedin.com/company/camberco"],
```

with:

```ts
    "logo": {
      "@type": "ImageObject",
      "url": "https://camberco.co.uk/logo.png",
      "width": 1024,
      "height": 1024
    },
    "image": "https://camberco.co.uk/og-default.png",
    "description": "Camber Co is a London-based digital consultancy specialising in AI systems, SEO, web development, n8n workflow automation, solo founder coaching, and personal AI assistants for UK founders and small businesses.",
    "email": "hello@camberco.co.uk",
    "sameAs": ["https://linkedin.com/company/camber-co"],
```

  (`foundingDate` on line 18 is already `"2024"`; leave it. The visible "EST. 2026" hero chip is Plan 4's copy fix.)
- [ ] In the LocalBusiness block, delete line 73 (`    "telephone": "",`) and add an image property directly after the `"url"` line (line 72):

```ts
    "image": "https://camberco.co.uk/og-default.png",
```

- [ ] Make the FAQ single-source. In the front matter of `src/pages/index.astro`, BEFORE `const schema = JSON.stringify([`, add the `faqs` const. The strings are the CURRENT VISIBLE FAQ text moved verbatim (lines 563-691); Plan 4 owns any copy rewrites:

```ts
const faqs = [
  {
    q: `What does an AI consultancy actually do?`,
    a: `An AI consultancy helps businesses identify where artificial intelligence can save time, reduce costs, and improve operations. At Camber Co, we go beyond advising — we build and deploy working tools including n8n workflow automation, websites, web apps, SEO, and personal AI assistants. We work with a small number of clients at a time to ensure every engagement delivers something real.`,
  },
  {
    q: `How much does AI consultancy cost in the UK?`,
    a: `Pricing depends on what you need — every business is different. At Camber Co, every engagement starts with a free 30-minute audit call where we understand your situation and recommend the right approach. Click "explore" on any service to chat with our AI and get a personalised recommendation, or book a call directly. No commitment required.`,
  },
  {
    q: `What is an AI readiness audit?`,
    a: `An AI readiness audit is a focused assessment of your business operations and processes to identify where AI can deliver the highest return on investment. Our free 30-minute audit call and paid AI consultation sessions are designed to give you clarity on exactly which tasks to automate first and what tools to use — with no jargon and no commitment. You'll walk away with a clear, prioritised action list.`,
  },
  {
    q: `Can AI help small businesses in the UK?`,
    a: `Absolutely. AI is particularly powerful for small businesses because it can automate the repetitive admin tasks that consume disproportionate amounts of time. Camber Co works with UK founders and SMEs to compress hours of manual work into automated workflows. Our approach is practical — we focus on the specific tasks eating your week and build solutions that run without constant supervision.`,
  },
  {
    q: `How long does it take to implement AI in a business?`,
    a: `Implementation timelines depend on scope. A website or landing page can ship in 1-2 weeks. An n8n workflow automation can be built and deployed in 1-2 weeks. SEO is ongoing but you will see early improvements within the first month. Consultation and training sessions can start immediately. We prioritise quick wins that deliver value from day one.`,
  },
  {
    q: `Do I need technical knowledge to use the AI tools you build?`,
    a: `No. Everything we build is designed for non-technical users. Our Solo Founder Training specifically targets founders without a technical background. We handle development, deployment, and integration, then ensure you understand how to run what we've built. You should never be dependent on us to operate your own systems — that's the whole point.`,
  },
  {
    q: `Why hire an AI consultant instead of just using ChatGPT?`,
    a: `ChatGPT is a general-purpose tool. Camber Co builds bespoke solutions tailored to your specific business — connecting AI to your actual tools, data, and workflows. Instead of manually typing queries, we build systems that run automatically: n8n pipelines that handle tasks 24/7, or a personal AI assistant trained on your business context that lives inside WhatsApp or Slack. The difference is between having a tool and having a system.`,
  },
  {
    q: `Do you work with businesses outside London?`,
    a: `Yes. While Camber Co is based in London, we work with founders and small businesses across the UK. Consultations, training, and strategy sessions are conducted remotely via video call. Automation and AI assistant projects are delivered fully remotely — geography is not a barrier.`,
  },
  {
    q: `What is n8n workflow automation?`,
    a: `N8n is an open-source workflow automation platform that connects your business tools — email, CRM, spreadsheets, payment systems — and runs automated tasks between them 24/7. Camber Co builds and deploys custom n8n automations for UK businesses, typically saving 10-30 hours per month on repetitive processes.`,
  },
  {
    q: `Do you offer SEO for small businesses?`,
    a: `Yes. Camber Co offers practical SEO for UK small businesses and founders. We cover technical audits, on-page optimisation, keyword research, and content strategy. Our focus is on traffic that converts, not vanity metrics. SEO is delivered by a small team of trusted specialists, with Charlie leading strategy and ensuring everything ties back to your business goals.`,
  },
  {
    q: `Can you build me a website or app?`,
    a: `Yes. We build clean, fast websites and simple web apps for small businesses. Whether you need a landing page, a full company site, or a lightweight web app, we handle design and development end to end. Every build is performance-focused and designed to convert visitors into customers.`,
  },
  {
    q: `What is a personal AI assistant?`,
    a: `A personal AI assistant is an AI trained on your business context — your documents, processes, and knowledge — that runs on platforms you already use like WhatsApp, Telegram, or Slack. Unlike generic AI tools like ChatGPT, it knows your business specifically and can handle tasks, answer questions, and automate workflows tailored to your operations. Camber Co deploys these using OpenClaw, an open-source platform that keeps your data private and local.`,
  },
  {
    q: `What AI training do you offer for non-technical founders?`,
    a: `Our Solo Founder Training is hands-on coaching designed for people who want to use AI in their business but don't have a technical background. We cover practical skills: how to evaluate AI tools, build simple automations, prompt effectively, and ship AI-powered features. Sessions are 1:1 and tailored to your specific business and goals.`,
  },
];
```

- [ ] Replace the entire hardcoded FAQPage object inside the `schema` array (lines 170-280, from `{` before `"@type": "FAQPage"` through its closing `}` before the final `]`) with:

```ts
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": "https://camberco.co.uk/#faq",
    "mainEntity": faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.q,
      "acceptedAnswer": { "@type": "Answer", "text": faq.a },
    })),
  }
```

- [ ] Replace the 13 hardcoded `<details>` blocks in the FAQ section (the children of `<div class="faq-list" data-reveal>`, lines 561-693) with:

```astro
      <div class="faq-list" data-reveal>
        {faqs.map((faq, i) => (
          <details class="faq-item" open={i === 0}>
            <summary class="faq-question">
              <span class="faq-arrow">&gt;</span>
              <span class="faq-q-text">{faq.q}</span>
            </summary>
            <div class="faq-answer">
              <p>{faq.a}</p>
            </div>
          </details>
        ))}
      </div>
```

- [ ] Add ContactPage + BreadcrumbList schema to `src/pages/contact.astro`. Replace lines 1-9 (the front matter and the `<Layout ...>` opening tag through its closing `>`; Task 1 already removed the canonicalUrl line) with:

```astro
---
import Layout from '../layouts/Layout.astro';
import ChatDrawer from '../components/ChatDrawer.astro';

const schema = JSON.stringify([
  {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    '@id': 'https://camberco.co.uk/contact#webpage',
    url: 'https://camberco.co.uk/contact',
    name: 'Contact Camber Co',
    description: 'Contact Camber Co about AI automation, websites, apps, SEO, training, or personal AI. Every enquiry gets a reply within 24 hours.',
    isPartOf: { '@id': 'https://camberco.co.uk/#website' },
    about: { '@id': 'https://camberco.co.uk/#organization' },
    inLanguage: 'en-GB',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://camberco.co.uk/' },
      { '@type': 'ListItem', position: 2, name: 'Contact', item: 'https://camberco.co.uk/contact' },
    ],
  },
]);
---

<Layout
  title="Get in Touch — Camber Co"
  description="Ready to move fast with AI? Get in touch with Camber Co for AI strategy, automation, training, or a custom AI bot."
  schema={schema}
>
```

  (Title/description text is existing copy; Plan 4 owns rewording.)
- [ ] Add BreadcrumbList to `src/pages/about-me.astro`. The schema const (lines 240-262) is a single Person object; wrap it in an array and append the breadcrumb. Replace `const schema = JSON.stringify({` with `const schema = JSON.stringify([` and `});` (line 262) with:

```ts
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://camberco.co.uk/' },
      { '@type': 'ListItem', position: 2, name: 'About', item: 'https://camberco.co.uk/about-me' },
    ],
  },
]);
```

  (Also change the Person object's opening brace to sit inside the array: the first array element starts with `  {` followed by the existing `'@context': 'https://schema.org',` line.)
- [ ] Same array-wrap for `src/pages/services/index.astro` (lines 72-88): keep the ItemList object as the first element and append:

```ts
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://camberco.co.uk/' },
      { '@type': 'ListItem', position: 2, name: 'Services', item: 'https://camberco.co.uk/services' },
    ],
  },
```

- [ ] Same array-wrap for the three service pages. Keep each existing Service object as the first element and append a three-level breadcrumb:
  - `src/pages/services/automation.astro` (schema at lines 75-88), third item `{ '@type': 'ListItem', position: 3, name: 'Workflow automation', item: 'https://camberco.co.uk/services/automation' }`
  - `src/pages/services/apps.astro`, third item `{ '@type': 'ListItem', position: 3, name: 'Mobile apps', item: 'https://camberco.co.uk/services/apps' }`
  - `src/pages/services/builds.astro`, third item `{ '@type': 'ListItem', position: 3, name: 'Website builds', item: 'https://camberco.co.uk/services/builds' }`

  Each appended element looks like (automation shown; swap the third item per page):

```ts
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://camberco.co.uk/' },
      { '@type': 'ListItem', position: 2, name: 'Services', item: 'https://camberco.co.uk/services' },
      { '@type': 'ListItem', position: 3, name: 'Workflow automation', item: 'https://camberco.co.uk/services/automation' },
    ],
  },
```

- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify schema correctness against the built output:

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('.vercel/output/static/index.html', 'utf8');
const m = html.match(/<script type=\"application\/ld\+json\">(.*?)<\/script>/s);
const data = JSON.parse(m[1]);
const faq = data.find((d) => d['@type'] === 'FAQPage');
const lb = data.find((d) => Array.isArray(d['@type']) && d['@type'].includes('LocalBusiness'));
const org = data.find((d) => d['@type'] === 'Organization');
console.log('faq entries:', faq.mainEntity.length);
console.log('telephone present:', 'telephone' in lb);
console.log('lb image:', lb.image);
console.log('logo dims:', org.logo.width, org.logo.height);
console.log('sameAs:', org.sameAs[0]);
"
# expected:
# faq entries: 13
# telephone present: false
# lb image: https://camberco.co.uk/og-default.png
# logo dims: 1024 1024
# sameAs: https://linkedin.com/company/camber-co
node -e "
const fs = require('fs');
for (const p of ['contact/index.html', 'about-me/index.html', 'services/index.html', 'services/automation/index.html']) {
  const html = fs.readFileSync('.vercel/output/static/' + p, 'utf8');
  const m = html.match(/<script type=\"application\/ld\+json\">(.*?)<\/script>/s);
  const data = JSON.parse(m[1]);
  const bc = data.find((d) => d['@type'] === 'BreadcrumbList');
  console.log(p, '->', bc ? bc.itemListElement.map((i) => i.name).join(' / ') : 'MISSING');
}
"
# expected: each page prints its breadcrumb trail, none MISSING
grep -c 'faq-item' .vercel/output/static/index.html
# expected: 13
```

- [ ] Commit:

```bash
git add src/pages/
git commit -m "$(cat <<'EOF'
Fix structured data: single-source FAQ, breadcrumbs, LocalBusiness nits

FAQPage is now generated from the same array as the visible FAQ. Empty
telephone removed, LocalBusiness image added, logo dimensions corrected,
one LinkedIn URL everywhere, BreadcrumbList on services/about/contact.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Server-side admin gate via src/middleware.ts (TDD for the path guard)

**Files:**
- Create: `src/lib/admin-guard.ts`
- Create: `src/lib/admin-guard.test.ts`
- Create: `src/middleware.ts`
- Modify: `src/pages/admin/index.astro` (line 1: add prerender export)
- Modify: `src/pages/admin/login.astro` (line 1 + script block lines 108-153)
- Modify: `src/pages/admin/editor.astro` (line 1)
- Modify: `src/pages/admin/enquiries.astro` (line 1)
- Modify: `src/pages/admin/auth/callback.astro` (script block lines 29-73)

**Interfaces:**
- Consumes: the existing session mechanism exactly: supabase-js `signInWithPassword`/`getSession` on the client (`src/pages/admin/login.astro:132`, `src/pages/admin/index.astro:128`), validated server-side with `supabase.auth.getUser(token)` using `PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (same as `src/pages/api/admin/auth.ts:6-10,25`). The client session lives in localStorage, which the server cannot read, so login/callback mirror the access token into a cookie for the middleware.
- Produces:
  - `ADMIN_SESSION_COOKIE = 'camber-admin-token'`, `isAdminPath(pathname: string): boolean`, `isProtectedAdminPath(pathname: string): boolean` in `src/lib/admin-guard.ts`
  - `onRequest` middleware: anonymous requests to protected `/admin/*` routes get a 302 to `/admin/login`; ALL `/admin/*` responses get `X-Robots-Tag: noindex, nofollow`.
- Important: middleware only runs at request time for server-rendered routes, so the four admin pages that are currently prerendered must gain `export const prerender = false;`. `/api/admin/*` routes are untouched (pathname `/api/admin/...` does not start with `/admin`), keeping their existing Bearer auth.

**Steps:**

- [ ] Write the failing test. Create `src/lib/admin-guard.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isAdminPath, isProtectedAdminPath } from './admin-guard';

describe('isAdminPath', () => {
  it('matches /admin and nested admin routes, with or without trailing slash', () => {
    expect(isAdminPath('/admin')).toBe(true);
    expect(isAdminPath('/admin/')).toBe(true);
    expect(isAdminPath('/admin/editor')).toBe(true);
    expect(isAdminPath('/admin/editor/abc-123')).toBe(true);
  });

  it('ignores non-admin routes, lookalikes and API routes', () => {
    expect(isAdminPath('/')).toBe(false);
    expect(isAdminPath('/administrator')).toBe(false);
    expect(isAdminPath('/api/admin/auth')).toBe(false);
  });
});

describe('isProtectedAdminPath', () => {
  it('protects the dashboard, editor, enquiries and settings', () => {
    expect(isProtectedAdminPath('/admin')).toBe(true);
    expect(isProtectedAdminPath('/admin/editor')).toBe(true);
    expect(isProtectedAdminPath('/admin/editor/abc-123')).toBe(true);
    expect(isProtectedAdminPath('/admin/enquiries')).toBe(true);
    expect(isProtectedAdminPath('/admin/settings')).toBe(true);
  });

  it('leaves login and the auth callback public', () => {
    expect(isProtectedAdminPath('/admin/login')).toBe(false);
    expect(isProtectedAdminPath('/admin/login/')).toBe(false);
    expect(isProtectedAdminPath('/admin/auth/callback')).toBe(false);
  });

  it('is false for non-admin paths', () => {
    expect(isProtectedAdminPath('/contact')).toBe(false);
  });
});
```

- [ ] Run `pnpm vitest run src/lib/admin-guard.test.ts`. Expected failure: cannot resolve `./admin-guard`.
- [ ] Create `src/lib/admin-guard.ts`:

```ts
// Path rules for the server-side admin gate (src/middleware.ts) and the
// cookie the client login flow uses to hand its Supabase access token to
// the server. The cookie mirrors the localStorage session that
// supabase-js already maintains; it is validated on every admin request
// with supabase.auth.getUser(token).
export const ADMIN_SESSION_COOKIE = 'camber-admin-token';

const PUBLIC_ADMIN_PATHS = new Set(['/admin/login', '/admin/auth/callback']);

function normalise(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

export function isAdminPath(pathname: string): boolean {
  const p = normalise(pathname);
  return p === '/admin' || p.startsWith('/admin/');
}

export function isProtectedAdminPath(pathname: string): boolean {
  if (!isAdminPath(pathname)) return false;
  return !PUBLIC_ADMIN_PATHS.has(normalise(pathname));
}
```

- [ ] Run `pnpm vitest run src/lib/admin-guard.test.ts`. Expected: all 5 tests pass.
- [ ] Create `src/middleware.ts`:

```ts
import { defineMiddleware } from 'astro:middleware';
import { createClient } from '@supabase/supabase-js';
import { ADMIN_SESSION_COOKIE, isAdminPath, isProtectedAdminPath } from './lib/admin-guard';

async function isValidToken(token: string): Promise<boolean> {
  try {
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL ?? '',
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data, error } = await supabase.auth.getUser(token);
    return !error && Boolean(data.user);
  } catch {
    return false;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  if (!isAdminPath(pathname)) {
    return next();
  }

  if (isProtectedAdminPath(pathname)) {
    const token = context.cookies.get(ADMIN_SESSION_COOKIE)?.value ?? '';
    const valid = token ? await isValidToken(token) : false;
    if (!valid) {
      const redirect = context.redirect('/admin/login', 302);
      redirect.headers.set('X-Robots-Tag', 'noindex, nofollow');
      return redirect;
    }
  }

  const response = await next();
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
});
```

- [ ] Make every admin page server-rendered so the middleware actually runs for it in production. In each of `src/pages/admin/index.astro`, `src/pages/admin/login.astro`, `src/pages/admin/editor.astro`, `src/pages/admin/enquiries.astro`, insert as the first line inside the frontmatter (immediately after the opening `---`):

```ts
export const prerender = false;
```

  (`src/pages/admin/settings.astro`, `src/pages/admin/editor/[id].astro` and `src/pages/admin/auth/callback.astro` already have it.)
- [ ] Teach the login page to mirror the session into the cookie. In `src/pages/admin/login.astro`, replace the whole `<script>` block (lines 108-153) with:

```html
<script>
  import { supabase } from '../../lib/supabase';
  import { ADMIN_SESSION_COOKIE } from '../../lib/admin-guard';

  const form = document.getElementById('login-form') as HTMLFormElement;
  const errorEl = document.getElementById('login-error') as HTMLDivElement;
  const btn = document.getElementById('login-btn') as HTMLButtonElement;

  function setSessionCookie(token: string, expiresIn?: number) {
    const maxAge = expiresIn ?? 3600;
    document.cookie = `${ADMIN_SESSION_COOKIE}=${token}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
  }

  // Already signed in client-side (localStorage session): refresh the
  // server cookie and continue to the dashboard.
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      setSessionCookie(session.access_token, session.expires_in);
      window.location.href = '/admin';
    }
  });

  function showError(msg: string) {
    errorEl.textContent = msg;
    errorEl.style.display = 'block';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.style.display = 'none';

    btn.disabled = true;
    btn.textContent = '$ signing in…';

    const formData = new FormData(form);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (!data.session) {
        showError('No session returned');
        btn.disabled = false;
        btn.textContent = '$ sign in';
        return;
      }

      setSessionCookie(data.session.access_token, data.session.expires_in);
      window.location.href = '/admin';
    } catch (err) {
      showError((err as Error).message);
      btn.disabled = false;
      btn.textContent = '$ sign in';
    }
  });
</script>
```

- [ ] Same for the OAuth/PKCE callback. In `src/pages/admin/auth/callback.astro`, replace the whole `<script>` block (lines 29-73) with:

```html
<script>
  import { createClient } from '@supabase/supabase-js';
  import { ADMIN_SESSION_COOKIE } from '../../../lib/admin-guard';

  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  );

  function setSessionCookie(token: string, expiresIn?: number) {
    const maxAge = expiresIn ?? 3600;
    document.cookie = `${ADMIN_SESSION_COOKIE}=${token}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
  }

  async function handleCallback() {
    const statusEl = document.getElementById('callback-status') as HTMLParagraphElement;

    try {
      // PKCE flow: exchange the ?code= param for a session
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
        if (data.session) {
          setSessionCookie(data.session.access_token, data.session.expires_in);
        }
        window.location.href = '/admin';
        return;
      }

      // Implicit flow fallback: hash fragment with access_token
      const hash = window.location.hash;
      if (hash && hash.includes('access_token')) {
        // Supabase client auto-detects hash tokens on init, just check session
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data.session) {
          setSessionCookie(data.session.access_token, data.session.expires_in);
          window.location.href = '/admin';
          return;
        }
      }

      statusEl.textContent = 'No session found. Redirecting to login…';
      setTimeout(() => { window.location.href = '/admin/login'; }, 2000);
    } catch (err) {
      statusEl.textContent = `Error: ${(err as Error).message}`;
      setTimeout(() => { window.location.href = '/admin/login'; }, 3000);
    }
  }

  handleCallback();
</script>
```

- [ ] Run `pnpm build`. Expected: success (admin pages now compile as server routes).
- [ ] Verify the gate against the dev server:

```bash
pnpm dev --port 4399 > /tmp/astro-dev.log 2>&1 &
sleep 8
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:4399/admin
# expected: 302 http://localhost:4399/admin/login
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:4399/admin/enquiries
# expected: 302 http://localhost:4399/admin/login
curl -sI http://localhost:4399/admin/login | grep -i x-robots-tag
# expected: x-robots-tag: noindex, nofollow
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:4399/admin/login
# expected: 200
kill %1 2>/dev/null || pkill -f "astro dev"
```

- [ ] Commit:

```bash
git add src/lib/admin-guard.ts src/lib/admin-guard.test.ts src/middleware.ts src/pages/admin/
git commit -m "$(cat <<'EOF'
Gate /admin server-side with middleware and noindex admin responses

Admin pages become server-rendered; the existing Supabase client session
is mirrored into a cookie at login and validated per request with
auth.getUser. Anonymous visitors are redirected to /admin/login.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Stats render final values server-side and animate from zero on intersection

**Files:**
- Modify: `src/scripts/scroll-reveal.ts` (lines 134-205, initCounters)
- Modify: `src/pages/index.astro` (lines 483, 487)
- Modify: `src/pages/about-me.astro` (lines 340, 345, 355, 360)

**Interfaces:**
- Produces: `[data-count-to]` elements now ship their FINAL value as server-rendered text (crawlers and no-JS visitors see "40+", never "0+"). `initCounters()` zeroes them only when it is actually going to animate (motion allowed AND IntersectionObserver available); with `prefers-reduced-motion` the server-rendered value is left untouched (static fallback).
- Note: the homepage stat COPY (including replacing the "£m+" stat) is Plan 4's file/scope; this task touches only the `data-count-to` spans and the counter mechanism.

**Steps:**

- [ ] In `src/scripts/scroll-reveal.ts`, replace the existing JSDoc comment and initCounters together (lines 119-205, from the `/**` directly above `export function initCounters` through the function's closing `}`) with:

```ts
/**
 * Animates a number from 0 to its target value when the element enters the
 * viewport.
 *
 * The element must be server-rendered with its FINAL value as text content
 * (e.g. `<span data-count-to="40" data-count-suffix="+">40+</span>`), so
 * crawlers and no-JS visitors always see the real number. The script only
 * resets to 0 when the count-up animation is definitely going to run.
 *
 * Required attribute:
 *   data-count-to="40"      — target numeric value
 *
 * Optional attribute:
 *   data-count-suffix="+"   — text appended after the number (e.g. "+", "%", "x")
 *
 * Duration: 800 ms, ease-out (quartic).
 * Reduced motion: no reset, no animation; the server-rendered value stays.
 */
export function initCounters(): void {
  const DURATION = 800; // ms

  const elements = Array.from(
    document.querySelectorAll<HTMLElement>("[data-count-to]")
  );

  if (elements.length === 0) return;

  // Reduced motion (or no IntersectionObserver): keep the server-rendered
  // final values untouched. This is the static fallback.
  if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
    return;
  }

  // Ease-out quartic easing.
  function easeOutQuart(t: number): number {
    return 1 - Math.pow(1 - t, 4);
  }

  function animateCounter(el: HTMLElement): void {
    const target = parseFloat(el.dataset["countTo"] ?? "0");
    const suffix = el.dataset["countSuffix"] ?? "";
    const isFloat = !Number.isInteger(target);
    const decimals = isFloat
      ? (el.dataset["countTo"]?.split(".")[1]?.length ?? 1)
      : 0;

    const startTime = performance.now();

    function tick(now: number): void {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / DURATION, 1);
      const eased = easeOutQuart(progress);
      const current = eased * target;

      el.textContent = current.toFixed(decimals) + suffix;

      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        // Ensure the final value is exact.
        el.textContent = target.toFixed(decimals) + suffix;
      }
    }

    requestAnimationFrame(tick);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCounter(entry.target as HTMLElement);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.5 }
  );

  elements.forEach((el) => {
    // The element arrives with its final value server-rendered. Zero it
    // only now that the count-up is guaranteed to run.
    const suffix = el.dataset["countSuffix"] ?? "";
    const target = parseFloat(el.dataset["countTo"] ?? "0");
    const isFloat = !Number.isInteger(target);
    const decimals = isFloat
      ? (el.dataset["countTo"]?.split(".")[1]?.length ?? 1)
      : 0;
    el.textContent = (0).toFixed(decimals) + suffix;

    observer.observe(el);
  });
}
```

- [ ] Server-render the final values in `src/pages/index.astro`:
  - Line 483: `<span class="stat-number" data-count-to="40" data-count-suffix="+">0+</span>` → `<span class="stat-number" data-count-to="40" data-count-suffix="+">40+</span>`
  - Line 487: `<span class="stat-number" data-count-to="12">0</span>` → `<span class="stat-number" data-count-to="12">12</span>`
- [ ] Same in `src/pages/about-me.astro`:
  - Line 340: `<span data-count-to="12">0</span>` → `<span data-count-to="12">12</span>`
  - Line 345: `<span data-count-to="7">0</span>` → `<span data-count-to="7">7</span>`
  - Line 355: `<span data-count-to="500">0</span>` → `<span data-count-to="500">500</span>`
  - Line 360: `<span data-count-to="4">0</span>` → `<span data-count-to="4">4</span>`
- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify server-rendered values in the output:

```bash
grep -o 'data-count-to="40" data-count-suffix="+">[^<]*<' .vercel/output/static/index.html
# expected: data-count-to="40" data-count-suffix="+">40+<
grep -o 'data-count-to="500">[^<]*<' .vercel/output/static/about-me/index.html
# expected: data-count-to="500">500<
```

- [ ] Commit:

```bash
git add src/scripts/scroll-reveal.ts src/pages/index.astro src/pages/about-me.astro
git commit -m "$(cat <<'EOF'
Server-render stat values, animate count-up only when motion is allowed

Crawlers and reduced-motion visitors now see the real numbers; the
count-up from zero runs on intersection as a progressive enhancement.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Vercel primary domain: apex primary, www 308s (REQUIRES CHARLIE OR VERCEL CLI ACCESS)

**Files:**
- None (Vercel dashboard / CLI configuration; no code change, no commit)

**Interfaces:**
- Produces: `https://www.camberco.co.uk/*` 308-redirects to `https://camberco.co.uk/*`, matching every canonical, sitemap URL and schema `@id` (which are all apex already).

**Steps:**

- [ ] **[Charlie or CLI]** In the Vercel dashboard: project → Settings → Domains. Ensure `camberco.co.uk` is listed and NOT set to redirect. Edit `www.camberco.co.uk` → select "Redirect to camberco.co.uk" → status code 308 (permanent). Equivalent check via CLI if a token is available: `npx vercel domains ls` and `npx vercel project ls` to confirm the assignment (redirect configuration itself is a dashboard action).
- [ ] Verify with curl once saved (also exercises the Task 2 trailing-slash deploy; run after the branch has been deployed to production):

```bash
curl -sI https://www.camberco.co.uk/ | grep -iE '^(HTTP|location)'
# expected: HTTP/2 308  +  location: https://camberco.co.uk/
curl -sI https://www.camberco.co.uk/services/automation | grep -iE '^(HTTP|location)'
# expected: HTTP/2 308  +  location: https://camberco.co.uk/services/automation
curl -sI https://camberco.co.uk/contact/ | grep -iE '^(HTTP|location)'
# expected: HTTP/2 308  +  location: /contact (trailing slash stripped)
curl -sI https://camberco.co.uk/ | grep -i '^HTTP'
# expected: HTTP/2 200
curl -s https://camberco.co.uk/llms.txt | head -3
# expected: the llms.txt header
```

- [ ] **[Charlie]** In Google Search Console (property camberco.co.uk): Sitemaps → resubmit `https://camberco.co.uk/sitemap-index.xml`.

---

## Final acceptance sweep (after all tasks)

- [ ] `pnpm vitest run` → all tests pass.
- [ ] `pnpm build` → success; every public page has a derived apex no-slash canonical; no page passes `canonicalUrl`.
- [ ] `grep -rn 'canonicalUrl=' src/pages/` → empty.
- [ ] No em dashes introduced in NEW copy (llms files, OG alt, schema additions): `grep -n '—' public/llms.txt public/llms-full.txt src/lib/admin-guard.ts src/lib/sitemap.ts src/middleware.ts` → empty.
