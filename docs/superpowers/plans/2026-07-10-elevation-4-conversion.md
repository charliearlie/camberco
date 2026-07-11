# Existing-Page Conversion Edits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox ('- [ ]') syntax for tracking.

**Goal:** Rewrite the conversion surfaces of every existing page (homepage, /services, contact, about, three service pages, blog index, nav, footer, chat prompts) so each ends in a clear audit-call CTA, shows published prices, and reads as proof-first plain English.

**Architecture:** All service copy, prices and chat keys come from `src/data/services.ts` and all project proof from `src/data/projects.ts` (both created by Plan 1), with audit CTA config from `src/lib/site.ts`. Pages are Astro 5 prerendered pages with vanilla TS islands; the only script changes are a progressive-enhancement mode in `typewriter.ts` and the chatbot prompt/key updates that flow through `chat-drawer.ts` and `/api/chat`.

**Tech Stack:** Astro 5, TypeScript, Vitest, Supabase (untouched here), Vercel adapter (`pnpm build` emits static pages to `.vercel/output/static/`).

## Global Constraints

- pnpm only
- Astro 5
- British English copy, short sentences, NO em dashes anywhere in site copy
- prices exactly as the contract table
- every animation respects prefers-reduced-motion with a static fallback
- all Resend sends wrapped in waitUntil from @vercel/functions
- free 30-minute audit call is never conflated with the paid £750 AI Readiness Audit
- commit messages end with "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"

## Prerequisites (from Plan 1, do not recreate)

- `src/lib/site.ts` exports `SITE_URL`, `BOOKING_URL` (string | null, currently null), `AUDIT_CTA_LABEL = 'Book a free 30-minute audit'`.
- `src/data/services.ts` exports `services: Service[]` (7 entries with `slug`, `title`, `href`, `fromPrice`, `blurb`, `chat`).
- `src/data/projects.ts` exports `projects: Project[]` (football-iq, jodz, bio-core, clippin, whoscored-plus, oddschecker-plus, gazzetta-ai-predictor, ai-native-qa).
- Vitest installed and configured; run with `pnpm vitest run`.

If any of these are missing, stop and run Plan 1 first.

## Cross-plan notes (read before starting)

- All line numbers below refer to the files at commit `7de7c9a` (current `main` HEAD). Re-locate by content if drifted.
- `src/pages/index.astro` is also touched by Plan 2 (canonical/SEO mechanism) and Plan 5 (ROI calculator section). Keep every edit inside the section markers named in each task; do NOT touch the `<Layout ...>` props, and do NOT add or remove `canonicalUrl` props anywhere (Plan 2 owns canonical derivation and removal of hand-typed props).
- `src/scripts/about-terminal.ts` is rewritten by Plan 5 (terminal-engine extraction). This plan only changes two string literals in it; if Plan 5 has already landed, make the same copy fix in the new location.
- Links to `/work` (Plan 3) and `/privacy` (Plan 2) are added here before those pages exist. That is fine: builds do not verify internal link targets. Do not remove them.
- `src/scripts/chat-drawer.ts` also gets prompt chips/focus work in Plan 5. This plan only edits the `titles` record inside `openDrawer`.

---

### Task 1: Typewriter progressive enhancement + homepage hero rewrite

**Files:**
- Modify: `src/scripts/typewriter.ts` (add `enhanceTypewrite` after `typewrite`, lines 100-152; replace `initTypewriters`, lines 171-210)
- Modify: `src/pages/index.astro` (frontmatter imports line 2-6; hero section lines 293-319; `.sr-only` CSS lines 718-728; `.hero-display` CSS lines 840-864)

**Interfaces:**
- Consumes: `AUDIT_CTA_LABEL`, `BOOKING_URL` from `src/lib/site.ts`; existing `typeLine`, `createCursorSpan`, `prefersReducedMotion` in `typewriter.ts`.
- Produces: `export function enhanceTypewrite(container: HTMLElement, options?: TypewriterOptions): void` in `src/scripts/typewriter.ts`.

**Steps:**

- [ ] In `src/scripts/typewriter.ts`, insert this new exported function directly after the closing brace of `typewrite` (after line 152):

```ts
/**
 * Progressive enhancement: retypes text that is already server-rendered.
 *
 * `container`'s element children each hold one line of real text. With JS
 * disabled or prefers-reduced-motion set, the server-rendered text is left
 * untouched (static fallback). Otherwise each line is cleared and retyped
 * in place, so crawlers and reduced-motion users always see the real copy.
 */
export function enhanceTypewrite(
  container: HTMLElement,
  options: TypewriterOptions = {}
): void {
  const {
    speed = 40,
    startDelay = 0,
    cursorBlinkRate = 530,
    onComplete,
  } = options;

  const lineEls = Array.from(container.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement
  );
  if (lineEls.length === 0) return;

  const texts = lineEls.map((el) => el.textContent?.trim() ?? "");

  // The accessible name stays complete for the whole animation.
  container.setAttribute("aria-label", texts.join(" "));

  // Reduced motion: the server-rendered text is already correct. Done.
  if (prefersReducedMotion()) {
    onComplete?.();
    return;
  }

  const cursor = createCursorSpan(cursorBlinkRate);
  const LINE_GAP = 300; // ms pause between lines

  async function run(): Promise<void> {
    lineEls.forEach((el) => {
      el.textContent = "";
    });
    for (let i = 0; i < lineEls.length; i++) {
      await typeLine(lineEls[i], texts[i], cursor, speed);
      if (i < lineEls.length - 1) {
        await new Promise<void>((res) => setTimeout(res, LINE_GAP));
      }
    }
    onComplete?.();
  }

  if (startDelay > 0) {
    setTimeout(run, startDelay);
  } else {
    void run();
  }
}
```

- [ ] In the same file, replace the whole `initTypewriters` function (lines 171-210) with:

```ts
function readOptions(el: HTMLElement): TypewriterOptions {
  const options: TypewriterOptions = {};

  const rawSpeed = el.dataset["speed"];
  if (rawSpeed !== undefined) options.speed = Number(rawSpeed);

  const rawDelay = el.dataset["startDelay"];
  if (rawDelay !== undefined) options.startDelay = Number(rawDelay);

  const rawBlink = el.dataset["cursorBlink"];
  if (rawBlink !== undefined) options.cursorBlinkRate = Number(rawBlink);

  return options;
}

export function initTypewriters(): void {
  const elements = document.querySelectorAll<HTMLElement>("[data-typewriter]");

  elements.forEach((el) => {
    let lines: string[] = [];

    const rawLines = el.dataset["lines"];
    if (rawLines) {
      try {
        const parsed: unknown = JSON.parse(rawLines);
        if (Array.isArray(parsed)) {
          lines = parsed.map(String);
        }
      } catch {
        console.warn("[typewriter] Invalid JSON in data-lines:", rawLines);
      }
    }

    // Enhancement mode: no data-lines, but server-rendered child elements.
    // Retype the real text in place; without JS the real text just stays.
    if (lines.length === 0 && el.children.length > 0) {
      enhanceTypewrite(el, readOptions(el));
      return;
    }

    // Fallback: use the element's own text content as a single line.
    if (lines.length === 0 && el.textContent?.trim()) {
      lines = [el.textContent.trim()];
      el.textContent = "";
    }

    if (lines.length === 0) return;

    typewrite(el, lines, readOptions(el));
  });
}
```

Note the JSDoc block above the old `initTypewriters` (lines 154-170) stays where it is; only the function body block changes and `readOptions` is inserted above it.

- [ ] In `src/pages/index.astro` frontmatter, add after line 6 (`import BlogCard ...`):

```ts
import { AUDIT_CTA_LABEL, BOOKING_URL } from '../lib/site';

const auditHref = BOOKING_URL ?? '/contact';
```

- [ ] Replace the hero section (lines 293-319, from `<!-- ===== HERO ===== -->` through the closing `</section>`) with:

```astro
  <!-- ===== HERO ===== -->
  <section class="hero">
    <div class="hero-inner">
      <div class="status-chip">
        <span class="status-dot"></span>
        CAMBER.CO // LONDON // EST. 2024
      </div>

      <h1 class="hero-display" data-typewriter data-speed="32">
        <span class="hero-line hero-line--lead">Get 10-30 hours a month back.</span>
        <span class="hero-line hero-line--support">I build the AI systems that do your repetitive work.</span>
      </h1>

      <p class="hero-sub">The AI consultant who builds. Automation, AI systems, SEO and web development for UK founders and small businesses. Based in London.</p>

      <div class="hero-ctas">
        <a href={auditHref} class="btn-primary">&gt; {AUDIT_CTA_LABEL}</a>
        <button type="button" class="btn-ghost" data-chat-open="general">&gt; Chat about it</button>
      </div>

      <div class="scroll-indicator" id="scrollIndicator">scroll to explore ↓</div>
    </div>
  </section>
```

