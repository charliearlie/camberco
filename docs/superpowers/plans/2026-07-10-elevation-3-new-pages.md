# Site Elevation Plan 3: New Pages (/work, Four Service Pages, /privacy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox ('- [ ]') syntax for tracking.

**Goal:** Ship the /work Camber Builds showcase, four new crawlable service pages (consultations, seo, training, personal-ai), a /privacy page, and nav/footer links so all seven services and the product portfolio are reachable and indexed.

**Architecture:** All new pages are prerendered Astro 5 pages that consume the shared data modules created by Plan 1 (`src/data/services.ts`, `src/data/projects.ts`, `src/lib/site.ts`). The four service pages mirror `src/pages/services/automation.astro` exactly (Layout props, Service JSON-LD, FAQ markup, scoped styles, chat-drawer script wiring). /work renders both project divisions from `src/data/projects.ts` with device-frame screenshots resolved via `import.meta.glob`, so cards degrade cleanly when no screenshots exist.

**Tech Stack:** Astro 5 (@astrojs/vercel adapter, prerendered pages), vanilla TS islands, Supabase-backed APIs (untouched here), plain Node script for App Store screenshot fetching.

## Global Constraints

- pnpm only
- Astro 5
- British English copy, short sentences, NO em dashes anywhere in site copy
- prices exactly as the contract table
- every animation respects prefers-reduced-motion with a static fallback
- all Resend sends wrapped in waitUntil from @vercel/functions
- free 30-minute audit call is never conflated with the paid £750 AI Readiness Audit
- commit messages end with "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"

## Plan-wide notes for the executor

- **Dependency:** Plan 1 must have created `src/lib/site.ts`, `src/data/services.ts`, `src/data/projects.ts` before any task here builds. Task 1 verifies this and stops if they are missing. Do NOT recreate those files here; consume them.
- **Canonicals:** Plan 2 (already executed) made `Layout.astro` derive the canonical from `Astro.url` + `Astro.site` and removed every hand-typed `canonicalUrl` prop. New pages here must NOT pass `canonicalUrl` to `<Layout>`.
- **Build output:** `pnpm build` writes prerendered HTML to `dist/client/<route>/index.html` (verified: `dist/client/services/automation/index.html` exists). All grep verifications below use that path.
- **Internal links:** use no-trailing-slash hrefs (`/contact`, `/services/automation`) in all NEW files. Plan 2 normalises the site to no trailing slash; existing files that use `/contact/` are not this plan's problem.
- **Chat keys:** `data-chat-open` values must be valid `ServiceKey` values from `src/scripts/chat-prompts.ts:4` (`'consultations' | 'seo' | 'builds' | 'automation' | 'training' | 'personal-ai' | 'general'`). The four new pages use their own key; /work uses `general`.
- All copy in this plan is final. Do not rewrite it. It contains no em dashes; keep it that way.

---

### Task 1: Preflight contract check + COMPANY_NUMBER export

**Files:**
- Modify: `src/lib/site.ts` (created by Plan 1; append ~2 lines at end of file)