This removes the old `sr-only` H1 (the real H1 is now rendered text) and the old `data-lines` decoration. The existing `[data-chat-open]` wiring in this page's script block (line 1601) already handles the new hero chat button.

- [ ] In the `<style>` block of `index.astro`, delete the `.sr-only` rule (lines 718-728, including its comment header lines if they become empty) and replace the `.hero-display` rules (lines 840-864, i.e. `.hero-display` plus the three `nth-child` rules) with:

```css
  .hero-display {
    font-family: var(--font-mono);
    letter-spacing: -0.03em;
    line-height: 1.15;
    margin: 0 0 var(--space-8);
    min-height: calc(var(--type-display) * 2.4);
  }

  .hero-line {
    display: block;
  }

  .hero-line--lead {
    font-size: var(--type-display);
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .hero-line--support {
    font-size: calc(var(--type-display) * 0.45);
    font-weight: 500;
    color: var(--color-green-500);
    margin-top: var(--space-3);
  }
```

- [ ] Run `pnpm build`. Expected: build succeeds with no TypeScript errors.
- [ ] Verify the real H1 is server-rendered and the old JS-only hero is gone:

```bash
grep -Fq 'Get 10-30 hours a month back.' .vercel/output/static/index.html && \
grep -Fq 'I build the AI systems that do your repetitive work.' .vercel/output/static/index.html && \
grep -Fq 'EST. 2024' .vercel/output/static/index.html && \
grep -Fq 'Book a free 30-minute audit' .vercel/output/static/index.html && \
! grep -Fq 'AI Services for UK Founders and Small Businesses</h1>' .vercel/output/static/index.html && \
echo TASK1-OK
```

Expected output: `TASK1-OK`.

- [ ] Commit:

```bash
git add src/scripts/typewriter.ts src/pages/index.astro
git commit -m "Rewrite homepage hero as real text with typewriter enhancement" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Chat prompts: published prices, apps key, proof routing, email echo (TDD)

**Files:**
- Test: `src/scripts/chat-prompts.test.ts` (create)
- Modify: `src/scripts/chat-prompts.ts` (whole file, 121 lines)
- Modify: `src/scripts/chat-drawer.ts` (the `titles` record, lines 123-131)
- Modify: `src/pages/api/chat.ts` (`VALID_SERVICES` line 7; tool `service` description line 39)

**Interfaces:**
- Consumes: `services` from `src/data/services.ts`.
- Produces: `export type ServiceKey = 'consultations' | 'seo' | 'builds' | 'apps' | 'automation' | 'training' | 'personal-ai' | 'general'` and `export const SYSTEM_PROMPTS: Record<ServiceKey, string>` in `src/scripts/chat-prompts.ts`. Every `services[].chat` value is a valid `ServiceKey`.

**Steps:**

- [ ] Create `src/scripts/chat-prompts.test.ts` with exactly:

```ts
import { describe, expect, it } from 'vitest';
import { SYSTEM_PROMPTS, type ServiceKey } from './chat-prompts';
import { services } from '../data/services';

describe('chat prompts', () => {
  it('has a prompt for every service chat key', () => {
    for (const s of services) {
      const prompt = SYSTEM_PROMPTS[s.chat as ServiceKey];
      expect(prompt, `missing prompt for chat key "${s.chat}"`).toBeTruthy();
    }
  });

  it('quotes every published from-price exactly, in every prompt', () => {
    for (const s of services) {
      expect(SYSTEM_PROMPTS.general).toContain(s.fromPrice);
    }
  });

  it('no longer forbids quoting prices', () => {
    for (const prompt of Object.values(SYSTEM_PROMPTS)) {
      expect(prompt).not.toContain('Never quote specific prices');
    }
  });

  it('bans invented discounts', () => {
    expect(SYSTEM_PROMPTS.general).toContain('Never invent discounts');
  });

  it('echoes the email back before submitting', () => {
    expect(SYSTEM_PROMPTS.general).toContain(
      'repeat the email address back to the user'
    );
  });

  it('routes proof questions to /work', () => {
    expect(SYSTEM_PROMPTS.general).toContain('camberco.co.uk/work');
  });

  it('does not leak the admin URL', () => {
    for (const prompt of Object.values(SYSTEM_PROMPTS)) {
      expect(prompt).not.toContain('/admin/enquiries');
    }
  });

  it('contains no em dashes', () => {
    for (const prompt of Object.values(SYSTEM_PROMPTS)) {
      expect(prompt).not.toContain('—');
    }
  });
});
```

- [ ] Run `pnpm vitest run src/scripts/chat-prompts.test.ts`. Expected: FAIL. `SYSTEM_PROMPTS['apps']` is undefined, the from-prices are absent, `Never quote specific prices` is present, and prompts contain em dashes.

- [ ] Replace the entire contents of `src/scripts/chat-prompts.ts` with:

```ts
// src/scripts/chat-prompts.ts
// System prompts for the AI enquiry chatbot per service category

import { services } from '../data/services';

export type ServiceKey =
  | 'consultations'
  | 'seo'
  | 'builds'
  | 'apps'
  | 'automation'
  | 'training'
  | 'personal-ai'
  | 'general';

const PRICE_LINES = services
  .map((s) => `- ${s.title}: ${s.fromPrice}`)
  .join('\n');

const BASE_RULES = `
You are Camber AI, Charlie W's AI assistant on the Camber Co website.
You're friendly, to the point, and polite. Think helpful senior dev who's also good with people.
Keep responses SHORT (2-3 sentences max). No emojis. No markdown formatting.
You're having a conversation, not writing an essay.

PUBLISHED STARTING PRICES (quote these exactly, and only these):
${PRICE_LINES}

PROOF: Camber ships real products. Football IQ is live on the App Store. Jodz is in App Store review. bio-core is in development. ClipPin is open source. Charlie also built WhoScored Plus, Oddschecker Plus, and the Gazzetta AI Predictor in his professional work. If someone asks for proof or examples, point them to https://camberco.co.uk/work

RULES:
- You may state the published starting prices above, word for word. Final quotes depend on scope, so add that Charlie confirms an exact fixed quote after a free 30-minute audit call.
- Never invent discounts, bundles, or prices that are not in the list above. If asked for a discount, say prices are fixed but the 30-minute audit call is free.
- Never make promises about timelines or guarantees.
- Ask ONE question at a time. Wait for the answer before asking the next.
- Naturally collect the prospect's name and email during the conversation. After you understand what they need (usually after 3-5 exchanges), ask for their name and email so you can submit an enquiry on their behalf.
- Before submitting, repeat the email address back to the user and ask them to confirm it is correct. Only call submit_enquiry after they confirm.
- Once they confirm, use the submit_enquiry function. Then confirm: "done, I've sent that through. Charlie will be in touch within 24 hours."
- If the user goes off-topic, gently redirect: "interesting, but let's focus on how we can help your business. what are you working on?"
- If the user just wants generic AI advice, say: "happy to point you in the right direction, but Camber builds custom solutions. if you want something tailored, drop your details and Charlie will reach out."
- Be conversational. No bullet points or lists unless specifically useful.
`.trim();

export const SYSTEM_PROMPTS: Record<ServiceKey, string> = {
  consultations: `${BASE_RULES}

CONTEXT: The user opened chat on the AI consultations service (£297 per session).
Camber offers 1:1 AI strategy sessions for founders. Charlie audits their business, identifies where AI moves the needle, and delivers a prioritised action plan. No fluff. Clear decisions, clear next steps.

YOUR JOB: Qualify this prospect by understanding:
1. What their business does (industry, size, stage)
2. What they've already tried with AI (if anything)
3. What specific pain point or goal brought them here
4. How urgently they need help

Start with: "hey, you're looking at AI strategy. tell me a bit about your business and what's on your mind."`,

  automation: `${BASE_RULES}

CONTEXT: The user opened chat on the Workflow automation service (from £1,200).
Camber builds custom n8n workflow automations: connecting tools, eliminating manual steps, running 24/7 without babysitting. Clients typically get 10-30 hours a month back.

YOUR JOB: Qualify this prospect by understanding:
1. What manual/repetitive tasks are eating their time
2. What tools they currently use (CRM, email, spreadsheets, etc.)
3. Whether they've tried any automation before
4. Scale: how many people are affected and how often the task runs

Start with: "hey, sounds like you've got some manual work to kill. what tasks are eating most of your time right now?"`,

  training: `${BASE_RULES}

CONTEXT: The user opened chat on the Training & coaching service (from £197).
Camber offers hands-on 1:1 AI coaching for non-technical founders: practical skills, no CS degree required. We cover prompting, automation basics, evaluating AI tools, and shipping AI-powered features.

YOUR JOB: Qualify this prospect by understanding:
1. Their technical comfort level (total beginner to somewhat technical)
2. What they want to learn (prompting, automation, building AI features)
3. What their business does
4. What they've tried so far and where they got stuck

Start with: "hey, interested in AI training. what's your technical background like? total beginner or you've dabbled a bit?"`,

  seo: `${BASE_RULES}

CONTEXT: The user opened chat on the SEO services (from £750).
Camber offers practical SEO for small businesses. Technical audits, on-page optimisation, keyword strategy, and content planning. We work with a small team of trusted specialists to deliver SEO that actually moves rankings, not vanity reports.

YOUR JOB: Qualify this prospect by understanding:
1. What their business does and what their website is
2. Whether they've done any SEO before (or if this is new territory)
3. What their goals are (more traffic, local visibility, ranking for specific terms)
4. How urgently they need results

Start with: "hey, you're looking at SEO. tell me about your business and what you're trying to rank for."`,

  builds: `${BASE_RULES}

CONTEXT: The user opened chat on the Website builds service (from £2,500).
Camber builds simple, effective websites for small businesses. Clean design, fast performance, built to convert. Landing pages, full company sites, and web apps. Camber has shipped real products; see camberco.co.uk/work.

YOUR JOB: Qualify this prospect by understanding:
1. What they need built (website, web app, landing page, something else)
2. Whether they have an existing site or are starting fresh
3. What the site needs to do (lead gen, e-commerce, booking, portfolio)
4. Their timeline and any constraints

Start with: "hey, you're looking at getting something built. is this a new site, a rebuild, or a web app?"`,

  apps: `${BASE_RULES}

CONTEXT: The user opened chat on the Mobile apps service (from £4,500).
Camber designs and builds mobile apps from idea to App Store. Charlie built and shipped Football IQ (live on the App Store) and Jodz (in review) himself, using React Native, Expo, SwiftUI, and Supabase.

YOUR JOB: Qualify this prospect by understanding:
1. What the app should do and who it is for
2. Whether they need iOS, Android, or both
3. Whether anything exists yet (designs, prototype, existing product)
4. Their timeline and budget expectations

Start with: "hey, you're thinking about an app. what should it do, and who is it for?"`,

  'personal-ai': `${BASE_RULES}

CONTEXT: The user opened chat on the Personal AI service (from £497).
Camber builds custom AI assistants powered by OpenClaw: open-source, privacy-first AI that runs on your own terms.

WHAT WE OFFER:
- Personal bots: AI fine-tuned to your workflows. Runs on WhatsApp, Telegram, Slack, or Discord. Persistent memory that learns your preferences. Handles tasks autonomously: clears inboxes, manages calendars, automates repetitive work, browses the web for you.
- Enterprise bots: Everything above, plus dedicated hardware (Mac Mini). Runs a local Qwen AI model so confidential files never leave the device. All analysis happens locally; no data sent to Claude, ChatGPT, or Gemini. Perfect for businesses handling sensitive client data.

The key difference: personal bots use cloud AI models, enterprise bots run entirely on-premises for maximum privacy.

YOUR JOB: Qualify this prospect by understanding:
1. Who is this for: just them, or a team/company?
2. What they want the bot to do (answer questions, handle tasks, customer support, internal knowledge base)
3. What platforms they need it on
4. Whether data privacy/confidentiality is a concern (this determines personal vs enterprise)

Start with: "hey, you're looking at a personal AI bot. is this for you personally, or for a team or business?"`,

  general: `${BASE_RULES}

CONTEXT: The user opened the chat without selecting a specific service (e.g. from the terminal).
Camber Co offers: Workflow automation, Website builds, Mobile apps, AI consultations, SEO services, Training & coaching, and Personal AI (powered by OpenClaw).

YOUR JOB: Figure out what they need by understanding:
1. What brought them to the site
2. What their business does
3. What problem they're trying to solve

Then recommend the most relevant service and submit their enquiry once you have their details.

Start with: "hey, welcome to camber. what are you looking to build or fix?"`,
};
```

- [ ] In `src/scripts/chat-drawer.ts`, replace the `titles` record (lines 123-131) with:

```ts
  const titles: Record<ServiceKey, string> = {
    consultations: 'camber/ai // consultations',
    seo: 'camber/ai // seo',
    builds: 'camber/ai // builds',
    apps: 'camber/ai // apps',
    automation: 'camber/ai // automation',
    training: 'camber/ai // training',
    'personal-ai': 'camber/ai // personal ai',
    general: 'camber/ai',
  };
```

(This is required: `Record<ServiceKey, string>` no longer typechecks without the `apps` key, and the old values contained em dashes.)

- [ ] In `src/pages/api/chat.ts`, replace line 7 with:

```ts
const VALID_SERVICES: ServiceKey[] = ['consultations', 'seo', 'builds', 'apps', 'automation', 'training', 'personal-ai', 'general'];
```

and replace the tool parameter description on line 39 with:

```ts
        service: { type: 'string', description: 'The service they are interested in (Workflow automation, Website builds, Mobile apps, AI consultations, SEO services, Training & coaching, Personal AI, or Something else)' },
```

- [ ] Run `pnpm vitest run src/scripts/chat-prompts.test.ts`. Expected: all 8 tests PASS.
- [ ] Run `pnpm build`. Expected: success (confirms the `chat-drawer.ts` and `api/chat.ts` type changes compile).
- [ ] Commit:

```bash
git add src/scripts/chat-prompts.ts src/scripts/chat-prompts.test.ts src/scripts/chat-drawer.ts src/pages/api/chat.ts
git commit -m "Teach chatbot published prices, shipped proof, and email confirmation" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Homepage service grid rebuilt from services.ts with proof strip

**Files:**
- Modify: `src/pages/index.astro` (frontmatter import; services section lines 324-450; `.terminal-footer`/`.terminal-link` CSS around lines 1077-1102)

**Interfaces:**
- Consumes: `services` from `src/data/services.ts` (all seven, in contract order); `chat` keys valid after Task 2.
- Produces: homepage cards where the primary action is the service page link and chat is secondary; builds card carries a proof strip linking `/work`.

**Steps:**

- [ ] In `src/pages/index.astro` frontmatter, extend the site import block added in Task 1 to:

```ts
import { AUDIT_CTA_LABEL, BOOKING_URL } from '../lib/site';
import { services } from '../data/services';

const auditHref = BOOKING_URL ?? '/contact';
```

- [ ] Replace the whole services section (lines 324-450, from `<!-- ===== SERVICES ===== -->` through its closing `</section>`) with:

```astro
  <!-- ===== SERVICES ===== -->
  <section class="services" id="services">
    <div class="container">
      <div class="section-header" data-reveal>
        <span class="section-tag">services</span>
        <h2>What we build.</h2>
        <p>Seven services. Each has a page and a published starting price. No mystery quotes.</p>
      </div>
      <div class="service-grid" data-reveal-stagger>
        {services.map((service) => (
          <div class="terminal-card">
            <div class="terminal-titlebar">
              <span class="dot dot-red"></span>
              <span class="dot dot-yellow"></span>
              <span class="dot dot-green-tc"></span>
              <span class="terminal-title">camber/{service.slug}</span>
              <span class="terminal-status">{service.fromPrice}</span>
            </div>
            <div class="terminal-body">
              <h3>{service.title}</h3>
              <p>{service.blurb}</p>
              {service.slug === 'builds' && (
                <a href="/work" class="proof-strip">Shipped: Football IQ, WhoScored Plus, Jodz →</a>
              )}
              <div class="terminal-footer">
                <button class="terminal-chat" type="button" data-chat-open={service.chat}>→ chat</button>
                <a href={service.href} class="terminal-link">→ view service</a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
```

- [ ] In the `<style>` block, change `.terminal-footer` (lines 1077-1084) from `justify-content: flex-end;` to `justify-content: space-between;`, and add directly after the `.terminal-link:hover` rule (line 1102):