**Interfaces:**
- Consumes: `src/lib/site.ts` (Plan 1 contract: `SITE_URL`, `BOOKING_URL`, `AUDIT_CTA_LABEL`)
- Produces: `export const COMPANY_NUMBER: string | null = null` in `src/lib/site.ts` (contract addition; consumed by Task 8's /privacy page; noted as a conflict for Plan 1 to absorb)

**Steps:**

- [ ] Verify the Plan 1 artefacts exist. Run:
  ```bash
  cd /Users/charlie/workspace/camber-co && ls src/lib/site.ts src/data/services.ts src/data/projects.ts
  ```
  Expected: all three paths print with no "No such file" error. **If any is missing, STOP: execute Plan 1 first. Do not create these files from this plan.**
- [ ] Check whether Plan 1 already included the company number export:
  ```bash
  grep -n "COMPANY_NUMBER" src/lib/site.ts
  ```
  If it prints a match, Plan 1 already absorbed the contract addition: skip the Append, Verify, Build and Commit steps below and move to Task 2 (there is nothing to commit).
- [ ] Append the export to `src/lib/site.ts` (exact content, at end of file):
  ```ts

  // Companies House registration number. Charlie supplies it later.
  // /privacy renders the registration line only when this is set.
  export const COMPANY_NUMBER: string | null = null;
  ```
- [ ] Verify:
  ```bash
  grep -c "export const COMPANY_NUMBER: string | null = null" src/lib/site.ts
  ```
  Expected output: `1`
- [ ] Run `pnpm build`. Expected: build succeeds (no type errors from the new export).
- [ ] Commit:
  ```bash
  git add src/lib/site.ts && git commit -m "$(cat <<'EOF'
  Add COMPANY_NUMBER to site config

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 2: /work showcase page (Camber Builds)

**Files:**
- Create: `src/pages/work.astro`

**Interfaces:**
- Consumes: `projects`, `type Project` from `src/data/projects.ts` (Plan 1 contract shape); `AUDIT_CTA_LABEL`, `BOOKING_URL` from `src/lib/site.ts`; `initScrollReveal`, `SCROLL_REVEAL_CSS` from `src/scripts/scroll-reveal.ts`; `initChatDrawer` from `src/scripts/chat-drawer.ts`; `window.__openChatDrawer` (declared in `src/scripts/chat-drawer.ts:6-10`); `ChatDrawer` component.
- Produces: route `/work` with stable per-project anchor ids (`#football-iq`, `#jodz`, `#bio-core`, `#clippin`, `#whoscored-plus`, `#oddschecker-plus`, `#gazzetta-ai-predictor`, `#ai-native-qa`), MobileApplication JSON-LD for Football IQ, and screenshot rendering that tolerates empty `screenshots` arrays.

**Steps:**

- [ ] Create `src/pages/work.astro` with exactly this content:

  ```astro
  ---
  import type { ImageMetadata } from 'astro';
  import Layout from '../layouts/Layout.astro';
  import StarfieldHero from '../components/StarfieldHero.astro';
  import ChatDrawer from '../components/ChatDrawer.astro';
  import { projects, type Project } from '../data/projects';
  import { AUDIT_CTA_LABEL, BOOKING_URL } from '../lib/site';

  const auditHref = BOOKING_URL ?? '/contact';

  const builds = projects.filter((p) => p.division === 'camber-builds');
  const credentials = projects.filter((p) => p.division === 'professional-credential');

  const statusLabels: Record<Project['status'], string> = {
    live: 'live',
    'in-submission': 'in submission',
    'in-development': 'in development',
    'open-source': 'open source',
    'professional-work': 'professional work',
  };

  // Screenshots live under src/assets/projects/. The glob returns {} when the
  // directory is empty or missing, so cards render cleanly with no screenshots.
  const screenshotModules = import.meta.glob<{ default: ImageMetadata }>(
    '/src/assets/projects/**/*.{png,jpg,jpeg,webp}',
    { eager: true },
  );

  function resolveShots(paths: string[]): ImageMetadata[] {
    return paths
      .map((p) => screenshotModules[p]?.default)
      .filter((img): img is ImageMetadata => Boolean(img));
  }

  const footballIq = projects.find((p) => p.slug === 'football-iq');
  const footballIqUrl = footballIq?.links.appStore ?? 'https://apps.apple.com/app/id6757344691';

  const schema = JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      '@id': 'https://camberco.co.uk/work#page',
      name: 'Camber Builds',
      url: 'https://camberco.co.uk/work',
      description:
        'Apps and websites designed, built and shipped by Camber Co: Football IQ, Jodz, bio-core and ClipPin, plus professional work for major sports media brands.',
      about: { '@id': 'https://camberco.co.uk/#organization' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'MobileApplication',
      '@id': 'https://camberco.co.uk/work#football-iq-app',
      name: 'Football IQ',
      operatingSystem: 'iOS',
      applicationCategory: 'GameApplication',
      url: footballIqUrl,
      installUrl: footballIqUrl,
      author: { '@id': 'https://camberco.co.uk/#organization' },
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'GBP' },
      description: footballIq?.tagline ?? 'Daily football trivia with AI-generated content.',
    },
  ]);
  ---

  <Layout
    title="Camber Builds | Apps and Websites Shipped by Camber Co"
    description="Camber Builds is the product division of Camber Co. Football IQ, Jodz, bio-core and ClipPin, designed, built and shipped. Plus professional work for major sports media brands."
    schema={schema}
  >
    <StarfieldHero />

    <main class="work-page">
      <section class="hero">
        <div class="container">
          <div class="hero-copy" data-reveal>
            <div class="status-chip">
              <span class="status-dot" aria-hidden="true"></span>
              <span class="status-label">[ SHIPPED ]</span>
              <span class="status-path">camber/work</span>
            </div>
            <h1>Camber Builds.</h1>
            <p>
              The product division of Camber Co. Apps and websites, designed, built and shipped.
              The same process we use on client work, proven on our own products first.
            </p>
            <div class="hero-actions">
              <a href={auditHref} class="btn btn-primary">&gt; {AUDIT_CTA_LABEL}</a>
              <a href="#football-iq" class="btn btn-secondary">&gt; See the work</a>
            </div>
          </div>
        </div>
      </section>

      <section class="section-block" aria-labelledby="builds-heading">
        <div class="container">
          <div class="section-header" data-reveal>
            <p class="section-tag">$ ls camber-builds/</p>
            <h2 id="builds-heading">Products we own.</h2>
            <p>Built, shipped and run by Camber Co.</p>
          </div>

          <div class="work-grid" data-reveal-stagger>
            {builds.map((p) => {
              const shots = resolveShots(p.screenshots);
              return (
                <article class="work-card" id={p.slug}>
                  <div class="card-bar">
                    <span class="window-dot window-dot--red"></span>
                    <span class="window-dot window-dot--yellow"></span>
                    <span class="window-dot window-dot--green"></span>
                    <span class="card-path">~/{p.slug}</span>
                    <span class={`status-pill status-pill--${p.status}`}>{statusLabels[p.status]}</span>
                  </div>
                  <div class="card-body">
                    <h3>{p.name}</h3>
                    <p class="card-tagline">{p.tagline}</p>
                    <p class="card-story">{p.story}</p>
                    {p.metrics.length > 0 && (
                      <dl class="metric-row">
                        {p.metrics.map((m) => (
                          <div class="metric">
                            <dt>{m.label}</dt>
                            <dd>{m.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    <div class="card-tags">
                      {p.tech.map((t) => <span>{t}</span>)}
                    </div>
                    <div class="card-links">
                      {p.slug === 'football-iq' && p.links.appStore && (
                        <a
                          class="appstore-badge"
                          href={p.links.appStore}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Download Football IQ on the App Store"
                        >
                          <svg viewBox="0 0 120 40" width="132" height="44" aria-hidden="true" focusable="false">
                            <rect x="0.5" y="0.5" width="119" height="39" rx="6.5" fill="#000" stroke="#a6a6a6" />
                            <g transform="translate(9,7) scale(0.052)" fill="#fff">
                              <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.7-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
                            </g>
                            <text x="34" y="17" fill="#fff" font-family="'Helvetica Neue', Arial, sans-serif" font-size="9">Download on the</text>
                            <text x="34" y="31" fill="#fff" font-family="'Helvetica Neue', Arial, sans-serif" font-size="15" font-weight="600">App Store</text>
                          </svg>
                        </a>
                      )}
                      {p.slug !== 'football-iq' && p.links.appStore && (
                        <a class="text-link" href={p.links.appStore} target="_blank" rel="noopener noreferrer">&gt; App Store</a>
                      )}
                      {p.links.github && (
                        <a class="text-link" href={p.links.github} target="_blank" rel="noopener noreferrer">&gt; View on GitHub</a>
                      )}
                      {p.links.web && (
                        <a class="text-link" href={p.links.web} target="_blank" rel="noopener noreferrer">&gt; Visit site</a>
                      )}
                    </div>
                  </div>
                  {shots.length > 0 && (
                    <div class="shots-row">
                      {shots.map((img, i) => (
                        <div class="phone-frame">
                          <div class="phone-screen">
                            <img
                              src={img.src}
                              width={img.width}
                              height={img.height}
                              alt={`${p.name} app screenshot ${i + 1}`}
                              loading="lazy"
                              decoding="async"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section class="section-block" aria-labelledby="credentials-heading">
        <div class="container">
          <div class="section-header" data-reveal>
            <p class="section-tag">$ cat professional-work.md</p>
            <h2 id="credentials-heading">Professional work.</h2>
            <p>
              Products Charlie led or built in-house for major sports media brands.
              Listed as credentials, not Camber Co client projects.
            </p>
          </div>

          <div class="work-grid" data-reveal-stagger>
            {credentials.map((p) => (
              <article class="work-card" id={p.slug}>
                <div class="card-bar">
                  <span class="window-dot window-dot--red"></span>
                  <span class="window-dot window-dot--yellow"></span>
                  <span class="window-dot window-dot--green"></span>
                  <span class="card-path">~/{p.slug}</span>
                  <span class={`status-pill status-pill--${p.status}`}>{statusLabels[p.status]}</span>
                </div>
                <div class="card-body">
                  <h3>{p.name}</h3>
                  <p class="card-tagline">{p.tagline}</p>
                  <p class="card-story">{p.story}</p>
                  <div class="card-tags">
                    {p.tech.map((t) => <span>{t}</span>)}
                  </div>
                  {p.links.web && (
                    <div class="card-links">
                      <a class="text-link" href={p.links.web} target="_blank" rel="noopener noreferrer">&gt; Visit site</a>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section class="cta">
        <div class="container">
          <div class="cta-card" data-reveal>
            <h2>Want something built and shipped to this standard?</h2>
            <p>
              Tell us what you need. Every enquiry starts with a free 30-minute audit call.
              No pitch, just a clear read on whether it is worth building.
            </p>
            <div class="cta-actions">
              <a href={auditHref} class="btn btn-primary">&gt; {AUDIT_CTA_LABEL}</a>
              <button type="button" class="btn btn-secondary" data-chat-open="general">&gt; Chat about it</button>
            </div>
            <p class="cta-flags">
              <span>--designed</span>
              <span>--built</span>
              <span>--shipped</span>
            </p>
          </div>
        </div>
      </section>
    </main>

    <ChatDrawer />
  </Layout>

  <style>
    .work-page {
      position: relative;
      z-index: 2;
    }

    .container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 var(--space-8);
    }

    .hero {
      padding: clamp(96px, 13vw, 148px) 0 clamp(72px, 9vw, 112px);
    }

    .hero-copy {
      display: grid;
      gap: var(--space-4);
      max-width: 820px;
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      width: fit-content;
      padding: var(--space-2) var(--space-3);
      background: color-mix(in srgb, var(--color-surface-01) 76%, transparent);
      border: 1px solid var(--color-border-subtle);
      border-radius: var(--radius-sm);
      font-family: var(--font-mono);
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--color-green-500);
      box-shadow: 0 0 10px var(--color-green-glow);
      animation: status-pulse 2.4s var(--easing-smooth) infinite;
    }

    @keyframes status-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.45; }
    }

    .status-label,
    .status-path {
      font-size: var(--type-label);
      letter-spacing: 0;
    }

    .status-label {
      color: var(--color-green-500);
    }

    .status-path {
      color: var(--color-text-muted);
    }

    h1 {
      margin: 0;
      font-family: var(--font-mono);
      font-size: var(--type-display);
      line-height: 1;
      letter-spacing: 0;
      color: var(--color-text-primary);
    }

    .hero-copy p,
    .section-header p {
      margin: 0;
      font-size: var(--type-body-lg);
      color: var(--color-text-secondary);
      line-height: 1.7;
      max-width: 66ch;
    }

    .hero-actions,
    .cta-actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      margin-top: var(--space-2);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      border-radius: var(--radius-sm);
      padding: var(--space-3) var(--space-6);
      font-family: var(--font-mono);
      font-size: var(--type-label);
      font-weight: 700;
      letter-spacing: 0;
      transition:
        transform var(--duration-quick) var(--easing-spring),
        background var(--duration-quick) var(--easing-smooth),
        border-color var(--duration-quick) var(--easing-smooth),
        color var(--duration-quick) var(--easing-smooth),
        box-shadow var(--duration-quick) var(--easing-smooth);
    }

    .btn:hover {
      transform: translateY(-1px);
    }

    .btn-primary {
      background: var(--color-green-500);
      color: var(--color-text-inverse);
    }

    .btn-primary:hover {
      background: var(--color-green-400);
      box-shadow: 0 0 24px var(--color-green-glow);
    }

    .btn-secondary {
      color: var(--color-text-secondary);
      border: 1px solid var(--color-border-muted);
      background: var(--color-surface-00);
    }

    .btn-secondary:hover {
      color: var(--color-text-primary);
      border-color: var(--color-border-visible);
      background: var(--color-surface-01);
    }

    .section-block {
      padding: clamp(72px, 10vw, 124px) 0;
      border-top: 1px solid var(--color-border-subtle);
      background: var(--color-base);
    }

    .section-header {
      display: grid;
      gap: var(--space-3);
      margin-bottom: var(--space-10);
    }

    .section-tag {
      margin: 0;
      font-family: var(--font-mono);
      font-size: var(--type-caption);
      color: var(--color-green-500);
    }

    h2 {
      margin: 0;
      font-family: var(--font-mono);
      font-size: var(--type-h1);
      line-height: 1.12;
      letter-spacing: 0;
    }

    .work-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-6);
    }

    .work-card,
    .cta-card {
      border: 1px solid var(--color-border-subtle);
      border-radius: var(--radius-md);
      background: var(--color-surface-00);
      overflow: hidden;
    }

    .work-card {
      scroll-margin-top: 80px;
      transition:
        transform var(--duration-normal) var(--easing-spring),
        border-color var(--duration-normal) var(--easing-smooth),
        box-shadow var(--duration-normal) var(--easing-smooth);
    }

    .work-card:hover {
      transform: translateY(-2px);
      border-color: color-mix(in srgb, var(--color-green-500) 48%, var(--color-border-muted));
      box-shadow: 0 0 28px color-mix(in srgb, var(--color-green-500) 8%, transparent);
    }

    .card-bar {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 38px;
      padding: 0 var(--space-3);
      background: var(--color-surface-02);
      border-bottom: 1px solid var(--color-border-subtle);
    }

    .window-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .window-dot--red { background: var(--color-error); }
    .window-dot--yellow { background: var(--color-warning); }
    .window-dot--green { background: var(--color-success); }

    .card-path {
      margin-left: var(--space-2);
      font-family: var(--font-mono);
      font-size: var(--type-caption);
      color: var(--color-text-muted);
    }

    .status-pill {
      margin-left: auto;
      padding: 2px var(--space-2);
      border: 1px solid var(--color-border-subtle);
      border-radius: var(--radius-sm);
      font-family: var(--font-mono);
      font-size: var(--type-caption);
      color: var(--color-text-muted);
      white-space: nowrap;
    }

    .status-pill--live,
    .status-pill--open-source {
      color: var(--color-green-500);
      border-color: color-mix(in srgb, var(--color-green-500) 40%, transparent);
    }

    .status-pill--in-submission,
    .status-pill--in-development {
      color: var(--color-warning);
      border-color: color-mix(in srgb, var(--color-warning) 40%, transparent);
    }

    .status-pill--professional-work {
      color: var(--color-pink-500);
      border-color: color-mix(in srgb, var(--color-pink-500) 40%, transparent);
    }

    .card-body {
      display: grid;
      gap: var(--space-4);
      padding: var(--space-6);
    }

    .card-body h3 {
      margin: 0;
      font-family: var(--font-mono);
      font-size: var(--type-h3);
      letter-spacing: 0;
    }

    .card-tagline {
      margin: 0;
      font-family: var(--font-mono);
      font-size: var(--type-body-sm);
      color: var(--color-green-500);
    }

    .card-story,
    .cta-card p {
      margin: 0;
      color: var(--color-text-secondary);
      line-height: 1.7;
    }

    .metric-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-6);
      margin: 0;
    }

    .metric dt {
      font-family: var(--font-mono);
      font-size: var(--type-caption);
      color: var(--color-text-muted);
    }

    .metric dd {
      margin: 0;
      font-family: var(--font-mono);
      font-size: var(--type-h3);
      font-weight: 700;
      color: var(--color-green-500);
    }

    .card-tags,
    .cta-flags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .card-tags span {
      border: 1px solid var(--color-border-subtle);
      border-radius: var(--radius-sm);
      background: var(--color-surface-02);
      color: var(--color-text-muted);
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-mono);
      font-size: var(--type-caption);
    }

    .card-links {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-4);
    }

    .text-link {
      font-family: var(--font-mono);
      font-size: var(--type-label);
      font-weight: 700;
      color: var(--color-green-500);
      text-decoration: none;
    }

    .text-link:hover,
    .text-link:focus-visible {
      color: var(--color-green-400);
      text-decoration: underline;
    }

    .appstore-badge {
      display: inline-flex;
      line-height: 0;
      border-radius: 7px;
      transition: transform var(--duration-quick) var(--easing-spring);
    }

    .appstore-badge:hover {
      transform: translateY(-1px);
    }

    .appstore-badge:focus-visible {
      outline: 2px solid var(--color-green-500);
      outline-offset: 3px;
    }

    .shots-row {
      display: flex;
      gap: var(--space-4);
      padding: 0 var(--space-6) var(--space-6);
      overflow-x: auto;
      scrollbar-width: thin;
      scrollbar-color: var(--color-border-muted) transparent;
    }

    .phone-frame {
      flex: 0 0 auto;
      width: 180px;
      aspect-ratio: 9 / 19.5;
      padding: 6px;
      border-radius: 24px;
      background: linear-gradient(145deg, var(--color-surface-02), var(--color-base));
      border: 1px solid var(--color-border-visible);
      box-shadow: 0 0 32px var(--color-green-glow);
    }

    .phone-screen {
      height: 100%;
      overflow: hidden;
      border-radius: 18px;
      border: 1px solid var(--color-border-subtle);
      background: var(--color-surface-01);
    }

    .phone-screen img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .cta {
      padding: clamp(72px, 10vw, 124px) 0;
      background: var(--color-base);
    }

    .cta-card {
      display: grid;
      justify-items: center;
      gap: var(--space-6);
      padding: clamp(40px, 6vw, 72px);
      text-align: center;
    }

    .cta-card h2 {
      max-width: 760px;
    }

    .cta-card p {
      max-width: 60ch;
    }

    .cta-flags {
      justify-content: center;
      color: var(--color-text-muted);
      font-family: var(--font-mono);
      font-size: var(--type-caption);
    }

    @media (max-width: 980px) {
      .work-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .container {
        padding: 0 var(--space-4);
      }

      .hero-actions .btn,
      .cta-actions .btn {
        width: 100%;
      }
    }

    @media (max-width: 520px) {
      .status-chip {
        align-items: flex-start;
        flex-direction: column;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .status-dot {
        animation: none;
      }

      .btn,
      .work-card,
      .appstore-badge,
      .text-link {
        transition: none;
      }
    }
  </style>

  <script>
    import { initScrollReveal, SCROLL_REVEAL_CSS } from '../scripts/scroll-reveal.ts';
    import { initChatDrawer } from '../scripts/chat-drawer.ts';

    if (!document.getElementById('scroll-reveal-css')) {
      const style = document.createElement('style');
      style.id = 'scroll-reveal-css';
      style.textContent = SCROLL_REVEAL_CSS;
      document.head.appendChild(style);
    }

    initScrollReveal();
    initChatDrawer();

    document.querySelectorAll<HTMLElement>('[data-chat-open]').forEach((button) => {
      button.addEventListener('click', () => {
        const service = button.dataset.chatOpen;
        if (service && window.__openChatDrawer) {
          window.__openChatDrawer(service as any);
        }
      });
    });
  </script>
  ```

- [ ] Run `pnpm build`. Expected: build succeeds and logs `/work` among the prerendered routes.
- [ ] Verify title, JSON-LD, anchors and badge in the build output:
  ```bash
  grep -q '<title>Camber Builds | Apps and Websites Shipped by Camber Co</title>' dist/client/work/index.html && echo TITLE_OK
  grep -q '"@type":"MobileApplication"' dist/client/work/index.html && echo SCHEMA_OK
  grep -q 'id="football-iq"' dist/client/work/index.html && grep -q 'id="jodz"' dist/client/work/index.html && grep -q 'id="clippin"' dist/client/work/index.html && grep -q 'id="ai-native-qa"' dist/client/work/index.html && echo ANCHORS_OK
  grep -q 'apps.apple.com/app/id6757344691' dist/client/work/index.html && echo BADGE_LINK_OK
  grep -q 'professional work' dist/client/work/index.html && echo PILL_OK
  ```
  Expected output: `TITLE_OK`, `SCHEMA_OK`, `ANCHORS_OK`, `BADGE_LINK_OK`, `PILL_OK`. (Anchor ids come from `projects.ts` slugs; if `ANCHORS_OK` fails, check the Plan 1 slugs match the contract: football-iq, jodz, bio-core, clippin, whoscored-plus, oddschecker-plus, gazzetta-ai-predictor, ai-native-qa.)
- [ ] Commit:
  ```bash
  git add src/pages/work.astro && git commit -m "$(cat <<'EOF'
  Add /work Camber Builds showcase page

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 3: App Store screenshot fetch script + wiring

**Files:**
- Create: `scripts/fetch-appstore-screenshots.mjs`
- Create: `src/assets/projects/football-iq/.gitkeep` (empty file; keeps the glob target directory in git)
- Modify (conditional): `src/data/projects.ts` (football-iq entry, `screenshots` field only)

**Interfaces:**
- Consumes: iTunes lookup API `https://itunes.apple.com/lookup?id=6757344691&country=gb` (public, no auth); Node 18+ global `fetch`.
- Produces: downloaded screenshot files at `src/assets/projects/football-iq/screenshot-N.<ext>` and (when downloads succeed) the `screenshots` array on the football-iq entry in `src/data/projects.ts` using `/src/assets/projects/...` paths, which Task 2's `import.meta.glob` resolves.

**Note:** As of 2026-07-10 the lookup API returns the app (`Football IQ - World Cup Quiz`) but an EMPTY `screenshotUrls` array (verified by hand). The script must therefore treat "no screenshots" as a normal outcome, print a warning and exit 0. The /work page already renders cleanly without screenshots (Task 2).

**Steps:**

- [ ] Create the directory and keep-file:
  ```bash
  mkdir -p src/assets/projects/football-iq && touch src/assets/projects/football-iq/.gitkeep
  ```
- [ ] Create `scripts/fetch-appstore-screenshots.mjs` with exactly this content:

  ```js
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
  ```

- [ ] Run it:
  ```bash
  node scripts/fetch-appstore-screenshots.mjs; echo "exit=$?"
  ```
  Expected (current API state): `[fetch-appstore-screenshots] no screenshots in lookup response. Skipping.` then `exit=0`.
  Alternative (if Apple starts returning screenshots): up to three `saved src/assets/projects/football-iq/screenshot-N.png` lines, a `screenshots: [...]` snippet, and `exit=0`.
- [ ] **Only if the script saved files:** open `src/data/projects.ts`, find the football-iq entry, and replace its `screenshots: []` value with the exact array the script printed, for example:
  ```ts
  screenshots: [
    '/src/assets/projects/football-iq/screenshot-1.png',
    '/src/assets/projects/football-iq/screenshot-2.png',
    '/src/assets/projects/football-iq/screenshot-3.png',
  ],
  ```
  (Use the extensions the script actually printed. Change nothing else in the file.)
  If the script skipped, leave `src/data/projects.ts` untouched.
- [ ] Run `pnpm build`. Expected: success in both cases.
- [ ] Verify /work still renders correctly:
  ```bash
  # If screenshots were wired in:
  grep -q 'app screenshot 1' dist/client/work/index.html && echo SHOTS_RENDERED
  # If the script skipped (current state): the page must contain no phone frames:
  grep -c 'phone-frame' dist/client/work/index.html
  ```
  Expected: `SHOTS_RENDERED` when wired; `0` from the second grep when skipped.
- [ ] Commit:
  ```bash
  git add scripts/fetch-appstore-screenshots.mjs src/assets/projects/football-iq/ && git add -u src/data/projects.ts 2>/dev/null; git commit -m "$(cat <<'EOF'
  Add App Store screenshot fetch script for Football IQ

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 4: /services/consultations page

**Files:**
- Create: `src/pages/services/consultations.astro`

**Interfaces:**
- Consumes: `services` from `src/data/services.ts` (entry `slug: 'consultations'`, `fromPrice: '£297 per session'`, `chat: 'consultations'`); `AUDIT_CTA_LABEL`, `BOOKING_URL` from `src/lib/site.ts`; `ChatDrawer`, `StarfieldHero`; scripts as in `src/pages/services/automation.astro` (the trailing `<script>` tag; line numbers shifted after Plan 2).
- Produces: route `/services/consultations` with Service + FAQPage JSON-LD (prices matching visible copy), the spec-mandated title `AI Consultant for Small Businesses in London | Camber Co`.

**Pattern source:** `src/pages/services/automation.astro`. Line references are approximate post-Plan-2; locate by structure. Mirror: Layout usage (the `<Layout ...>` call near the top of the template; Plan 2 already removed its `canonicalUrl` prop), hero structure (the `StarfieldHero` hero section), FAQ markup (the `.faq-list` details block), CTA card (the closing CTA section), `<style>` block conventions, script block (the trailing `<script>` tag).

**Steps:**

- [ ] Create `src/pages/services/consultations.astro`. Frontmatter, markup and script exactly as follows; the `<style>` block content is given in the next step:

  ```astro
  ---
  import Layout from '../../layouts/Layout.astro';
  import StarfieldHero from '../../components/StarfieldHero.astro';
  import ChatDrawer from '../../components/ChatDrawer.astro';
  import { services } from '../../data/services';
  import { AUDIT_CTA_LABEL, BOOKING_URL } from '../../lib/site';

  const service = services.find((s) => s.slug === 'consultations')!;
  const auditHref = BOOKING_URL ?? '/contact';

  const deliverables = [
    {
      title: 'A process map',
      desc: 'We walk through how work actually flows through your business and where the hours go.',
    },
    {
      title: 'Prioritised opportunities',
      desc: 'The two or three places AI will genuinely pay for itself. Not a list of forty tools.',
    },
    {
      title: 'A written action plan',
      desc: 'Delivered within 24 hours. Clear steps, rough costs, and what to do first.',
    },
    {
      title: 'Straight answers',
      desc: 'What to build, what to buy, and what to ignore. In plain English.',
    },
  ];

  const faqs = [
    {
      q: 'Who runs the session?',
      a: 'Charlie runs every session personally. I take a small number of clients each quarter, so you get full attention, not a junior on a script.',
    },
    {
      q: 'Is this the same as the free 30-minute audit call?',
      a: 'No. The free call is a short scoping chat with no pitch. A consultation is a paid 60-minute working session with a written action plan afterwards.',
    },
    {
      q: 'Do I need to be technical?',
      a: 'Not at all. Sessions run in plain English. If you can describe how your business works, that is enough.',
    },
    {
      q: 'What happens after the session?',
      a: 'You get the action plan within 24 hours. Run it yourself, hand it to your team, or ask Camber Co to build the priority items.',
    },
    {
      q: 'Can we do it in person?',
      a: 'Sessions run over video call by default. In-person sessions are possible in London by arrangement.',
    },
  ];

  const schema = JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': 'https://camberco.co.uk/services/consultations#service',
      name: 'AI Consultations',
      serviceType: 'AI consulting',
      provider: { '@id': 'https://camberco.co.uk/#organization' },
      areaServed: { '@type': 'Country', name: 'United Kingdom' },
      url: 'https://camberco.co.uk/services/consultations',
      description:
        'One-to-one AI consultations for small businesses. A 60-minute working session with a London-based AI consultant and a written action plan within 24 hours.',
      offers: {
        '@type': 'Offer',
        price: '297',
        priceCurrency: 'GBP',
        description: '£297 per session',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ]);
  ---

  <Layout
    title="AI Consultant for Small Businesses in London | Camber Co"
    description="Book a £297 AI consultation with Camber Co. One hour with an AI consultant in London, a written action plan within 24 hours, and clear priorities for your small business."
    schema={schema}
  >
    <StarfieldHero />

    <main class="service-page">
      <section class="hero">
        <div class="container">
          <div class="hero-copy" data-reveal>
            <div class="status-chip">
              <span class="status-dot" aria-hidden="true"></span>
              <span class="status-label">[ CONSULT MODE ]</span>
              <span class="status-path">camber/services/consultations</span>
            </div>
            <h1>One session. A clear AI plan for your business.</h1>
            <p>
              A 60-minute working session with an AI consultant in London. We find where AI
              genuinely saves you time and money. You get a written plan within 24 hours.
            </p>
            <p class="price-line">{service.fromPrice}</p>
            <div class="hero-actions">
              <a href={auditHref} class="btn btn-primary">&gt; {AUDIT_CTA_LABEL}</a>
              <button type="button" class="btn btn-secondary" data-chat-open={service.chat}>&gt; Chat about it</button>
            </div>
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="container">
          <div class="section-header" data-reveal>
            <p class="section-tag">$ cat what-you-get.json</p>
            <h2>What you get for £297.</h2>
          </div>

          <div class="example-grid" data-reveal-stagger>
            {deliverables.map((item) => (
              <article class="terminal-card">
                <div class="card-bar">
                  <span class="window-dot window-dot--red"></span>
                  <span class="window-dot window-dot--yellow"></span>
                  <span class="window-dot window-dot--green"></span>
                  <span class="card-path">~/consultation</span>
                </div>
                <div class="card-body">
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="container">
          <div class="section-header" data-reveal>
            <p class="section-tag">$ man consultations</p>
            <h2>Questions before you book.</h2>
          </div>

          <div class="faq-list" data-reveal>
            {faqs.map((item, i) => (
              <details class="faq-item" open={i === 0}>
                <summary>
                  <span aria-hidden="true">&gt;</span>
                  <span>{item.q}</span>
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="container">
          <div class="section-header" data-reveal>
            <p class="section-tag">$ ls ../services/</p>
            <h2>Where this usually leads.</h2>
            <p>Most consultations end with a build or a skills plan. These are the common next steps.</p>
          </div>
          <div class="hero-actions" data-reveal>
            <a href="/services/automation" class="btn btn-secondary">&gt; Workflow automation</a>
            <a href="/services/training" class="btn btn-secondary">&gt; Training and coaching</a>
          </div>
        </div>
      </section>

      <section class="cta">
        <div class="container">
          <div class="cta-card" data-reveal>
            <h2>Ready to stop guessing about AI?</h2>
            <p>
              Start with the free 30-minute audit call if you want a feel for how we work.
              No pitch. Or ask about a full consultation and get the written plan.
            </p>
            <div class="cta-actions">
              <a href={auditHref} class="btn btn-primary">&gt; {AUDIT_CTA_LABEL}</a>
              <button type="button" class="btn btn-secondary" data-chat-open={service.chat}>&gt; Chat about it</button>
            </div>
            <p class="cta-flags">
              <span>--plain-english</span>
              <span>--written-plan</span>
              <span>--no-jargon</span>
            </p>
          </div>
        </div>
      </section>
    </main>

    <ChatDrawer />
  </Layout>
  ```

  Then the script block at the very end of the file (after the `<style>` block added in the next step):

  ```astro
  <script>
    import { initScrollReveal, SCROLL_REVEAL_CSS } from '../../scripts/scroll-reveal.ts';
    import { initChatDrawer } from '../../scripts/chat-drawer.ts';

    if (!document.getElementById('scroll-reveal-css')) {
      const style = document.createElement('style');
      style.id = 'scroll-reveal-css';
      style.textContent = SCROLL_REVEAL_CSS;
      document.head.appendChild(style);
    }

    initScrollReveal();
    initChatDrawer();

    document.querySelectorAll<HTMLElement>('[data-chat-open]').forEach((button) => {
      button.addEventListener('click', () => {
        const service = button.dataset.chatOpen;
        if (service && window.__openChatDrawer) {
          window.__openChatDrawer(service as any);
        }
      });
    });
  </script>
  ```

- [ ] Insert this `<style>` block between `</Layout>` and the `<script>` block. It is the automation.astro style block (`src/pages/services/automation.astro:356-986`) trimmed of demo-only rules (`.automation-*`, `.graph-*`, `.node-*`, `.particle`, `.edge`, `.logo-*`, `.git-log`/`.commit*`, `.btn-small`) with one addition, `.price-line`. Use it exactly:

  ```astro
  <style>
    .service-page {
      position: relative;
      z-index: 2;
    }

    .container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 var(--space-8);
    }

    .hero {
      padding: clamp(96px, 13vw, 148px) 0 clamp(72px, 9vw, 112px);
    }

    .hero-copy {
      display: grid;
      gap: var(--space-4);
      max-width: 820px;
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      width: fit-content;
      padding: var(--space-2) var(--space-3);
      background: color-mix(in srgb, var(--color-surface-01) 76%, transparent);
      border: 1px solid var(--color-border-subtle);
      border-radius: var(--radius-sm);
      font-family: var(--font-mono);
    }

    .status-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--color-green-500);
      box-shadow: 0 0 10px var(--color-green-glow);
      animation: status-pulse 2.4s var(--easing-smooth) infinite;
    }

    @keyframes status-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.45; }
    }

    .status-label,
    .status-path {
      font-size: var(--type-label);
      letter-spacing: 0;
    }

    .status-label {
      color: var(--color-green-500);
    }

    .status-path {
      color: var(--color-text-muted);
    }

    h1 {
      margin: 0;
      font-family: var(--font-mono);
      font-size: var(--type-display);
      line-height: 1;
      letter-spacing: 0;
      color: var(--color-text-primary);
    }

    .hero-copy p,
    .section-header p {
      margin: 0;
      font-size: var(--type-body-lg);
      color: var(--color-text-secondary);
      line-height: 1.7;
      max-width: 66ch;
    }

    .price-line {
      margin: 0;
      font-family: var(--font-mono);
      font-size: var(--type-body);
      font-weight: 700;
      color: var(--color-green-500);
    }

    .hero-actions,
    .cta-actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      margin-top: var(--space-2);
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      border-radius: var(--radius-sm);
      padding: var(--space-3) var(--space-6);
      font-family: var(--font-mono);
      font-size: var(--type-label);
      font-weight: 700;
      letter-spacing: 0;
      transition:
        transform var(--duration-quick) var(--easing-spring),
        background var(--duration-quick) var(--easing-smooth),
        border-color var(--duration-quick) var(--easing-smooth),
        color var(--duration-quick) var(--easing-smooth),
        box-shadow var(--duration-quick) var(--easing-smooth);
    }

    .btn:hover {
      transform: translateY(-1px);
    }

    .btn-primary {
      background: var(--color-green-500);
      color: var(--color-text-inverse);
    }

    .btn-primary:hover {
      background: var(--color-green-400);
      box-shadow: 0 0 24px var(--color-green-glow);
    }

    .btn-secondary {
      color: var(--color-text-secondary);
      border: 1px solid var(--color-border-muted);
      background: var(--color-surface-00);
    }

    .btn-secondary:hover {
      color: var(--color-text-primary);
      border-color: var(--color-border-visible);
      background: var(--color-surface-01);
    }

    .section-block {
      padding: clamp(72px, 10vw, 124px) 0;
      border-top: 1px solid var(--color-border-subtle);
      background: var(--color-base);
    }

    .section-header {
      display: grid;
      gap: var(--space-3);
      margin-bottom: var(--space-10);
    }

    .section-tag {
      margin: 0;
      font-family: var(--font-mono);
      font-size: var(--type-caption);
      color: var(--color-green-500);
    }

    h2 {
      margin: 0;
      font-family: var(--font-mono);
      font-size: var(--type-h1);
      line-height: 1.12;
      letter-spacing: 0;
    }

    .example-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--space-4);
    }

    .terminal-card,
    .cta-card {
      border: 1px solid var(--color-border-subtle);
      border-radius: var(--radius-md);
      background: var(--color-surface-00);
      overflow: hidden;
    }

    .terminal-card {
      transition:
        transform var(--duration-normal) var(--easing-spring),
        border-color var(--duration-normal) var(--easing-smooth),
        box-shadow var(--duration-normal) var(--easing-smooth);
    }

    .terminal-card:hover {
      transform: translateY(-2px);
      border-color: color-mix(in srgb, var(--color-green-500) 48%, var(--color-border-muted));
      box-shadow: 0 0 28px color-mix(in srgb, var(--color-green-500) 8%, transparent);
    }

    .card-bar {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      min-height: 38px;
      padding: 0 var(--space-3);
      background: var(--color-surface-02);
      border-bottom: 1px solid var(--color-border-subtle);
    }

    .window-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .window-dot--red { background: var(--color-error); }
    .window-dot--yellow { background: var(--color-warning); }
    .window-dot--green { background: var(--color-success); }

    .card-path {
      margin-left: var(--space-2);
      font-family: var(--font-mono);
      font-size: var(--type-caption);
      color: var(--color-text-muted);
    }

    .card-body {
      display: grid;
      gap: var(--space-4);
      padding: var(--space-6);
    }

    .card-body h3 {
      margin: 0;
      font-family: var(--font-mono);
      font-size: var(--type-h3);
      letter-spacing: 0;
    }

    .card-body p,
    .faq-item p,
    .cta-card p {
      margin: 0;
      color: var(--color-text-secondary);
      line-height: 1.7;
    }

    .card-tags,
    .cta-flags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
    }

    .card-tags span {
      border: 1px solid var(--color-border-subtle);
      border-radius: var(--radius-sm);
      background: var(--color-surface-02);
      color: var(--color-text-muted);
      padding: var(--space-1) var(--space-2);
      font-family: var(--font-mono);
      font-size: var(--type-caption);
    }

    .faq-list {
      max-width: 820px;
    }

    .faq-item {
      border-top: 1px solid var(--color-border-subtle);
    }

    .faq-item:last-child {
      border-bottom: 1px solid var(--color-border-subtle);
    }

    .faq-item summary {
      display: flex;
      gap: var(--space-3);
      padding: var(--space-6) 0;
      cursor: pointer;
      list-style: none;
      color: var(--color-text-primary);
      font-weight: 700;
    }

    .faq-item summary::-webkit-details-marker {
      display: none;
    }

    .faq-item summary span:first-child {
      color: var(--color-green-500);
      font-family: var(--font-mono);
      transition: transform var(--duration-quick) var(--easing-smooth);
    }

    .faq-item[open] summary span:first-child {
      transform: rotate(90deg);
    }

    .faq-item p {
      padding: 0 0 var(--space-6) calc(var(--space-6) + var(--space-1));
      max-width: 68ch;
    }

    .cta {
      padding: clamp(72px, 10vw, 124px) 0;
      background: var(--color-base);
    }

    .cta-card {
      display: grid;
      justify-items: center;
      gap: var(--space-6);
      padding: clamp(40px, 6vw, 72px);
      text-align: center;
    }

    .cta-card h2 {
      max-width: 760px;
    }

    .cta-card p {
      max-width: 60ch;
    }

    .cta-flags {
      justify-content: center;
      color: var(--color-text-muted);
      font-family: var(--font-mono);
      font-size: var(--type-caption);
    }

    @media (max-width: 768px) {
      .container {
        padding: 0 var(--space-4);
      }

      .example-grid {
        grid-template-columns: 1fr;
      }

      .hero-actions .btn,
      .cta-actions .btn {
        width: 100%;
      }
    }

    @media (max-width: 520px) {
      .status-chip {
        align-items: flex-start;
        flex-direction: column;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .status-dot {
        animation: none;
      }

      .btn,
      .terminal-card,
      .faq-item summary span:first-child {
        transition: none;
      }
    }
  </style>
  ```

- [ ] Run `pnpm build`. Expected: success, `/services/consultations` prerendered.
- [ ] Verify:
  ```bash
  grep -q '<title>AI Consultant for Small Businesses in London | Camber Co</title>' dist/client/services/consultations/index.html && echo TITLE_OK
  grep -q '"@type":"Service"' dist/client/services/consultations/index.html && grep -q '"price":"297"' dist/client/services/consultations/index.html && echo SCHEMA_OK
  grep -q '"@type":"FAQPage"' dist/client/services/consultations/index.html && echo FAQ_OK
  grep -q 'data-chat-open="consultations"' dist/client/services/consultations/index.html && echo CHAT_OK
  grep -q '£297 per session' dist/client/services/consultations/index.html && echo PRICE_OK
  ! grep -q 'canonicalUrl' src/pages/services/consultations.astro && echo NO_CANONICAL_PROP
  ```
  Expected: all six OK lines print (the last confirms the page never passes a hand-typed canonical, per the Plan 2 Layout contract). Also confirm the audit CTA falls back while `BOOKING_URL` is null: `grep -q 'href="/contact"' dist/client/services/consultations/index.html && echo CTA_OK`.
- [ ] Commit:
  ```bash
  git add src/pages/services/consultations.astro && git commit -m "$(cat <<'EOF'
  Add AI consultations service page

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 5: /services/seo page

**Files:**
- Create: `src/pages/services/seo.astro`

**Interfaces:**
- Consumes: `services` entry `slug: 'seo'` (`fromPrice: 'from £750'`, `chat: 'seo'`); `AUDIT_CTA_LABEL`, `BOOKING_URL`; same components/scripts as Task 4.
- Produces: route `/services/seo` targeting "SEO for small businesses UK", Service + FAQPage JSON-LD with price 750.

**Steps:**

- [ ] Create `src/pages/services/seo.astro`. Structure identical to Task 4's file. Frontmatter and markup exactly:

  ```astro
  ---
  import Layout from '../../layouts/Layout.astro';
  import StarfieldHero from '../../components/StarfieldHero.astro';
  import ChatDrawer from '../../components/ChatDrawer.astro';
  import { services } from '../../data/services';
  import { AUDIT_CTA_LABEL, BOOKING_URL } from '../../lib/site';

  const service = services.find((s) => s.slug === 'seo')!;
  const auditHref = BOOKING_URL ?? '/contact';

  const deliverables = [
    {
      title: 'Technical audit',
      desc: 'Crawlability, indexing, speed and structured data. The plumbing gets fixed first.',
    },
    {
      title: 'Keyword strategy',
      desc: 'The terms your customers actually type, mapped to pages that can realistically rank.',
    },
    {
      title: 'On-page work',
      desc: 'Titles, content and internal links rewritten to earn clicks, not just impressions.',
    },
    {
      title: 'Honest reporting',
      desc: 'What moved, why it moved, and what happens next. No vanity dashboards.',
    },
  ];

  const faqs = [
    {
      q: 'How long until I see results?',
      a: 'SEO compounds. Technical fixes can show within weeks. Competitive terms usually take three to six months. Anyone promising page one in a fortnight is guessing.',
    },
    {
      q: 'Do you guarantee rankings?',
      a: 'No, and you should be wary of anyone who does. We guarantee the work, the reporting, and honest advice about what is achievable for your market.',
    },
    {
      q: 'Do you work with local businesses?',
      a: 'Yes. Local SEO, Google Business Profile and review strategy are often the fastest wins for service businesses.',
    },
    {
      q: 'What does from £750 cover?',
      a: 'A one-off technical and content audit with a prioritised fix list starts at £750. Ongoing monthly work is scoped after the audit, so you only pay for what is worth doing.',
    },
    {
      q: 'Can you fix the website itself too?',
      a: 'Yes. Camber Co builds websites as well, so technical fixes do not get stuck in a hand-off between agencies.',
    },
  ];

  const schema = JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': 'https://camberco.co.uk/services/seo#service',
      name: 'SEO Services',
      serviceType: 'Search engine optimisation',
      provider: { '@id': 'https://camberco.co.uk/#organization' },
      areaServed: { '@type': 'Country', name: 'United Kingdom' },
      url: 'https://camberco.co.uk/services/seo',
      description:
        'Practical SEO for UK small businesses. Technical audits, keyword strategy, on-page optimisation and honest reporting.',
      offers: {
        '@type': 'Offer',
        price: '750',
        priceCurrency: 'GBP',
        description: 'from £750',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ]);
  ---

  <Layout
    title="SEO for Small Businesses UK | Camber Co"
    description="Practical SEO services for UK small businesses from £750. Technical audits, keyword strategy and content that ranks. Honest reporting, no vanity dashboards."
    schema={schema}
  >
    <StarfieldHero />

    <main class="service-page">
      <section class="hero">
        <div class="container">
          <div class="hero-copy" data-reveal>
            <div class="status-chip">
              <span class="status-dot" aria-hidden="true"></span>
              <span class="status-label">[ SEO MODE ]</span>
              <span class="status-path">camber/services/seo</span>
            </div>
            <h1>Get found by the people already searching for you.</h1>
            <p>
              Practical SEO for UK small businesses. We fix the technical plumbing, target the
              terms your customers actually type, and report in plain English.
            </p>
            <p class="price-line">{service.fromPrice}</p>
            <div class="hero-actions">
              <a href={auditHref} class="btn btn-primary">&gt; {AUDIT_CTA_LABEL}</a>
              <button type="button" class="btn btn-secondary" data-chat-open={service.chat}>&gt; Chat about it</button>
            </div>
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="container">
          <div class="section-header" data-reveal>
            <p class="section-tag">$ cat what-you-get.json</p>
            <h2>What the work actually is.</h2>
          </div>

          <div class="example-grid" data-reveal-stagger>
            {deliverables.map((item) => (
              <article class="terminal-card">
                <div class="card-bar">
                  <span class="window-dot window-dot--red"></span>
                  <span class="window-dot window-dot--yellow"></span>
                  <span class="window-dot window-dot--green"></span>
                  <span class="card-path">~/seo</span>
                </div>
                <div class="card-body">
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="container">
          <div class="section-header" data-reveal>
            <p class="section-tag">$ man seo</p>
            <h2>Questions before we start ranking.</h2>
          </div>

          <div class="faq-list" data-reveal>
            {faqs.map((item, i) => (
              <details class="faq-item" open={i === 0}>
                <summary>
                  <span aria-hidden="true">&gt;</span>
                  <span>{item.q}</span>
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="container">
          <div class="section-header" data-reveal>
            <p class="section-tag">$ ls ../services/</p>
            <h2>Where this usually leads.</h2>
            <p>Rankings work best when the site and the follow-up are sorted too.</p>
          </div>
          <div class="hero-actions" data-reveal>
            <a href="/services/builds" class="btn btn-secondary">&gt; Website builds</a>
            <a href="/services/automation" class="btn btn-secondary">&gt; Workflow automation</a>
          </div>
        </div>
      </section>

      <section class="cta">
        <div class="container">
          <div class="cta-card" data-reveal>
            <h2>Losing customers to page two?</h2>
            <p>
              Send us your site. The free 30-minute audit call will tell you what is holding
              your rankings back and whether it is worth fixing. No pitch.
            </p>
            <div class="cta-actions">
              <a href={auditHref} class="btn btn-primary">&gt; {AUDIT_CTA_LABEL}</a>
              <button type="button" class="btn btn-secondary" data-chat-open={service.chat}>&gt; Chat about it</button>
            </div>
            <p class="cta-flags">
              <span>--crawlable</span>
              <span>--measured</span>
              <span>--no-vanity-reports</span>
            </p>
          </div>
        </div>
      </section>
    </main>

    <ChatDrawer />
  </Layout>
  ```

- [ ] Copy the entire `<style>` block (from `<style>` to `</style>` inclusive) from `src/pages/services/consultations.astro` (created in Task 4) into this file, unchanged. It is identical for all four new service pages.
- [ ] Copy the entire `<script>` block from `src/pages/services/consultations.astro` into this file, unchanged, after the style block.
- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify:
  ```bash
  grep -q '<title>SEO for Small Businesses UK | Camber Co</title>' dist/client/services/seo/index.html && echo TITLE_OK
  grep -q '"price":"750"' dist/client/services/seo/index.html && grep -q '"@type":"FAQPage"' dist/client/services/seo/index.html && echo SCHEMA_OK
  grep -q 'from £750' dist/client/services/seo/index.html && echo PRICE_OK
  grep -q 'data-chat-open="seo"' dist/client/services/seo/index.html && echo CHAT_OK
  grep -q 'href="/services/builds"' dist/client/services/seo/index.html && echo LINKS_OK
  ```
  Expected: all five OK lines.
- [ ] Commit:
  ```bash
  git add src/pages/services/seo.astro && git commit -m "$(cat <<'EOF'
  Add SEO services page

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 6: /services/training page

**Files:**
- Create: `src/pages/services/training.astro`

**Interfaces:**
- Consumes: `services` entry `slug: 'training'` (`fromPrice: 'from £197'`, `chat: 'training'`); `AUDIT_CTA_LABEL`, `BOOKING_URL`.
- Produces: route `/services/training` with two Offer nodes (197 solo, 1500 team) matching visible prices exactly.

**Steps:**

- [ ] Create `src/pages/services/training.astro`. Frontmatter and markup exactly:

  ```astro
  ---
  import Layout from '../../layouts/Layout.astro';
  import StarfieldHero from '../../components/StarfieldHero.astro';
  import ChatDrawer from '../../components/ChatDrawer.astro';
  import { services } from '../../data/services';
  import { AUDIT_CTA_LABEL, BOOKING_URL } from '../../lib/site';

  const service = services.find((s) => s.slug === 'training')!;
  const auditHref = BOOKING_URL ?? '/contact';

  const deliverables = [
    {
      title: 'Solo founder sessions',
      desc: '90 minutes one to one. Prompting that works, automation basics and tool choices for your business. £197 per session.',
    },
    {
      title: 'Team workshops',
      desc: 'Half a day or a full day, hands-on with your real work. From £1,500 per workshop.',
    },
    {
      title: 'Working automations',
      desc: 'You leave with at least one automation running on your own accounts, not a demo on ours.',
    },
    {
      title: 'Notes and recordings',
      desc: 'Every session comes with a recording and a written playbook your team can reuse.',
    },
  ];

  const faqs = [
    {
      q: 'Do I need a technical background?',
      a: 'No. Sessions are built for non-technical founders and teams. If you can use email and a spreadsheet, you can do this.',
    },
    {
      q: 'What tools do you cover?',
      a: 'Claude, ChatGPT, n8n and the tools you already use. Sessions are built around your stack, not a fixed curriculum.',
    },
    {
      q: 'What does a team workshop look like?',
      a: 'Half a day or a full day, working on your real processes. Teams leave with at least one working automation and a shared playbook.',
    },
    {
      q: 'Is this a course?',
      a: 'No. It is live, hands-on coaching on your actual business. No pre-recorded videos, no generic slides.',
    },
    {
      q: 'Who runs the sessions?',
      a: 'Charlie runs every session personally. I take a small number of clients each quarter.',
    },
  ];

  const schema = JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': 'https://camberco.co.uk/services/training#service',
      name: 'Training & Coaching',
      serviceType: 'AI training and coaching',
      provider: { '@id': 'https://camberco.co.uk/#organization' },
      areaServed: { '@type': 'Country', name: 'United Kingdom' },
      url: 'https://camberco.co.uk/services/training',
      description:
        'Hands-on AI training for founders and teams. Solo sessions and team workshops built around your real work.',
      offers: [
        {
          '@type': 'Offer',
          price: '197',
          priceCurrency: 'GBP',
          description: 'Solo founder session, £197',
        },
        {
          '@type': 'Offer',
          price: '1500',
          priceCurrency: 'GBP',
          description: 'Team workshop, from £1,500',
        },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ]);
  ---

  <Layout
    title="AI Training and Coaching for Founders and Teams | Camber Co"
    description="Hands-on AI training. Solo founder sessions from £197 and team workshops from £1,500. Learn prompting, automation and tool choice on your real work."
    schema={schema}
  >
    <StarfieldHero />

    <main class="service-page">
      <section class="hero">
        <div class="container">
          <div class="hero-copy" data-reveal>
            <div class="status-chip">
              <span class="status-dot" aria-hidden="true"></span>
              <span class="status-label">[ TRAINING MODE ]</span>
              <span class="status-path">camber/services/training</span>
            </div>
            <h1>Make AI a skill your business owns.</h1>
            <p>
              Hands-on coaching for founders and teams. Built around your real work,
              not a slide deck. You keep the skill when the session ends.
            </p>
            <p class="price-line">Solo sessions £197. Team workshops from £1,500.</p>
            <div class="hero-actions">
              <a href={auditHref} class="btn btn-primary">&gt; {AUDIT_CTA_LABEL}</a>
              <button type="button" class="btn btn-secondary" data-chat-open={service.chat}>&gt; Chat about it</button>
            </div>
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="container">
          <div class="section-header" data-reveal>
            <p class="section-tag">$ cat what-you-get.json</p>
            <h2>What a session covers.</h2>
          </div>

          <div class="example-grid" data-reveal-stagger>
            {deliverables.map((item) => (
              <article class="terminal-card">
                <div class="card-bar">
                  <span class="window-dot window-dot--red"></span>
                  <span class="window-dot window-dot--yellow"></span>
                  <span class="window-dot window-dot--green"></span>
                  <span class="card-path">~/training</span>
                </div>
                <div class="card-body">
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="container">
          <div class="section-header" data-reveal>
            <p class="section-tag">$ man training</p>
            <h2>Questions before your first session.</h2>
          </div>

          <div class="faq-list" data-reveal>
            {faqs.map((item, i) => (
              <details class="faq-item" open={i === 0}>
                <summary>
                  <span aria-hidden="true">&gt;</span>
                  <span>{item.q}</span>
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="container">
          <div class="section-header" data-reveal>
            <p class="section-tag">$ ls ../services/</p>
            <h2>Where this usually leads.</h2>
            <p>Training pairs well with a strategy session or your own assistant.</p>
          </div>
          <div class="hero-actions" data-reveal>
            <a href="/services/consultations" class="btn btn-secondary">&gt; AI consultations</a>
            <a href="/services/personal-ai" class="btn btn-secondary">&gt; Personal AI</a>
          </div>
        </div>
      </section>

      <section class="cta">
        <div class="container">
          <div class="cta-card" data-reveal>
            <h2>Tired of watching AI tutorials that go nowhere?</h2>
            <p>
              Tell us what you want to be able to do. The free 30-minute audit call will map
              the fastest route to it. No pitch.
            </p>
            <div class="cta-actions">
              <a href={auditHref} class="btn btn-primary">&gt; {AUDIT_CTA_LABEL}</a>
              <button type="button" class="btn btn-secondary" data-chat-open={service.chat}>&gt; Chat about it</button>
            </div>
            <p class="cta-flags">
              <span>--hands-on</span>
              <span>--your-stack</span>
              <span>--no-slideware</span>
            </p>
          </div>
        </div>
      </section>
    </main>

    <ChatDrawer />
  </Layout>
  ```

- [ ] Copy the entire `<style>` block from `src/pages/services/consultations.astro` into this file, unchanged.
- [ ] Copy the entire `<script>` block from `src/pages/services/consultations.astro` into this file, unchanged.
- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify:
  ```bash
  grep -q '<title>AI Training and Coaching for Founders and Teams | Camber Co</title>' dist/client/services/training/index.html && echo TITLE_OK
  grep -q '"price":"197"' dist/client/services/training/index.html && grep -q '"price":"1500"' dist/client/services/training/index.html && echo SCHEMA_OK
  grep -q 'Solo sessions £197. Team workshops from £1,500.' dist/client/services/training/index.html && echo PRICE_OK
  grep -q 'data-chat-open="training"' dist/client/services/training/index.html && echo CHAT_OK
  ```
  Expected: all four OK lines.
- [ ] Commit:
  ```bash
  git add src/pages/services/training.astro && git commit -m "$(cat <<'EOF'
  Add training and coaching service page

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 7: /services/personal-ai page

**Files:**
- Create: `src/pages/services/personal-ai.astro`

**Interfaces:**
- Consumes: `services` entry `slug: 'personal-ai'` (`fromPrice: 'from £497'`, `chat: 'personal-ai'`); `AUDIT_CTA_LABEL`, `BOOKING_URL`. Copy grounded in the OpenClaw description already in `src/scripts/chat-prompts.ts:89-106`.
- Produces: route `/services/personal-ai` with Service + FAQPage JSON-LD, price 497.

**Steps:**

- [ ] Create `src/pages/services/personal-ai.astro`. Frontmatter and markup exactly:

  ```astro
  ---
  import Layout from '../../layouts/Layout.astro';
  import StarfieldHero from '../../components/StarfieldHero.astro';
  import ChatDrawer from '../../components/ChatDrawer.astro';
  import { services } from '../../data/services';
  import { AUDIT_CTA_LABEL, BOOKING_URL } from '../../lib/site';

  const service = services.find((s) => s.slug === 'personal-ai')!;
  const auditHref = BOOKING_URL ?? '/contact';

  const deliverables = [
    {
      title: 'OpenClaw, configured',
      desc: 'An open-source personal AI set up around your workflows. You own the setup outright.',
    },
    {
      title: 'On your channels',
      desc: 'Runs on WhatsApp, Telegram, Slack or Discord. Wherever you already work.',
    },
    {
      title: 'Memory that persists',
      desc: 'It learns your preferences and context over time instead of starting cold every chat.',
    },
    {
      title: 'Real tasks handled',
      desc: 'Clears inboxes, manages calendars, drafts replies and browses the web on your behalf.',
    },
  ];

  const faqs = [
    {
      q: 'What is OpenClaw?',
      a: 'An open-source personal AI assistant. You own the setup. There is no subscription lock-in to Camber Co.',
    },
    {
      q: 'Which apps can it work in?',
      a: 'WhatsApp, Telegram, Slack and Discord are the usual homes. It can also connect to email, calendars and the tools you already use.',
    },
    {
      q: 'Is my data private?',
      a: 'Standard setups use cloud AI models with sensible guardrails. For sensitive data we build on-premises versions that run a local model on dedicated hardware, so confidential files never leave the device.',
    },
    {
      q: 'What does from £497 cover?',
      a: 'A standard personal setup: installation, connection to your channels, and a handover session so you know how to run it. On-premises business builds are scoped separately.',
    },
    {
      q: 'Can it take actions, or just chat?',
      a: 'It takes actions. Clearing an inbox, booking a slot, chasing an invoice. Anything risky stays behind a confirmation step you control.',
    },
  ];

  const schema = JSON.stringify([
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      '@id': 'https://camberco.co.uk/services/personal-ai#service',
      name: 'Personal AI',
      serviceType: 'Personal AI assistant setup',
      provider: { '@id': 'https://camberco.co.uk/#organization' },
      areaServed: { '@type': 'Country', name: 'United Kingdom' },
      url: 'https://camberco.co.uk/services/personal-ai',
      description:
        'Personal AI assistant setup with OpenClaw. Runs on WhatsApp, Telegram, Slack or Discord with persistent memory and real task handling. Private on-premises builds available.',
      offers: {
        '@type': 'Offer',
        price: '497',
        priceCurrency: 'GBP',
        description: 'from £497',
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    },
  ]);
  ---

  <Layout
    title="Personal AI Assistant Setup with OpenClaw | Camber Co"
    description="Your own AI assistant from £497. OpenClaw setup on WhatsApp, Telegram, Slack or Discord, with persistent memory and real task handling. Private on-premises builds available."
    schema={schema}
  >
    <StarfieldHero />

    <main class="service-page">
      <section class="hero">
        <div class="container">
          <div class="hero-copy" data-reveal>
            <div class="status-chip">
              <span class="status-dot" aria-hidden="true"></span>
              <span class="status-label">[ ASSISTANT MODE ]</span>
              <span class="status-path">camber/services/personal-ai</span>
            </div>
            <h1>An AI assistant that knows your work. On your terms.</h1>
            <p>
              We set up OpenClaw, an open-source personal AI, on the channels you already use.
              It remembers context, handles real tasks and answers to you, not a subscription.
            </p>
            <p class="price-line">{service.fromPrice}</p>
            <div class="hero-actions">
              <a href={auditHref} class="btn btn-primary">&gt; {AUDIT_CTA_LABEL}</a>
              <button type="button" class="btn btn-secondary" data-chat-open={service.chat}>&gt; Chat about it</button>
            </div>
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="container">
          <div class="section-header" data-reveal>
            <p class="section-tag">$ cat what-you-get.json</p>
            <h2>What the setup includes.</h2>
          </div>

          <div class="example-grid" data-reveal-stagger>
            {deliverables.map((item) => (
              <article class="terminal-card">
                <div class="card-bar">
                  <span class="window-dot window-dot--red"></span>
                  <span class="window-dot window-dot--yellow"></span>
                  <span class="window-dot window-dot--green"></span>
                  <span class="card-path">~/personal-ai</span>
                </div>
                <div class="card-body">
                  <h3>{item.title}</h3>
                  <p>{item.desc}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="container">
          <div class="section-header" data-reveal>
            <p class="section-tag">$ man personal-ai</p>
            <h2>Questions before it moves in.</h2>
          </div>

          <div class="faq-list" data-reveal>
            {faqs.map((item, i) => (
              <details class="faq-item" open={i === 0}>
                <summary>
                  <span aria-hidden="true">&gt;</span>
                  <span>{item.q}</span>
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="container">
          <div class="section-header" data-reveal>
            <p class="section-tag">$ ls ../services/</p>
            <h2>Where this usually leads.</h2>
            <p>Assistants get more useful when your workflows are automated underneath them.</p>
          </div>
          <div class="hero-actions" data-reveal>
            <a href="/services/automation" class="btn btn-secondary">&gt; Workflow automation</a>
            <a href="/services/consultations" class="btn btn-secondary">&gt; AI consultations</a>
          </div>
        </div>
      </section>

      <section class="cta">
        <div class="container">
          <div class="cta-card" data-reveal>
            <h2>Want an assistant that actually does the work?</h2>
            <p>
              Tell us what eats your day. The free 30-minute audit call will tell you what an
              assistant could take off your plate. No pitch.
            </p>
            <div class="cta-actions">
              <a href={auditHref} class="btn btn-primary">&gt; {AUDIT_CTA_LABEL}</a>
              <button type="button" class="btn btn-secondary" data-chat-open={service.chat}>&gt; Chat about it</button>
            </div>
            <p class="cta-flags">
              <span>--open-source</span>
              <span>--your-data</span>
              <span>--always-on</span>
            </p>
          </div>
        </div>
      </section>
    </main>

    <ChatDrawer />
  </Layout>
  ```

- [ ] Copy the entire `<style>` block from `src/pages/services/consultations.astro` into this file, unchanged.
- [ ] Copy the entire `<script>` block from `src/pages/services/consultations.astro` into this file, unchanged.
- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify:
  ```bash
  grep -q '<title>Personal AI Assistant Setup with OpenClaw | Camber Co</title>' dist/client/services/personal-ai/index.html && echo TITLE_OK
  grep -q '"price":"497"' dist/client/services/personal-ai/index.html && grep -q '"@type":"FAQPage"' dist/client/services/personal-ai/index.html && echo SCHEMA_OK
  grep -q 'from £497' dist/client/services/personal-ai/index.html && echo PRICE_OK
  grep -q 'data-chat-open="personal-ai"' dist/client/services/personal-ai/index.html && echo CHAT_OK
  ```
  Expected: all four OK lines.
- [ ] Commit:
  ```bash
  git add src/pages/services/personal-ai.astro && git commit -m "$(cat <<'EOF'
  Add personal AI service page

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 8: /privacy page

**Files:**
- Create: `src/pages/privacy.astro`

**Interfaces:**
- Consumes: `COMPANY_NUMBER` from `src/lib/site.ts` (Task 1). Renders the registration line ONLY when it is set.
- Produces: route `/privacy` naming Supabase, Resend, OpenAI and Vercel as processors, `hello@camberco.co.uk` as contact, retention statements, no placeholders.

**Steps:**

- [ ] Create `src/pages/privacy.astro` with exactly this content:

  ```astro
  ---
  import Layout from '../layouts/Layout.astro';
  import { COMPANY_NUMBER } from '../lib/site';

  const lastUpdated = '2026-07-10';
  ---

  <Layout
    title="Privacy Policy | Camber Co"
    description="How Camber Co collects, uses and protects your data across enquiries, the newsletter and the site chat assistant."
  >
    <main class="privacy-page">
      <div class="container">
        <header data-reveal>
          <p class="section-tag">$ cat privacy.md</p>
          <h1>Privacy policy</h1>
          <p class="updated">Last updated: {lastUpdated}</p>
        </header>

        <section aria-labelledby="who-we-are">
          <h2 id="who-we-are">Who we are</h2>
          <p>
            Camber Co is an AI automation consultancy based in London, run by Charlie Waite.
            We build automations, websites, apps and AI systems for small businesses.
            This policy explains what data this site collects and what we do with it.
          </p>
          {COMPANY_NUMBER && (
            <p>Registered in England and Wales. Company number {COMPANY_NUMBER}.</p>
          )}
          <p>
            Questions about your data: <a href="mailto:hello@camberco.co.uk">hello@camberco.co.uk</a>.
          </p>
        </section>

        <section aria-labelledby="what-we-collect">
          <h2 id="what-we-collect">What we collect</h2>
          <ul>
            <li>
              <strong>Enquiries.</strong> Your name, email address, message and the service you
              are interested in, whether you use the contact form or the chat assistant submits
              an enquiry on your behalf.
            </li>
            <li>
              <strong>Newsletter.</strong> Your email address, confirmation status and the dates
              you signed up and confirmed.
            </li>
            <li>
              <strong>Chat.</strong> The transcript of your conversation with the site assistant.
              Messages are sent to OpenAI to generate replies. Your name and email are only
              recorded if you choose to share them.
            </li>
            <li>
              <strong>Technical.</strong> Your IP address, used briefly for rate limiting to
              prevent abuse. Vercel Analytics collects anonymised usage statistics. We do not
              use advertising cookies.
            </li>
          </ul>
        </section>

        <section aria-labelledby="how-we-use">
          <h2 id="how-we-use">How we use it</h2>
          <p>
            We use your data to reply to your enquiry, to send the newsletter you asked for,
            and to improve our services. We do not sell your data. We do not share it for
            marketing.
          </p>
        </section>

        <section aria-labelledby="who-processes">
          <h2 id="who-processes">Who processes it</h2>
          <p>Four providers process data on our behalf, each only to deliver their service:</p>
          <ul>
            <li><strong>Supabase</strong> hosts our database, including enquiries and newsletter records.</li>
            <li><strong>Resend</strong> delivers our emails.</li>
            <li><strong>OpenAI</strong> processes chat messages to generate assistant replies.</li>
            <li><strong>Vercel</strong> hosts the site and provides anonymised analytics.</li>
          </ul>
        </section>

        <section aria-labelledby="retention">
          <h2 id="retention">How long we keep it</h2>
          <ul>
            <li>
              <strong>Enquiries and chat transcripts.</strong> Kept while we deal with your
              enquiry and for up to 24 months afterwards, then deleted.
            </li>
            <li>
              <strong>Newsletter.</strong> Kept while you are subscribed. If you unsubscribe we
              stop sending immediately and keep only a minimal record so we do not email you again.
            </li>
            <li>
              <strong>Rate limiting data.</strong> Deleted automatically within days.
            </li>
          </ul>
        </section>

        <section aria-labelledby="your-rights">
          <h2 id="your-rights">Your rights</h2>
          <p>
            Under UK GDPR you can ask for a copy of your data, ask us to correct it, or ask us
            to delete it. Email <a href="mailto:hello@camberco.co.uk">hello@camberco.co.uk</a>
            and we will act on it. You can also complain to the Information Commissioner's
            Office at <a href="https://ico.org.uk" rel="noopener noreferrer" target="_blank">ico.org.uk</a>.
          </p>
        </section>
      </div>
    </main>
  </Layout>

  <style>
    .privacy-page {
      position: relative;
      z-index: 2;
      padding: clamp(96px, 13vw, 148px) 0 clamp(72px, 9vw, 112px);
      background: var(--color-base);
    }

    .container {
      max-width: 760px;
      margin: 0 auto;
      padding: 0 var(--space-8);
      display: grid;
      gap: var(--space-10);
    }

    .section-tag {
      margin: 0 0 var(--space-3);
      font-family: var(--font-mono);
      font-size: var(--type-caption);
      color: var(--color-green-500);
    }

    h1 {
      margin: 0;
      font-family: var(--font-mono);
      font-size: var(--type-h1);
      line-height: 1.12;
      letter-spacing: 0;
      color: var(--color-text-primary);
    }

    .updated {
      margin: var(--space-3) 0 0;
      font-family: var(--font-mono);
      font-size: var(--type-caption);
      color: var(--color-text-muted);
    }

    h2 {
      margin: 0 0 var(--space-4);
      font-family: var(--font-mono);
      font-size: var(--type-h3);
      letter-spacing: 0;
      color: var(--color-text-primary);
    }

    p,
    li {
      margin: 0;
      color: var(--color-text-secondary);
      line-height: 1.7;
    }

    p + p {
      margin-top: var(--space-3);
    }

    ul {
      display: grid;
      gap: var(--space-3);
      margin: 0;
      padding-left: var(--space-6);
    }

    strong {
      color: var(--color-text-primary);
    }

    a {
      color: var(--color-green-500);
      text-decoration: underline;
      text-underline-offset: 3px;
    }

    a:hover,
    a:focus-visible {
      color: var(--color-green-400);
    }

    @media (max-width: 768px) {
      .container {
        padding: 0 var(--space-4);
      }
    }
  </style>
  ```

- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify:
  ```bash
  grep -q '<title>Privacy Policy | Camber Co</title>' dist/client/privacy/index.html && echo TITLE_OK
  grep -q 'Supabase' dist/client/privacy/index.html && grep -q 'Resend' dist/client/privacy/index.html && grep -q 'OpenAI' dist/client/privacy/index.html && echo PROCESSORS_OK
  grep -q 'hello@camberco.co.uk' dist/client/privacy/index.html && echo CONTACT_OK
  grep -c 'Company number' dist/client/privacy/index.html
  ```
  Expected: `TITLE_OK`, `PROCESSORS_OK`, `CONTACT_OK`, then `0` (the company number line must NOT render while `COMPANY_NUMBER` is null).
- [ ] Commit:
  ```bash
  git add src/pages/privacy.astro && git commit -m "$(cat <<'EOF'
  Add privacy policy page

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 9: Nav and Footer links for /work and /privacy

**Files:**
- Modify: `src/components/Nav.astro` (lines 2-6, the `navLinks` array only)
- Modify: `src/components/Footer.astro` (lines 2-6, the `navLinks` array only)

**Interfaces:**
- Consumes: existing `navLinks` render loops (`Nav.astro:22-28` desktop, `Nav.astro:91-99` mobile overlay; `Footer.astro:26-33` Navigation column). No markup or style changes needed; both components map over the arrays.
- Produces: crawlable links to `/work` (nav + footer) and `/privacy` (footer) on every page.

**Scope guard:** Plan 4 also edits these two files (copy changes: tagline, EST year, consent notes). Touch ONLY the two arrays below. Do not reorder, reformat or edit anything else in either file.

**Steps:**

- [ ] In `src/components/Nav.astro`, replace lines 2-6:
  ```ts
  const navLinks = [
    { label: 'Services', href: '/services' },
    { label: 'Blog', href: '/blog' },
    { label: 'About', href: '/about-me' },
  ];
  ```
  with:
  ```ts
  const navLinks = [
    { label: 'Services', href: '/services' },
    { label: 'Work', href: '/work' },
    { label: 'Blog', href: '/blog' },
    { label: 'About', href: '/about-me' },
  ];
  ```
- [ ] In `src/components/Footer.astro`, replace lines 2-6:
  ```ts
  const navLinks = [
    { label: '~/services', href: '/services' },
    { label: '~/blog', href: '/blog' },
    { label: '~/about', href: '/about-me' },
  ];
  ```
  with:
  ```ts
  const navLinks = [
    { label: '~/services', href: '/services' },
    { label: '~/work', href: '/work' },
    { label: '~/blog', href: '/blog' },
    { label: '~/about', href: '/about-me' },
    { label: '~/privacy', href: '/privacy' },
  ];
  ```
- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify on the built homepage (Nav and Footer render on every page):
  ```bash
  grep -q 'href="/work"' dist/client/index.html && echo WORK_LINK_OK
  grep -q 'href="/privacy"' dist/client/index.html && echo PRIVACY_LINK_OK
  grep -q '~/privacy' dist/client/index.html && echo FOOTER_LABEL_OK
  ```
  Expected: all three OK lines.
- [ ] Commit:
  ```bash
  git add src/components/Nav.astro src/components/Footer.astro && git commit -m "$(cat <<'EOF'
  Link /work and /privacy from nav and footer

  Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
  EOF
  )"
  ```

---

### Task 10: Full-plan verification sweep

**Files:**
- Test only. No files created or modified.

**Interfaces:**
- Consumes: everything shipped by Tasks 1-9.
- Produces: evidence that the acceptance criteria for this plan's scope hold.

**Steps:**

- [ ] Clean build:
  ```bash
  pnpm build
  ```
  Expected: success, no warnings about missing imports.
- [ ] All six new routes exist with unique titles:
  ```bash
  for f in work services/consultations services/seo services/training services/personal-ai privacy; do
    grep -o '<title>[^<]*</title>' "dist/client/$f/index.html"
  done
  ```
  Expected output, exactly these six lines in order:
  ```
  <title>Camber Builds | Apps and Websites Shipped by Camber Co</title>
  <title>AI Consultant for Small Businesses in London | Camber Co</title>
  <title>SEO for Small Businesses UK | Camber Co</title>
  <title>AI Training and Coaching for Founders and Teams | Camber Co</title>
  <title>Personal AI Assistant Setup with OpenClaw | Camber Co</title>
  <title>Privacy Policy | Camber Co</title>
  ```
- [ ] Every new page carries JSON-LD:
  ```bash
  for f in work services/consultations services/seo services/training services/personal-ai; do
    grep -c 'application/ld+json' "dist/client/$f/index.html"
  done
  ```
  Expected: `1` five times.
- [ ] Sitemap picked up the new routes (the sitemap integration includes all prerendered pages automatically, `astro.config.mjs:9-11`):
  ```bash
  grep -o 'camberco.co.uk/work[/<]' dist/client/sitemap-0.xml | head -1
  grep -o 'camberco.co.uk/services/consultations[/<]' dist/client/sitemap-0.xml | head -1
  grep -o 'camberco.co.uk/privacy[/<]' dist/client/sitemap-0.xml | head -1
  ```
  Expected: one match line each.
- [ ] No em dashes in any file this plan created:
  ```bash
  grep -l '—' src/pages/work.astro src/pages/privacy.astro src/pages/services/consultations.astro src/pages/services/seo.astro src/pages/services/training.astro src/pages/services/personal-ai.astro scripts/fetch-appstore-screenshots.mjs; echo "exit=$?"
  ```
  Expected: no file paths printed, `exit=1` (grep found nothing).
- [ ] Prices match the contract everywhere they render:
  ```bash
  grep -q '£297 per session' dist/client/services/consultations/index.html \
    && grep -q 'from £750' dist/client/services/seo/index.html \
    && grep -q '£197' dist/client/services/training/index.html \
    && grep -q '£1,500' dist/client/services/training/index.html \
    && grep -q 'from £497' dist/client/services/personal-ai/index.html \
    && echo PRICES_OK
  ```
  Expected: `PRICES_OK`.
- [ ] Free call is never conflated with the paid audit: the string "AI Readiness Audit" must not appear on any page from this plan (it is a distinct paid product owned by other plans' copy):
  ```bash
  grep -rl 'AI Readiness Audit' src/pages/work.astro src/pages/privacy.astro src/pages/services/consultations.astro src/pages/services/seo.astro src/pages/services/training.astro src/pages/services/personal-ai.astro; echo "exit=$?"
  ```
  Expected: no file paths printed, `exit=1`.
- [ ] No commit for this task (verification only). If any check fails, fix within the owning task's file and amend that task's commit.