```css
  .terminal-chat {
    font-family: var(--font-mono);
    font-size: var(--type-caption);
    color: var(--color-text-muted);
    background: none;
    border: none;
    padding: 6px 0;
    cursor: pointer;
    transition: color var(--duration-quick) var(--easing-smooth);
  }

  .terminal-chat:hover {
    color: var(--color-text-primary);
  }

  .proof-strip {
    display: block;
    margin-top: var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--type-caption);
    color: var(--color-green-500);
    text-decoration: none;
  }

  .proof-strip:hover {
    text-decoration: underline;
  }
```

- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify all seven cards, page links, prices and the proof strip:

```bash
H=.vercel/output/static/index.html
for slug in automation builds apps consultations seo training personal-ai; do
  grep -Fq "camber/$slug" "$H" || { echo "MISSING $slug"; exit 1; }
  grep -Fq "href=\"/services/$slug\"" "$H" || { echo "MISSING LINK $slug"; exit 1; }
done
grep -Fq 'Shipped: Football IQ, WhoScored Plus, Jodz' "$H" && \
grep -Fq 'from £1,200' "$H" && grep -Fq '£297 per session' "$H" && \
grep -Fq 'data-chat-open="apps"' "$H" && echo TASK3-OK
```

Expected output: `TASK3-OK`.

- [ ] Commit:

```bash
git add src/pages/index.astro
git commit -m "Rebuild homepage service grid from services data with proof strip" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Homepage stats, FAQ copy, final CTA, JSON-LD alignment

**Files:**
- Modify: `src/pages/index.astro` (schema const: sameAs line 33, slogan line 44, OfferCatalog lines 107-168, FAQ mainEntity entries 1-3 lines 175-197; stat-row lines 481-494; visible FAQ items 1-3 lines 563-591; final CTA anchor line 706)

**Interfaces:**
- Consumes: `services`, `SITE_URL` from Plan 1 modules; `auditHref` from Task 1.
- Produces: JSON-LD OfferCatalog with exactly the 7 contract prices; FAQ schema text identical to visible FAQ text; `£m+` stat gone.

**Steps:**

- [ ] Add `SITE_URL` to the site import in the frontmatter:

```ts
import { AUDIT_CTA_LABEL, BOOKING_URL, SITE_URL } from '../lib/site';
```

- [ ] Confirm the Organization `sameAs` is `["https://linkedin.com/company/camber-co"]` (already set by Plan 2 Task 8; if not, set it now).

- [ ] In the schema const, change line 44 to:

```ts
    "slogan": "The AI consultant who builds."
```

- [ ] Replace the whole `hasOfferCatalog` object (lines 107-168) with:

```ts
    "hasOfferCatalog": {
      "@type": "OfferCatalog",
      "name": "Camber Co Services",
      "itemListElement": services.map((s) => ({
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": s.title,
          "url": `${SITE_URL}${s.href}`,
          "description": s.blurb,
        },
        "price": s.fromPrice.replace(/[^0-9]/g, ''),
        "priceCurrency": "GBP",
      })),
    }
```

(`'from £1,200'` yields `"1200"`, `'£297 per session'` yields `"297"`, etc. Seven offers, contract order, no more, no fewer.)

- [ ] In the `faqs` array in the index.astro frontmatter (created by Plan 2 Task 8; single source for both the visible FAQ and the FAQPage schema), replace the `a` values of the first three entries with the following three strings, in order. Keep the `q` values as they are:

```text
An AI consultancy helps businesses identify where artificial intelligence can save time, reduce costs, and improve operations. Camber Co goes further than advising. We build and deploy working tools: n8n workflow automation, websites, mobile apps, SEO, and personal AI assistants. I take on a small number of clients each quarter, so every engagement ships something real.
```

```text
Every service has a published starting price: workflow automation from £1,200, website builds from £2,500, mobile apps from £4,500, AI consultations at £297 per session, SEO from £750, training and coaching from £197, and personal AI from £497. The exact quote depends on scope. Every engagement starts with a free 30-minute audit call. No pitch, no obligation.
```

```text
Two things, and they are different. The free 30-minute audit call is a conversation: you describe how your business runs, I tell you what I would automate first. The paid AI Readiness Audit (£750) is a half-day assessment with a written, prioritised report. Most people start with the free call.
```

- [ ] Replace the stat-row (lines 481-494) with server-rendered values and the Camber-specific stat (40+ automations at a conservative 3 hours per month each gives the 120+ floor; no revenue claim):

```astro
          <div class="stat-row">
            <div class="stat-block">
              <span class="stat-number" data-count-to="40" data-count-suffix="+">40+</span>
              <span class="stat-label">automations shipped</span>
            </div>
            <div class="stat-block">
              <span class="stat-number" data-count-to="120" data-count-suffix="+">120+</span>
              <span class="stat-label">hours automated every month</span>
            </div>
            <div class="stat-block">
              <span class="stat-number" data-count-to="12">12</span>
              <span class="stat-label">years building software</span>
            </div>
          </div>
```

(`initCounters` in `scroll-reveal.ts` resets these to 0 on load and animates up on scroll, and with reduced motion it sets the final value instantly, so the server-rendered real value is the no-JS/static fallback. No script change needed.)

- [ ] In the final CTA section, replace the anchor (line 706) with:

```astro
      <a href={auditHref} class="btn-primary btn-large">&gt; {AUDIT_CTA_LABEL}</a>
```

- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify schema prices and stat replacement:

```bash
node -e "
const fs = require('fs');
const html = fs.readFileSync('.vercel/output/static/index.html', 'utf8');
const blocks = [...html.matchAll(/<script type=\"application\/ld\+json\">([\s\S]*?)<\/script>/g)]
  .flatMap((m) => { const p = JSON.parse(m[1]); return Array.isArray(p) ? p : [p]; });
const svc = blocks.find((b) => b.hasOfferCatalog);
const offers = svc.hasOfferCatalog.itemListElement;
if (offers.length !== 7) throw new Error('expected 7 offers, got ' + offers.length);
const want = { 'Workflow automation':'1200','Website builds':'2500','Mobile apps':'4500','AI consultations':'297','SEO services':'750','Training & coaching':'197','Personal AI':'497' };
for (const o of offers) {
  if (want[o.itemOffered.name] !== o.price) throw new Error('price mismatch: ' + o.itemOffered.name + '=' + o.price);
}
const org = blocks.find((b) => b.slogan);
if (org.slogan !== 'The AI consultant who builds.') throw new Error('slogan wrong');
const faq = blocks.find((b) => b['@type'] === 'FAQPage');
const q2 = faq.mainEntity.find((q) => q.name.startsWith('How much'));
if (!html.includes(q2.acceptedAnswer.text)) throw new Error('FAQ schema text does not match visible text');
console.log('TASK4-OK');
" && ! grep -Fq '£m+' .vercel/output/static/index.html && grep -Fq 'hours automated every month' .vercel/output/static/index.html && echo TASK4-ALL-OK
```

Expected output ends with `TASK4-ALL-OK`.

- [ ] Commit:

```bash
git add src/pages/index.astro
git commit -m "Align homepage schema, stats, and FAQ copy with published prices" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: /services index grid from services.ts

**Files:**
- Modify: `src/pages/services/index.astro` (frontmatter lines 1-87; hero copy lines 107-111; grid lines 114-140; CTA lines 144-155; CSS: `.terminal-card--chat` rules lines 311-313 and 353-355, `.card-footer` lines 340-344)

**Interfaces:**
- Consumes: `services` from `src/data/services.ts`; `AUDIT_CTA_LABEL`, `BOOKING_URL`, `SITE_URL` from `src/lib/site.ts`.
- Produces: all seven cards link their pages with visible from-prices; chat is secondary; schema offers match visible prices.

**Steps:**

- [ ] Replace the entire frontmatter (both `---` fences inclusive; lines 1-88 at 7de7c9a, longer after Plan 2 Task 8) with:

```astro
---
import Layout from '../../layouts/Layout.astro';
import StarfieldHero from '../../components/StarfieldHero.astro';
import ChatDrawer from '../../components/ChatDrawer.astro';
import { services } from '../../data/services';
import { AUDIT_CTA_LABEL, BOOKING_URL, SITE_URL } from '../../lib/site';

const auditHref = BOOKING_URL ?? '/contact';

const schema = JSON.stringify([
  {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    '@id': 'https://camberco.co.uk/services#services',
    name: 'Camber Co Services',
    itemListElement: services.map((service, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Service',
        name: service.title,
        url: `${SITE_URL}${service.href}`,
        provider: { '@id': 'https://camberco.co.uk/#organization' },
        offers: {
          '@type': 'Offer',
          price: service.fromPrice.replace(/[^0-9]/g, ''),
          priceCurrency: 'GBP',
        },
      },
    })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://camberco.co.uk/' },
      { '@type': 'ListItem', position: 2, name: 'Services', item: 'https://camberco.co.uk/services' },
    ],
  },
]);
---
```

Keep the existing `<Layout ...>` call exactly as it is (title, description, schema). Plan 2 already removed the canonicalUrl prop; do not re-add it.

- [ ] Replace the hero paragraph (lines 108-111) with:

```astro
          <p>
            Every service has a page and a published starting price. Pick the one
            that fits, or start with the problem and we will point you at the
            lightest useful next step.
          </p>
```

- [ ] Replace the grid (lines 114-140) with:

```astro
        <div class="service-grid" data-reveal-stagger>
          {services.map((service) => (
            <article class="terminal-card">
              <div class="card-bar">
                <span class="window-dot window-dot--red"></span>
                <span class="window-dot window-dot--yellow"></span>
                <span class="window-dot window-dot--green"></span>
                <span class="card-path">camber/{service.slug}</span>
                <span class="status-pill">{service.fromPrice}</span>
              </div>
              <div class="card-body">
                <h2>{service.title}</h2>
                <p>{service.blurb}</p>
                <div class="card-footer">
                  <a href={service.href} class="card-action">&gt; Open page</a>
                  <button type="button" class="card-action card-action--chat" data-chat-open={service.chat}>
                    &gt; Chat
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
```

- [ ] Replace the bottom CTA card content (lines 146-153) with:

```astro
        <div class="cta-card" data-reveal>
          <h2>Not sure which route fits?</h2>
          <p>Start with the problem. The free 30-minute audit call exists for exactly this.</p>
          <div class="cta-actions">
            <a href={auditHref} class="btn btn-primary">&gt; {AUDIT_CTA_LABEL}</a>
            <button type="button" class="btn btn-secondary" data-chat-open="general">&gt; Open chat</button>
          </div>
        </div>
```

- [ ] In the `<style>` block: delete the `.terminal-card--chat .status-pill` rule (lines 311-313) and the `.terminal-card--chat .card-action` rule (lines 353-355); replace `.card-footer` (lines 340-344) with:

```css
  .card-footer {
    align-self: end;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border-subtle);
  }
```

and add after the `.card-action` rule (line 351):

```css
  .card-action--chat {
    color: var(--color-text-muted);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .card-action--chat:hover {
    color: var(--color-text-primary);
  }
```

- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify:

```bash
H=.vercel/output/static/services/index.html
test "$(grep -o '&gt; Open page' "$H" | wc -l | tr -d ' ')" = "7" && \
test "$(grep -oF 'from £' "$H" | wc -l | tr -d ' ')" -ge 6 && \
grep -Fq '£297 per session' "$H" && \
grep -Fq 'href="/services/consultations"' "$H" && \
grep -Fq 'Book a free 30-minute audit' "$H" && echo TASK5-OK
```

Expected output: `TASK5-OK`. (Note: the `&gt;` entity is emitted literally into the built HTML, hence the grep pattern.)

- [ ] Commit:

```bash
git add src/pages/services/index.astro
git commit -m "Drive services index from shared data with visible prices" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Service page hero rewrites + visible from-prices

**Files:**
- Modify: `src/pages/services/automation.astro` (frontmatter imports after line 4; hero copy lines 102-117; CSS after `.hero-copy p` rule ending line 435)
- Modify: `src/pages/services/apps.astro` (frontmatter imports after line 4; hero copy lines 101-116; second chat button line 253; CSS after the `.hero-copy p` rule around line 345)
- Modify: `src/pages/services/builds.astro` (frontmatter imports after line 4; hero copy lines 108-123; CSS after the `.hero-copy p` rule around line 386)

**Interfaces:**
- Consumes: `services` from `src/data/services.ts`; `AUDIT_CTA_LABEL`, `BOOKING_URL` from `src/lib/site.ts`; `apps` chat key from Task 2.
- Produces: outcome H1s, 10-30 hours claim in automation hero, visible from-price line on all three pages.

**Steps:**

- [ ] In `src/pages/services/automation.astro`, add after line 4 (`import ChatDrawer ...`):

```ts
import { services } from '../../data/services';
import { AUDIT_CTA_LABEL, BOOKING_URL } from '../../lib/site';

const automationService = services.find((s) => s.slug === 'automation')!;
const auditHref = BOOKING_URL ?? '/contact';
```

- [ ] Replace the automation hero copy block (lines 102-117) with:

```astro
        <div class="hero-copy" data-reveal>
          <div class="status-chip">
            <span class="status-dot" aria-hidden="true"></span>
            <span class="status-label">[ WORKFLOW MODE ]</span>
            <span class="status-path">camber/services/automation</span>
          </div>
          <h1>Stop doing the same work twice. Workflows that run themselves.</h1>
          <p>
            Most small businesses lose 10-30 hours a month to repetitive admin.
            We connect the tools already in your business, remove the manual
            joins, and hand those hours back.
          </p>
          <p class="hero-price">{automationService.fromPrice} · fixed quote after a free audit call</p>
          <div class="hero-actions">
            <a href={auditHref} class="btn btn-primary">&gt; {AUDIT_CTA_LABEL}</a>
            <button type="button" class="btn btn-secondary" data-chat-open="automation">&gt; Chat about it</button>
          </div>
        </div>
```

- [ ] In the automation `<style>` block, add directly after the `.hero-copy p, .section-header p` rule (ends line 435):

```css
  .hero-price {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--type-body-sm);
    color: var(--color-green-500);
    letter-spacing: 0.02em;
  }
```

- [ ] In `src/pages/services/apps.astro`, add after line 4:

```ts
import { services } from '../../data/services';
import { AUDIT_CTA_LABEL, BOOKING_URL } from '../../lib/site';

const appsService = services.find((s) => s.slug === 'apps')!;
const auditHref = BOOKING_URL ?? '/contact';
```

- [ ] Replace the apps hero copy block (lines 101-116) with:

```astro
        <div class="hero-copy" data-reveal>
          <div class="status-chip">
            <span class="status-dot" aria-hidden="true"></span>
            <span class="status-label">[ APP MODE ]</span>
            <span class="status-path">camber/services/apps</span>
          </div>
          <h1>From idea to App Store without a dev team.</h1>
          <p>
            From prototype to App Store, we build mobile products that feel real
            quickly enough to test with actual users.
          </p>
          <p class="hero-price">{appsService.fromPrice} · fixed quote after a free audit call</p>
          <div class="hero-actions">
            <a href={auditHref} class="btn btn-primary">&gt; {AUDIT_CTA_LABEL}</a>
            <button type="button" class="btn btn-secondary" data-chat-open="apps">&gt; Chat about it</button>
          </div>
        </div>
```

- [ ] Still in `apps.astro`, change the bottom CTA chat button (line 253) from `data-chat-open="builds"` to `data-chat-open="apps"`, and add the same `.hero-price` CSS rule as automation directly after the `.hero-copy p, .section-header p` rule (around line 350).

- [ ] In `src/pages/services/builds.astro`, add after line 4:

```ts
import { services } from '../../data/services';
import { AUDIT_CTA_LABEL, BOOKING_URL } from '../../lib/site';

const buildsService = services.find((s) => s.slug === 'builds')!;
const auditHref = BOOKING_URL ?? '/contact';
```

- [ ] Replace the builds hero copy block (lines 108-123) with (H1 kept, "No toy generator." cut):

```astro
        <div class="hero-copy" data-reveal>
          <div class="status-chip">
            <span class="status-dot" aria-hidden="true"></span>
            <span class="status-label">[ BUILD MODE ]</span>
            <span class="status-path">camber/services/builds</span>
          </div>
          <h1>Websites that make the offer obvious.</h1>
          <p>
            The work is sharper positioning, cleaner structure, faster pages,
            and conversion paths that feel intentional from the first screen.
          </p>
          <p class="hero-price">{buildsService.fromPrice} · fixed quote after a free audit call</p>
          <div class="hero-actions">
            <a href={auditHref} class="btn btn-primary">&gt; {AUDIT_CTA_LABEL}</a>
            <button type="button" class="btn btn-secondary" data-chat-open="builds">&gt; Chat about it</button>
          </div>
        </div>
```

- [ ] Add the same `.hero-price` CSS rule to `builds.astro` directly after its `.hero-copy p, .section-header p` rule (around line 392).

- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify:

```bash
S=.vercel/output/static/services
grep -Fq 'Stop doing the same work twice. Workflows that run themselves.' $S/automation/index.html && \
grep -Fq '10-30 hours a month' $S/automation/index.html && \
grep -Fq 'from £1,200' $S/automation/index.html && \
grep -Fq 'From idea to App Store without a dev team.' $S/apps/index.html && \
grep -Fq 'from £4,500' $S/apps/index.html && \
! grep -Fq 'data-chat-open="builds"' $S/apps/index.html && \
grep -Fq 'Websites that make the offer obvious.' $S/builds/index.html && \
! grep -Fq 'No toy generator' $S/builds/index.html && \
grep -Fq 'from £2,500' $S/builds/index.html && echo TASK6-OK
```

Expected output: `TASK6-OK`.

- [ ] Commit:

```bash
git add src/pages/services/automation.astro src/pages/services/apps.astro src/pages/services/builds.astro
git commit -m "Rewrite service page heroes as outcomes with visible from-prices" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Contact page audit framing, next steps, proof, consent

**Files:**
- Modify: `src/pages/contact.astro` (frontmatter lines 1-4; subtitle lines 20-22; chips lines 50-79; after submit button line 91; after chat-alt lines 106-108; CSS additions at end of `<style>` block)

**Interfaces:**
- Consumes: `services` from `src/data/services.ts`.
- Produces: contact page with audit framing, three-step block, proof block, mailto fallback, consent note; service chips exactly matching the canonical seven titles.

**Steps:**

- [ ] In the frontmatter (rewritten by Plan 2 Task 8 to include a ContactPage + BreadcrumbList `schema` const), add one import after the ChatDrawer import: `import { services } from '../data/services';`. Do not remove or modify the `schema` const or the `schema={schema}` Layout prop.

- [ ] In the `<Layout ...>` call, change `title="Get in Touch — Camber Co"` to `title="Get in Touch | Camber Co"` and reword the description without em dashes, e.g. `description="Book a free 30-minute audit call with Camber Co. AI automation, websites, apps, SEO, training and personal AI for UK small businesses."`

- [ ] Replace the subtitle (lines 20-22) and add the next-steps block after it:

```astro
    <p class="page-subtitle">
      Every enquiry gets a free 30-minute audit call. No pitch. Tell me what is
      eating your time and I will tell you what I would automate first.
    </p>

    <!-- What happens next -->
    <ol class="next-steps" aria-label="What happens next">
      <li class="next-step">
        <span class="step-num" aria-hidden="true">01</span>
        <span class="step-text">I reply within 24 hours.</span>
      </li>
      <li class="next-step">
        <span class="step-num" aria-hidden="true">02</span>
        <span class="step-text">We book the free 30-minute audit call. You talk, I map what could be automated.</span>
      </li>
      <li class="next-step">
        <span class="step-num" aria-hidden="true">03</span>
        <span class="step-text">You get a short proposal with a fixed price. No chasing, no pressure.</span>
      </li>
    </ol>
```

- [ ] Replace the chips markup (lines 50-79, the `<div class="chips" id="service-chips">...</div>`) with:

```astro
        <div class="chips" id="service-chips">
          {services.map((service) => (
            <label class="chip">
              <input type="checkbox" name="service" value={service.title} />
              <span class="chip-text">{service.title}</span>
            </label>
          ))}
          <label class="chip">
            <input type="checkbox" name="service" value="Something else" />
            <span class="chip-text">Something else</span>
          </label>
        </div>
```

- [ ] Add the consent note inside the form, directly after the submit button (line 91, after `</button>`):

```astro
      <p class="consent-note">
        Your details are used to reply to your enquiry and nothing else.
        See the <a href="/privacy">privacy policy</a>.
      </p>
```

- [ ] Add the proof block and mailto fallback directly after the chat-alt paragraph (after line 108, before `</main>`):

```astro
    <!-- Proof -->
    <aside class="proof-block" aria-label="Recent work">
      <p class="proof-line">
        <strong>Football IQ</strong>, built and shipped by Camber, grew organic
        downloads 400% in its first months on the App Store.
      </p>
      <p class="proof-line">
        Charlie also built the Plus AI suite used by WhoScored, Oddschecker,
        and La Gazzetta dello Sport audiences.
      </p>
      <a href="/work" class="proof-link">See the work →</a>
    </aside>

    <p class="mailto-fallback">
      Prefer plain email? <a href="mailto:hello@camberco.co.uk">hello@camberco.co.uk</a>
    </p>
```

- [ ] Add to the end of the `<style>` block (before the closing `</style>`):

```css
  /* What happens next */
  .next-steps {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: 0;
    margin: 0 0 var(--space-10) 0;
  }

  .next-step {
    display: flex;
    align-items: baseline;
    gap: var(--space-3);
  }

  .step-num {
    font-family: var(--font-mono);
    font-size: var(--type-caption);
    font-weight: 700;
    color: var(--color-green-500);
    flex-shrink: 0;
  }

  .step-text {
    font-family: var(--font-sans);
    font-size: var(--type-body-sm);
    color: var(--color-text-secondary);
    line-height: 1.6;
  }

  /* Consent */
  .consent-note {
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--color-text-muted);
    line-height: 1.5;
    margin: 0;
  }

  .consent-note a {
    color: var(--color-text-muted);
    text-decoration: underline;
  }

  /* Proof */
  .proof-block {
    margin-top: var(--space-12);
    padding: var(--space-6);
    background: var(--color-surface-01);
    border: 1px solid var(--color-border-muted);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .proof-line {
    font-family: var(--font-sans);
    font-size: var(--type-body-sm);
    color: var(--color-text-secondary);
    line-height: 1.6;
    margin: 0;
  }

  .proof-line strong {
    color: var(--color-text-primary);
  }

  .proof-link {
    font-family: var(--font-mono);
    font-size: var(--type-body-sm);
    color: var(--color-green-400);
    text-decoration: none;
    width: fit-content;
  }

  .proof-link:hover {
    text-decoration: underline;
  }

  /* Mailto fallback */
  .mailto-fallback {
    margin-top: var(--space-6);
    text-align: center;
    font-family: var(--font-mono);
    font-size: var(--type-body-sm);
    color: var(--color-text-muted);
  }

  .mailto-fallback a {
    color: var(--color-green-400);
  }
```

- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify:

```bash
H=.vercel/output/static/contact/index.html
grep -Fq 'free 30-minute audit call' "$H" && \
grep -Fq 'I reply within 24 hours.' "$H" && \
grep -Fq 'grew organic' "$H" && grep -Fq '400%' "$H" && \
grep -Fq 'mailto:hello@camberco.co.uk' "$H" && \
grep -Fq 'privacy policy' "$H" && \
grep -Fq 'value="Workflow automation"' "$H" && \
grep -Fq 'value="Personal AI"' "$H" && \
grep -Fq 'value="Something else"' "$H" && echo TASK7-OK
```

Expected output: `TASK7-OK`.

- [ ] Commit:

```bash
git add src/pages/contact.astro
git commit -m "Add audit framing, next steps, and proof to contact page" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: About page: data-driven projects, why-founders section, trust fixes

**Files:**
- Modify: `src/pages/about-me.astro` (frontmatter: imports lines 1-3, delete inline Project interface + projects array lines 125-186, schema sameAs line 250; stats lines 339-363; insert why-hire section after stats section closing line 366; projects grid lines 481-532; links row lines 573-581; CTA desc + button lines 591-595; CSS: status pill line 1411, additions at end)
- Modify: `src/scripts/about-terminal.ts` (line 167 email string)

**Interfaces:**
- Consumes: `projects`, `Project` type from `src/data/projects.ts`; `AUDIT_CTA_LABEL`, `BOOKING_URL` from `src/lib/site.ts`.
- Produces: about page rendering all eight contract projects from data; no Gmail anywhere; scarcity copy; why-founders proof section.

**Steps:**

- [ ] In the frontmatter, add after line 3 (`import StarfieldHero ...`):

```ts
import { projects, type Project } from '../data/projects';
import { AUDIT_CTA_LABEL, BOOKING_URL } from '../lib/site';

const auditHref = BOOKING_URL ?? '/contact';

const statusMeta: Record<Project['status'], string> = {
  live: '● live',
  'in-submission': '◐ in submission',
  'in-development': '○ in development',
  'open-source': '◇ open source',
  'professional-work': '◆ professional work',
};

function projectLink(p: Project): { label: string; href: string } | null {
  if (p.links.appStore) return { label: 'View on the App Store', href: p.links.appStore };
  if (p.links.github) return { label: p.links.github.replace('https://', ''), href: p.links.github };
  if (p.links.web) return { label: p.links.web.replace('https://', ''), href: p.links.web };
  return null;
}
```

- [ ] Delete the inline `interface Project { ... }` and `const projects: Project[] = [ ... ];` block (lines 125-186). The data now comes from `src/data/projects.ts`.

- [ ] In the Person schema (line 250), change `'https://uk.linkedin.com/in/charlie-waite'` to `'https://linkedin.com/in/charlie-waite'`.

- [ ] Replace the stats grid contents (lines 339-363, the five `<div class="stat">` blocks) with server-rendered values and the `£m+` stat replaced:

```astro
          <div class="stat">
            <span class="stat-num"><span data-count-to="12">12</span><span class="stat-suffix">yrs</span></span>
            <span class="stat-label">shipping software</span>
          </div>

          <div class="stat">
            <span class="stat-num"><span data-count-to="7">7</span></span>
            <span class="stat-label">companies · 12 yrs</span>
          </div>

          <div class="stat">
            <span class="stat-num"><span data-count-to="40">40</span><span class="stat-suffix">+</span></span>
            <span class="stat-label">automations shipped</span>
          </div>

          <div class="stat">
            <span class="stat-num"><span data-count-to="500">500</span><span class="stat-suffix">k+</span></span>
            <span class="stat-label">daily users impacted</span>
          </div>

          <div class="stat">
            <span class="stat-num"><span data-count-to="4">4</span></span>
            <span class="stat-label">personal apps shipped</span>
          </div>
```

- [ ] Insert a new section directly after the stats section's closing `</section>` (line 366) and before `<!-- ===== CAREER ===== -->`:

```astro
    <!-- ===== WHY FOUNDERS HIRE ME ===== -->
    <section class="why-hire" id="why">
      <div class="container">

        <div class="section-header" data-reveal>
          <p class="section-tag">$ man charlie</p>
          <h2 class="section-title">Why founders hire me.</h2>
        </div>

        <div class="why-grid" data-reveal-stagger>
          <div class="why-card">
            <h3>Scale you can borrow</h3>
            <p>I built checkout used by 500,000 people a day at Just Eat and kept Trainline's booking flow running for millions. Your lead form and booking system are a quiet Tuesday by comparison.</p>
          </div>
          <div class="why-card">
            <h3>AI in production, not in slides</h3>
            <p>At Fairplay Sports Media I design and run AI agent fleets that do real work every day. The same patterns power the automations I build for clients.</p>
          </div>
          <div class="why-card">
            <h3>Boring, reliable software</h3>
            <p>At the BBC I built the internal tools that ran the entire online video catalogue. Systems that quietly work are a speciality. That is exactly what your automation should be.</p>
          </div>
          <div class="why-card">
            <h3>Deliberately small</h3>
            <p>I take on a small number of clients each quarter and lead every project personally. You get the person who built the thing, not an account manager.</p>
          </div>
        </div>

      </div>
    </section>
```

- [ ] Replace the projects grid (lines 481-532, the `<div class="project-grid" ...>` block) with the data-driven version, and add the showcase link after it:

```astro
        <div class="project-grid" data-reveal-stagger>
          {projects.map((project) => {
            const link = projectLink(project);
            return (
              <article class={`project-card project-card--${project.slug}`}>
                <details class="project-details">
                  <summary class="project-summary">
                    <div class="card-bar" aria-hidden="true">
                      <span class="card-dot card-dot--red"></span>
                      <span class="card-dot card-dot--yellow"></span>
                      <span class="card-dot card-dot--green"></span>
                      <span class="card-path">~/{project.slug}</span>
                      <span class={`status-pill status-pill--${project.status}`}>
                        {statusMeta[project.status]}
                      </span>
                    </div>
                    <div class="card-body">
                      <div class="card-top">
                        <h3 class="card-title">{project.name}</h3>
                        <span class="card-toggle" aria-hidden="true">[+]</span>
                      </div>
                      <p class="card-desc">{project.tagline}</p>
                      <div class="card-tags">
                        {project.tech.slice(0, 4).map((tag) => <span class="card-tag">{tag}</span>)}
                      </div>
                    </div>
                  </summary>

                  <div class="card-expand">
                    <div class="card-expand-inner">
                      <p class="card-long">{project.story}</p>
                      {project.tech.length > 4 && (
                        <div class="card-tags">
                          {project.tech.slice(4).map((tag) => <span class="card-tag">{tag}</span>)}
                        </div>
                      )}
                      {link && (
                        <a
                          href={link.href}
                          class="card-link"
                          target="_blank"
                          rel="noopener noreferrer"
                        >→ {link.label}</a>
                      )}
                    </div>
                  </div>
                </details>
              </article>
            );
          })}
        </div>

        <a href="/work" class="projects-more" data-reveal>Full showcase with screenshots → /work</a>
```

- [ ] Replace the links row email and LinkedIn entries (lines 573-581) with:

```astro
          <a href="https://linkedin.com/in/charlie-waite" target="_blank" rel="noopener noreferrer" class="link-pill">
            <span class="link-prompt">$</span> linkedin.com/in/charlie-waite
          </a>
          <a href="https://github.com/charliearlie" target="_blank" rel="noopener noreferrer" class="link-pill">
            <span class="link-prompt">$</span> github.com/charliearlie
          </a>
          <a href="mailto:hello@camberco.co.uk" class="link-pill">
            <span class="link-prompt">$</span> hello@camberco.co.uk
          </a>
```

- [ ] Replace the CTA description and button (lines 591-595) with the scarcity copy:

```astro
          <p class="cta-desc">
            I lead subscriptions at Fairplay Sports Media by day and take on a
            small number of Camber Co clients each quarter. The cap is deliberate.
            Every project gets me personally, from first call to handover.
          </p>
          <a href={auditHref} class="btn btn-primary">{AUDIT_CTA_LABEL}</a>
```

- [ ] In the `<style>` block: rename `.status-pill--work` (line 1411) to `.status-pill--professional-work` (keep its declarations unchanged), and add at the end of the style block:

```css
  /* ============================================================
     Why founders hire me
     ============================================================ */
  .why-hire {
    padding: clamp(80px, 12vw, 128px) 0;
    border-bottom: 1px solid var(--color-border-subtle);
    background: var(--color-base);
  }

  .why-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
  }

  .why-card {
    padding: var(--space-8);
    background: var(--color-surface-00);
    border-left: 2px solid var(--color-green-500);
    border-radius: 0 var(--radius-md) var(--radius-md) 0;
  }

  .why-card h3 {
    font-family: var(--font-mono);
    font-size: var(--type-body);
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 var(--space-3);
  }

  .why-card p {
    font-family: var(--font-sans);
    font-size: var(--type-body-sm);
    color: var(--color-text-secondary);
    line-height: 1.65;
    margin: 0;
  }

  .projects-more {
    display: inline-block;
    margin-top: var(--space-8);
    font-family: var(--font-mono);
    font-size: var(--type-body-sm);
    color: var(--color-green-500);
  }

  .projects-more:hover {
    text-decoration: underline;
  }

  @media (max-width: 768px) {
    .why-grid {
      grid-template-columns: 1fr;
    }
  }
```

- [ ] In `src/scripts/about-terminal.ts`, change line 167 from:

```ts
      <span class="t-muted">email:</span>     <span class="t-green">cw5790@gmail.com</span>
```

to:

```ts
      <span class="t-muted">email:</span>     <span class="t-green">hello@camberco.co.uk</span>
```

(If Plan 5 has already extracted this into `terminal-engine.ts` config, make the identical string change in the new location.)

- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify:

```bash
H=.vercel/output/static/about-me/index.html
grep -Fq 'hello@camberco.co.uk' "$H" && \
! grep -Fq 'cw5790@gmail.com' "$H" && \
grep -Fq 'Why founders hire me.' "$H" && \
grep -Fq '~/whoscored-plus' "$H" && \
grep -Fq '~/gazzetta-ai-predictor' "$H" && \
grep -Fq 'professional work' "$H" && \
! grep -Fq '£m+' "$H" && \
grep -Fq 'small number of Camber Co clients each quarter' "$H" && echo TASK8-OK
```

Expected output: `TASK8-OK`. (The HTML grep covers the visible mailto pill; the terminal string lives in a separate JS asset, so also run `! grep -rFq 'cw5790' src/scripts/` to confirm the source string is gone.)

- [ ] Commit:

```bash
git add src/pages/about-me.astro src/scripts/about-terminal.ts
git commit -m "Render about projects from shared data and fix trust drift" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Blog index audit band + newsletter consent notes

**Files:**
- Modify: `src/pages/blog/index.astro` (frontmatter after line 5; insert band after featured section line 106; add `<style>` block at end of file)
- Modify: `src/components/blog/NewsletterSignup.astro` (insert consent note after line 26; CSS addition after `.newsletter-msg.error` rule line 180)

**Interfaces:**
- Consumes: `AUDIT_CTA_LABEL`, `BOOKING_URL` from `src/lib/site.ts`.
- Produces: audit CTA band on blog index; consent note under the blog newsletter form.

**Steps:**

- [ ] In `src/pages/blog/index.astro` frontmatter, add after line 5 (`import '../../styles/blog.css';`):

```ts
import { AUDIT_CTA_LABEL, BOOKING_URL } from '../../lib/site';

const auditHref = BOOKING_URL ?? '/contact';
```

- [ ] Insert directly after the featured section's closing tag (after line 106, before `<!-- Post grid -->`):

```astro
    <!-- Audit CTA band -->
    <aside class="audit-band" aria-label="Book a free audit call">
      <p class="audit-band-copy">Reading about automation is free. So is the 30-minute audit call.</p>
      <a href={auditHref} class="audit-band-btn">&gt; {AUDIT_CTA_LABEL}</a>
    </aside>
```

- [ ] Add at the end of `src/pages/blog/index.astro` (after the closing `</Layout>`):

```astro
<style>
  .audit-band {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-6);
    flex-wrap: wrap;
    background: var(--color-surface-01);
    border: 1px solid var(--color-border-muted);
    border-radius: var(--radius-lg);
    padding: var(--space-6) var(--space-8);
    margin: var(--space-10) 0;
  }

  .audit-band-copy {
    font-family: var(--font-mono);
    font-size: var(--type-body);
    color: var(--color-text-primary);
    margin: 0;
  }

  .audit-band-btn {
    font-family: var(--font-mono);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    background: var(--color-green-500);
    color: var(--color-on-accent);
    padding: 10px 18px;
    border-radius: var(--radius-sm);
    text-decoration: none;
    white-space: nowrap;
    transition:
      background var(--duration-quick) var(--easing-smooth),
      transform var(--duration-quick) var(--easing-spring);
  }

  .audit-band-btn:hover {
    background: var(--color-green-400);
    transform: translateY(-1px);
  }

  @media (prefers-reduced-motion: reduce) {
    .audit-band-btn {
      transition: none;
    }
  }
</style>
```

- [ ] In `src/components/blog/NewsletterSignup.astro`, insert after the `newsletter-msg` paragraph (line 26), still inside the `<form>`:

```astro
      <p class="newsletter-consent">
        You are signing up for occasional Camber Co emails. One-click
        unsubscribe, any time. <a href="/privacy">Privacy policy</a>.
      </p>
```

- [ ] Add to the `NewsletterSignup.astro` `<style>` block, after the `.newsletter-msg.error` rule (line 180):

```css
  .newsletter-consent {
    font-family: var(--font-sans);
    font-size: 12px;
    color: var(--color-text-muted);
    line-height: 1.5;
    margin: var(--space-2) 0 0 0;
  }

  .newsletter-consent a {
    color: var(--color-text-muted);
    text-decoration: underline;
  }
```

- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify:

```bash
grep -Fq 'Reading about automation is free. So is the 30-minute audit call.' .vercel/output/static/blog/index.html && \
grep -Fq 'Book a free 30-minute audit' .vercel/output/static/blog/index.html && echo TASK9-OK
```

Expected output: `TASK9-OK`. (The consent note renders wherever `NewsletterSignup` is used, e.g. blog post pages; spot-check any built post page with `grep -rlF 'newsletter-consent' .vercel/output/static/blog/ | head -1`.)

- [ ] Commit:

```bash
git add src/pages/blog/index.astro src/components/blog/NewsletterSignup.astro
git commit -m "Add audit CTA band to blog index and newsletter consent note" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Nav + Footer: audit CTA, tagline, consent

**Files:**
- Modify: `src/components/Nav.astro` (frontmatter lines 1-7; CTA button lines 53-59; overlay CTA lines 100-108)
- Modify: `src/components/Footer.astro` (frontmatter lines 1-7; tagline line 20; connect CTA lines 54-61; consent note after newsletter form line 88; CSS addition after `.footer-nl-msg` error rule line 286)

**Interfaces:**
- Consumes: `AUDIT_CTA_LABEL`, `BOOKING_URL` from `src/lib/site.ts`.
- Produces: audit CTA in nav (desktop + mobile overlay), footer tagline "The AI consultant who builds.", consent note under footer newsletter. LinkedIn stays the single canonical `https://linkedin.com/company/camber-co` (Footer already has it; index schema was aligned in Task 4).

**Steps:**

- [ ] In `src/components/Nav.astro`, replace the frontmatter (lines 1-7) with:

```astro
---
import { BOOKING_URL } from '../lib/site';

const auditHref = BOOKING_URL ?? '/contact';

const navLinks = [
  { label: 'Services', href: '/services' },
  { label: 'Work', href: '/work' },
  { label: 'Blog', href: '/blog' },
  { label: 'About', href: '/about-me' },
];
---
```

- [ ] Replace the desktop CTA button (lines 53-59) with (short label for the 56px bar; the full `AUDIT_CTA_LABEL` is used on in-page CTAs):

```astro
    <!-- CTA -->
    <a
      href={auditHref}
      class="cta-button"
    >
      &gt;&nbsp;Book a free audit
    </a>
```

- [ ] Replace the mobile overlay CTA item (lines 100-108) with:

```astro
    <li>
      <a
        href={auditHref}
        class="overlay-link overlay-cta"
      >
        <span class="overlay-cmd" aria-hidden="true">$ camber </span>
        <span class="overlay-section">free audit</span>
      </a>
    </li>
```

- [ ] In `src/components/Footer.astro`, replace the frontmatter (lines 1-7) with:

```astro
---
import { BOOKING_URL } from '../lib/site';

const auditHref = BOOKING_URL ?? '/contact';

const navLinks = [
  { label: '~/services', href: '/services' },
  { label: '~/work', href: '/work' },
  { label: '~/blog', href: '/blog' },
  { label: '~/about', href: '/about-me' },
  { label: '~/privacy', href: '/privacy' },
];
---
```

- [ ] Change the tagline (line 20) to:

```astro
        <p class="tagline">The AI consultant who builds.</p>
```

- [ ] Replace the Connect column CTA item (lines 54-61) with:

```astro
          <li>
            <a
              href={auditHref}
              class="footer-link footer-link--cta"
            >
              Book a free audit call
            </a>
          </li>
```

(Leave the LinkedIn item at lines 44-53 exactly as it is: `https://linkedin.com/company/camber-co` is the canonical company URL.)

- [ ] Insert the consent note after the newsletter form's message paragraph (line 87, inside the `<form>` after `<p class="footer-nl-msg" ...></p>`):

```astro
        <p class="footer-nl-consent">
          Occasional emails from Camber Co. One-click unsubscribe.
          <a href="/privacy">Privacy policy</a>.
        </p>
```

- [ ] Add to the Footer `<style>` block after the `.footer-nl-msg:global(.error)` rule (line 286):

```css
  .footer-nl-consent {
    font-family: var(--font-sans);
    font-size: 11px;
    color: var(--color-text-muted);
    line-height: 1.5;
    margin: var(--space-2) 0 0 0;
  }

  .footer-nl-consent a {
    color: var(--color-text-muted);
    text-decoration: underline;
  }
```

- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify on the built homepage (Nav + Footer render on every page):

```bash
H=.vercel/output/static/index.html
grep -Fq 'Book a free audit' "$H" && \
grep -Fq 'The AI consultant who builds.' "$H" && \
grep -Fq 'free audit</span>' "$H" && \
grep -Fq 'linkedin.com/company/camber-co' "$H" && \
grep -Fq 'Occasional emails from Camber Co.' "$H" && \
grep -Fq 'href="/work"' "$H" && \
grep -Fq 'href="/privacy"' "$H" && echo TASK10-OK
```

Expected output: `TASK10-OK`.

- [ ] Final full-suite check: run `pnpm vitest run` (all tests pass, including Task 2's) and `pnpm build` one last time. Expected: both succeed.
- [ ] Commit:

```bash
git add src/components/Nav.astro src/components/Footer.astro
git commit -m "Put the audit CTA in nav and footer with new tagline" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
