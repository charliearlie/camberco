# Interactive Demos & Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox ('- [ ]') syntax for tracking.

**Goal:** Ship the interactive proof layer (ROI calculator, industry-switching automation demo, before/after race, terminal autoplay) and the free performance fixes (static scroll-reveal CSS, lazy dark-only starfield, chat drawer accessibility polish, honest builds mock, sales-narrative apps quiz).

**Architecture:** Pure logic lives in `src/scripts/*.ts` modules with colocated vitest tests; DOM wiring is exported `init*` functions consumed by self-initialising `<script>` blocks inside Astro components, so each component can be dropped onto any page. The duplicated ~500-line terminal implementations collapse into one engine (`src/scripts/terminal-engine.ts`) that owns rendering/input/autoplay while `terminal.ts` and `about-terminal.ts` keep only their command registries.

**Tech Stack:** Astro 5 (server output, prerendered pages, @astrojs/vercel), vanilla TypeScript islands, three.js (dynamic import only), vitest, pnpm.

## Global Constraints

- pnpm only
- Astro 5
- British English copy, short sentences, NO em dashes anywhere in site copy
- prices exactly as the contract table
- every animation respects prefers-reduced-motion with a static fallback
- all Resend sends wrapped in waitUntil from @vercel/functions
- free 30-minute audit call is never conflated with the paid £750 AI Readiness Audit
- commit messages end with "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"

> **Note (Tasks 2, 3, 5, 11, 12):** Line numbers cited for `automation.astro`, `builds.astro`, `apps.astro`, and `index.astro` are pre-Plan-2/4; locate insertion points by the quoted markup/selector anchors, not by line number.

## Shared interface contract obligations of THIS plan

This plan creates (binding for other plans):

```ts
// src/scripts/terminal-engine.ts
export type AutoplayLine = { type: 'command' | 'output'; text: string; delayMs?: number }
export function createTerminal(config: { root: HTMLElement; commands: Record<string, (args: string[]) => string | string[]>; bootLines?: string[]; promptLabel?: string }): { run(cmd: string): void; autoplay(script: AutoplayLine[]): Promise<void>; destroy(): void }

// src/scripts/roi-calculator.ts
export const RECOVERY_RATE = 0.7
export function calcSavings(i: { hoursPerWeek: number; hourlyCost: number; people: number }): { hoursPerMonth: number; poundsPerMonth: number; poundsPerYear: number }
export function initRoiCalculator(root: HTMLElement): void
```

`createTerminal` accepts additional OPTIONAL config fields (`completions`, `observeThreshold`, `bootLineDelayMs`); calls that pass only the contract fields remain valid.

Testing: vitest is installed/configured by Plan 1 Task 1 (`vitest.config.ts`, tests colocated as `src/**/*.test.ts`, run `pnpm vitest run`). Task 1 below contains a fallback scaffold in case Plan 1 has not landed yet in this worktree.

---

### Task 1: ROI calculator logic (`calcSavings`, TDD)

**Files:**
- Create: `src/scripts/roi-calculator.ts`
- Test: `src/scripts/roi-calculator.test.ts`
- Create (only if missing): `vitest.config.ts`, plus `pnpm add -D vitest`

**Interfaces:**
- Produces: `RECOVERY_RATE: 0.7`, `calcSavings(i: { hoursPerWeek: number; hourlyCost: number; people: number }): { hoursPerMonth: number; poundsPerMonth: number; poundsPerYear: number }`, `initRoiCalculator(root: HTMLElement): void` (per shared contract)
- Consumes: `/api/enquiries` POST (JSON body `{ name, email, website, service, message }`; honeypot field is `website`; see `src/pages/api/enquiries.ts` lines 64-121)

Maths: `hoursPerMonth = hoursPerWeek * people * 0.7 * 52 / 12` (recovered hours). `poundsPerMonth = hoursPerMonth * hourlyCost`. `poundsPerYear = poundsPerMonth * 12`. Values are returned unrounded; the DOM layer rounds for display.

- [ ] Ensure vitest exists. Run `pnpm vitest --version`. If it errors (Plan 1 not merged yet), run `pnpm add -D vitest` and create `vitest.config.ts` with exactly:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] Write the failing test at `src/scripts/roi-calculator.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { RECOVERY_RATE, calcSavings } from './roi-calculator';

describe('calcSavings', () => {
  it('exposes the 70% recovery assumption', () => {
    expect(RECOVERY_RATE).toBe(0.7);
  });

  it('computes savings for 10 h/week at £25/h across 2 people', () => {
    const result = calcSavings({ hoursPerWeek: 10, hourlyCost: 25, people: 2 });
    // 10 * 2 * 0.7 = 14 recovered hours per week; * 52 / 12 = 60.666... per month
    expect(result.hoursPerMonth).toBeCloseTo(60.6667, 3);
    expect(result.poundsPerMonth).toBeCloseTo(1516.67, 1);
    expect(result.poundsPerYear).toBeCloseTo(18200, 6);
  });

  it('computes savings for a single person', () => {
    const result = calcSavings({ hoursPerWeek: 5, hourlyCost: 30, people: 1 });
    // 5 * 1 * 0.7 = 3.5 recovered hours per week; * 52 / 12 = 15.1666... per month
    expect(result.hoursPerMonth).toBeCloseTo(15.1667, 3);
    expect(result.poundsPerMonth).toBeCloseTo(455, 6);
    expect(result.poundsPerYear).toBeCloseTo(5460, 6);
  });

  it('returns zero savings for zero hours', () => {
    const result = calcSavings({ hoursPerWeek: 0, hourlyCost: 25, people: 3 });
    expect(result.hoursPerMonth).toBe(0);
    expect(result.poundsPerMonth).toBe(0);
    expect(result.poundsPerYear).toBe(0);
  });
});
```

- [ ] Run `pnpm vitest run src/scripts/roi-calculator.test.ts`. Expected failure: `Cannot find module './roi-calculator'` (or "Failed to resolve import").
- [ ] Create `src/scripts/roi-calculator.ts` with exactly:

```ts
// src/scripts/roi-calculator.ts
// Pure savings maths + DOM wiring for the RoiCalculator component.

export const RECOVERY_RATE = 0.7;

const WEEKS_PER_MONTH = 52 / 12;

export interface RoiInputs {
  hoursPerWeek: number;
  hourlyCost: number;
  people: number;
}

export interface RoiSavings {
  hoursPerMonth: number;
  poundsPerMonth: number;
  poundsPerYear: number;
}

export function calcSavings(i: RoiInputs): RoiSavings {
  const hoursPerMonth = i.hoursPerWeek * i.people * RECOVERY_RATE * WEEKS_PER_MONTH;
  const poundsPerMonth = hoursPerMonth * i.hourlyCost;
  return {
    hoursPerMonth,
    poundsPerMonth,
    poundsPerYear: poundsPerMonth * 12,
  };
}

// ---------------------------------------------------------------------------
// DOM wiring
// ---------------------------------------------------------------------------

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const gbp = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });

// Animates an element's text between numeric values.
// Mirrors the counter pattern in scroll-reveal.ts: 800ms, ease-out quartic.
// Reduced motion: instant update, no count-up.
function animateValue(el: HTMLElement, target: number, format: (n: number) => string): void {
  const from = Number(el.dataset['value'] ?? '0');
  el.dataset['value'] = String(target);

  if (prefersReducedMotion() || from === target) {
    el.textContent = format(target);
    return;
  }

  const DURATION = 800;
  const start = performance.now();
  const token = String(target);

  function easeOutQuart(t: number): number {
    return 1 - Math.pow(1 - t, 4);
  }

  function tick(now: number): void {
    if (el.dataset['value'] !== token) return; // a newer animation took over
    const progress = Math.min((now - start) / DURATION, 1);
    const current = from + (target - from) * easeOutQuart(progress);
    el.textContent = format(current);
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = format(target);
    }
  }

  requestAnimationFrame(tick);
}

export function initRoiCalculator(root: HTMLElement): void {
  const hoursInput = root.querySelector<HTMLInputElement>('[data-roi-hours]');
  const costInput = root.querySelector<HTMLInputElement>('[data-roi-cost]');
  const peopleInput = root.querySelector<HTMLInputElement>('[data-roi-people]');
  const hoursOut = root.querySelector<HTMLElement>('[data-roi-out-hours]');
  const monthOut = root.querySelector<HTMLElement>('[data-roi-out-month]');
  const yearOut = root.querySelector<HTMLElement>('[data-roi-out-year]');
  if (!hoursInput || !costInput || !peopleInput || !hoursOut || !monthOut || !yearOut) return;

  const hoursLabel = root.querySelector<HTMLElement>('[data-roi-label-hours]');
  const costLabel = root.querySelector<HTMLElement>('[data-roi-label-cost]');
  const peopleLabel = root.querySelector<HTMLElement>('[data-roi-label-people]');

  function readInputs(): RoiInputs {
    return {
      hoursPerWeek: Number(hoursInput!.value),
      hourlyCost: Number(costInput!.value),
      people: Number(peopleInput!.value),
    };
  }

  function render(): void {
    const inputs = readInputs();
    if (hoursLabel) hoursLabel.textContent = `${inputs.hoursPerWeek} h/week`;
    if (costLabel) costLabel.textContent = `£${inputs.hourlyCost}/hour`;
    if (peopleLabel) {
      peopleLabel.textContent = inputs.people === 1 ? '1 person' : `${inputs.people} people`;
    }

    const s = calcSavings(inputs);
    animateValue(hoursOut!, Math.round(s.hoursPerMonth), (n) => String(Math.round(n)));
    animateValue(monthOut!, Math.round(s.poundsPerMonth), (n) => `£${gbp.format(Math.round(n))}`);
    animateValue(yearOut!, Math.round(s.poundsPerYear), (n) => `£${gbp.format(Math.round(n))}`);
  }

  [hoursInput, costInput, peopleInput].forEach((input) => {
    input.addEventListener('input', render);
  });

  // First render animates from zero when the calculator scrolls into view,
  // matching the counter behaviour in scroll-reveal.ts.
  if (!('IntersectionObserver' in window)) {
    render();
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(root);
          render();
        });
      },
      { threshold: 0.3 },
    );
    observer.observe(root);
  }

  // --- "Email me this estimate" ---
  const form = root.querySelector<HTMLFormElement>('[data-roi-form]');
  const status = root.querySelector<HTMLElement>('[data-roi-form-status]');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const website = String(data.get('website') ?? ''); // honeypot
    if (!name || !email) return;

    const inputs = readInputs();
    const s = calcSavings(inputs);
    const message = [
      'ROI estimate request from the calculator.',
      `Manual admin: ${inputs.hoursPerWeek} hours per week, ${inputs.people} ${inputs.people === 1 ? 'person' : 'people'}, £${inputs.hourlyCost} per hour.`,
      `Estimated recovery: ${Math.round(s.hoursPerMonth)} hours and £${gbp.format(Math.round(s.poundsPerMonth))} per month (£${gbp.format(Math.round(s.poundsPerYear))} per year).`,
      'Assumes automation handles about 70% of this work.',
    ].join('\n');

    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (button) button.disabled = true;
    if (status) status.textContent = 'Sending...';

    try {
      const res = await fetch('/api/enquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, website, service: 'Automation', message }),
      });
      if (!res.ok) throw new Error('request failed');
      if (status) status.textContent = 'Sent. Charlie will reply within one working day.';
      form.reset();
    } catch {
      if (status) status.textContent = 'Something went wrong. Email hello@camberco.co.uk instead.';
    } finally {
      if (button) button.disabled = false;
    }
  });
}
```

- [ ] Run `pnpm vitest run src/scripts/roi-calculator.test.ts`. Expected: 4 tests pass.
- [ ] Commit:

```bash
git add src/scripts/roi-calculator.ts src/scripts/roi-calculator.test.ts vitest.config.ts package.json pnpm-lock.yaml
git commit -m "Add ROI calculator savings logic with tests

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(Only include `vitest.config.ts package.json pnpm-lock.yaml` if the fallback scaffold step actually ran.)

---

### Task 2: `RoiCalculator.astro` component + embed on /services/automation

**Files:**
- Create: `src/components/RoiCalculator.astro`
- Modify: `src/pages/services/automation.astro` (frontmatter imports around lines 1-5; insert a new section between the hero `</section>` at line 211 and the integrations `<section class="section-block">` at line 213)

**Interfaces:**
- Consumes: `initRoiCalculator(root: HTMLElement): void` from `src/scripts/roi-calculator.ts`
- Produces: `<RoiCalculator />` Astro component, self-initialising via its own `<script>`

- [ ] Create `src/components/RoiCalculator.astro` with exactly:

```astro
---
// RoiCalculator.astro
// Three sliders -> live hours/pounds recovered. Posts an estimate enquiry
// to /api/enquiries via "Email me this estimate". Self-initialising.
---

<div class="roi-calc" data-roi-calculator>
  <div class="roi-bar">
    <span class="roi-dot roi-dot--red"></span>
    <span class="roi-dot roi-dot--yellow"></span>
    <span class="roi-dot roi-dot--green"></span>
    <span class="roi-path">$ camber estimate --savings</span>
  </div>

  <div class="roi-body">
    <div class="roi-sliders">
      <label class="roi-field">
        <span class="roi-field-name">Hours of manual admin each week</span>
        <input type="range" min="1" max="40" step="1" value="10" data-roi-hours />
        <output class="roi-field-value" data-roi-label-hours>10 h/week</output>
      </label>

      <label class="roi-field">
        <span class="roi-field-name">Average hourly cost of that time</span>
        <input type="range" min="10" max="100" step="5" value="25" data-roi-cost />
        <output class="roi-field-value" data-roi-label-cost>£25/hour</output>
      </label>

      <label class="roi-field">
        <span class="roi-field-name">People doing this work</span>
        <input type="range" min="1" max="10" step="1" value="2" data-roi-people />
        <output class="roi-field-value" data-roi-label-people>2 people</output>
      </label>
    </div>

    <div class="roi-results" role="status" aria-live="polite">
      <div class="roi-result">
        <span class="roi-number" data-roi-out-hours data-value="0">0</span>
        <span class="roi-result-label">hours back per month</span>
      </div>
      <div class="roi-result">
        <span class="roi-number" data-roi-out-month data-value="0">£0</span>
        <span class="roi-result-label">saved per month</span>
      </div>
      <div class="roi-result">
        <span class="roi-number roi-number--year" data-roi-out-year data-value="0">£0</span>
        <span class="roi-result-label">saved per year</span>
      </div>
    </div>

    <p class="roi-assumption">Assumes automation handles about 70% of this work.</p>

    <form class="roi-form" data-roi-form>
      <input
        type="text"
        name="website"
        class="roi-honeypot"
        tabindex="-1"
        autocomplete="off"
        aria-hidden="true"
      />
      <input type="text" name="name" placeholder="your name" required aria-label="Your name" />
      <input type="email" name="email" placeholder="you@company.co.uk" required aria-label="Your email" />
      <button type="submit" class="roi-submit">&gt; Email me this estimate</button>
      <p class="roi-form-status" data-roi-form-status role="status"></p>
    </form>
  </div>
</div>

<style>
  .roi-calc {
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    background: var(--color-surface-00);
    overflow: hidden;
    box-shadow: 0 0 52px color-mix(in srgb, var(--color-green-500) 8%, transparent);
  }

  .roi-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 38px;
    padding: 0 var(--space-3);
    background: var(--color-surface-02);
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .roi-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .roi-dot--red { background: var(--color-error); }
  .roi-dot--yellow { background: var(--color-warning); }
  .roi-dot--green { background: var(--color-success); }

  .roi-path {
    margin-left: var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--type-caption);
    color: var(--color-text-muted);
  }

  .roi-body {
    display: grid;
    gap: var(--space-6);
    padding: var(--space-6);
  }

  .roi-sliders {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-6);
  }

  .roi-field {
    display: grid;
    gap: var(--space-2);
  }

  .roi-field-name {
    font-family: var(--font-sans);
    font-size: var(--type-body-sm);
    color: var(--color-text-secondary);
  }

  .roi-field input[type='range'] {
    width: 100%;
    accent-color: var(--color-green-500);
    cursor: pointer;
  }

  .roi-field-value {
    font-family: var(--font-mono);
    font-size: var(--type-label);
    color: var(--color-green-500);
  }

  .roi-results {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-4);
    padding: var(--space-4) 0;
    border-top: 1px solid var(--color-border-subtle);
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .roi-result {
    display: grid;
    gap: var(--space-1);
  }

  .roi-number {
    font-family: var(--font-mono);
    font-size: clamp(28px, 4vw, 44px);
    font-weight: 800;
    color: var(--color-text-primary);
    line-height: 1;
    letter-spacing: -0.03em;
  }

  .roi-number--year {
    color: var(--color-green-500);
  }

  .roi-result-label {
    font-family: var(--font-mono);
    font-size: var(--type-caption);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .roi-assumption {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--type-caption);
    color: var(--color-text-muted);
  }

  .roi-form {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  .roi-honeypot {
    position: absolute;
    left: -9999px;
    width: 1px;
    height: 1px;
    opacity: 0;
  }

  .roi-form input[type='text']:not(.roi-honeypot),
  .roi-form input[type='email'] {
    flex: 1 1 180px;
    min-height: 44px;
    padding: var(--space-2) var(--space-3);
    background: var(--color-surface-01);
    border: 1px solid var(--color-border-muted);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    font-family: var(--font-mono);
    font-size: var(--type-body-sm);
  }

  .roi-form input:focus-visible {
    outline: 2px solid var(--color-green-500);
    outline-offset: 1px;
  }

  .roi-submit {
    min-height: 44px;
    padding: var(--space-3) var(--space-6);
    background: var(--color-green-500);
    color: var(--color-on-accent);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: var(--type-label);
    font-weight: 700;
    transition: background var(--duration-quick) var(--easing-smooth);
  }

  .roi-submit:hover {
    background: var(--color-green-400);
  }

  .roi-submit:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .roi-form-status {
    flex-basis: 100%;
    margin: 0;
    min-height: 1.4em;
    font-family: var(--font-mono);
    font-size: var(--type-caption);
    color: var(--color-text-muted);
  }

  @media (max-width: 768px) {
    .roi-sliders,
    .roi-results {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .roi-submit {
      transition: none;
    }
  }
</style>

<script>
  import { initRoiCalculator } from '../scripts/roi-calculator.ts';

  document.querySelectorAll<HTMLElement>('[data-roi-calculator]').forEach(initRoiCalculator);
</script>
```

- [ ] In `src/pages/services/automation.astro`, add the import to the frontmatter (after line 4, `import ChatDrawer ...`):

```astro
import RoiCalculator from '../../components/RoiCalculator.astro';
```

- [ ] In `src/pages/services/automation.astro`, insert this section between the hero `</section>` (line 211) and the integrations section (line 213):

```astro
    <section class="section-block" id="roi">
      <div class="container">
        <div class="section-header" data-reveal>
          <p class="section-tag">$ camber estimate --savings</p>
          <h2>What is the manual work costing you?</h2>
          <p>Drag the sliders. The assumption is on screen, not hidden in a footnote.</p>
        </div>
        <div data-reveal>
          <RoiCalculator />
        </div>
      </div>
    </section>
```

- [ ] Run `pnpm build`. Expected: build succeeds.
- [ ] Verify the rendered output:

```bash
grep -c 'data-roi-calculator' .vercel/output/static/services/automation/index.html   # expect: 1
grep -c 'id="roi"' .vercel/output/static/services/automation/index.html              # expect: 1
grep -c 'Assumes automation handles about 70%' .vercel/output/static/services/automation/index.html  # expect: 1
grep -c 'name="website"' .vercel/output/static/services/automation/index.html        # expect: 1 (honeypot)
```

- [ ] Commit:

```bash
git add src/components/RoiCalculator.astro src/pages/services/automation.astro
git commit -m "Add ROI calculator component to automation page

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Before/after race demo + embed on /services/automation

**Files:**
- Create: `src/scripts/race-demo.ts`
- Test: `src/scripts/race-demo.test.ts`
- Create: `src/components/RaceDemo.astro`
- Modify: `src/pages/services/automation.astro` (frontmatter import; insert a section directly after the `#roi` section added in Task 2)

**Interfaces:**
- Produces: `formatClock(minutes: number): string`, `MANUAL_STEPS: RaceStep[]`, `TOTAL_MANUAL_MINUTES: number`, `AUTOMATED_SECONDS: number`, `initRaceDemo(root: HTMLElement): void`, `initRaceDemos(): void`
- Consumes: nothing external (typing primitive is a local reimplementation of the `typeLine` pattern from `src/scripts/typewriter.ts` lines 61-90; the clock/counter mirrors the RAF counter pattern from `src/scripts/scroll-reveal.ts` lines 148-180)

- [ ] Write the failing test at `src/scripts/race-demo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  AUTO_STEPS,
  AUTOMATED_SECONDS,
  MANUAL_STEPS,
  TOTAL_MANUAL_MINUTES,
  formatClock,
} from './race-demo';

describe('race demo data', () => {
  it('has exactly seven manual steps', () => {
    expect(MANUAL_STEPS).toHaveLength(7);
    MANUAL_STEPS.forEach((step) => {
      expect(step.text.length).toBeGreaterThan(0);
      expect(step.manualMinutes).toBeGreaterThan(0);
    });
  });

  it('totals 22 simulated manual minutes', () => {
    expect(TOTAL_MANUAL_MINUTES).toBe(22);
  });

  it('finishes the automated side in 3 seconds', () => {
    expect(AUTOMATED_SECONDS).toBe(3);
    expect(AUTO_STEPS.length).toBeGreaterThan(0);
  });

  it('contains no em dashes in any copy', () => {
    expect(JSON.stringify(MANUAL_STEPS) + JSON.stringify(AUTO_STEPS)).not.toMatch(/—/);
  });
});

describe('formatClock', () => {
  it('formats zero', () => {
    expect(formatClock(0)).toBe('00:00');
  });

  it('formats fractional minutes as mm:ss', () => {
    expect(formatClock(7.5)).toBe('07:30');
  });

  it('formats the manual total', () => {
    expect(formatClock(22)).toBe('22:00');
  });
});
```

- [ ] Run `pnpm vitest run src/scripts/race-demo.test.ts`. Expected failure: cannot resolve `./race-demo`.
- [ ] Create `src/scripts/race-demo.ts` with exactly:

```ts
// src/scripts/race-demo.ts
// Before/after race: the manual side types seven steps against a simulated
// running clock; the automated side completes the same job in ~3 seconds.
// Reduced motion: both sides render their completed end state immediately.

export interface RaceStep {
  text: string;
  /** Simulated minutes this step takes a human. */
  manualMinutes: number;
}

export const MANUAL_STEPS: RaceStep[] = [
  { text: 'Open the inbox and find the enquiry', manualMinutes: 2 },
  { text: 'Read it and work out what they need', manualMinutes: 3 },
  { text: 'Check the calendar for a slot', manualMinutes: 2 },
  { text: 'Copy the details into the CRM', manualMinutes: 4 },
  { text: 'Write the reply', manualMinutes: 6 },
  { text: 'Attach the quote and send it', manualMinutes: 3 },
  { text: 'Set a reminder to chase next week', manualMinutes: 2 },
];

export const TOTAL_MANUAL_MINUTES = MANUAL_STEPS.reduce(
  (sum, step) => sum + step.manualMinutes,
  0,
);

export const AUTOMATED_SECONDS = 3;

export const AUTO_STEPS = [
  'Enquiry parsed',
  'Calendar checked',
  'CRM updated',
  'Reply sent, chase scheduled',
];

/** Formats a minute count as an mm:ss clock string, e.g. 7.5 -> "07:30". */
export function formatClock(minutes: number): string {
  const totalSeconds = Math.round(minutes * 60);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

// ---------------------------------------------------------------------------
// DOM wiring
// ---------------------------------------------------------------------------

const TYPE_SPEED_MS = 16;
const STEP_GAP_MS = 140;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function wait(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

// Types text into an element character by character.
// Same pattern as typeLine in typewriter.ts, without the migrating cursor.
function typeInto(el: HTMLElement, text: string): Promise<void> {
  return new Promise((resolve) => {
    let index = 0;
    function next(): void {
      if (index >= text.length) {
        resolve();
        return;
      }
      el.textContent += text[index];
      index += 1;
      window.setTimeout(next, TYPE_SPEED_MS);
    }
    next();
  });
}

export function initRaceDemo(root: HTMLElement): void {
  const playBtn = root.querySelector<HTMLButtonElement>('[data-race-play]');
  const manualList = root.querySelector<HTMLElement>('[data-race-manual-steps]');
  const manualClock = root.querySelector<HTMLElement>('[data-race-manual-clock]');
  const autoList = root.querySelector<HTMLElement>('[data-race-auto-steps]');
  const autoClock = root.querySelector<HTMLElement>('[data-race-auto-clock]');
  if (!playBtn || !manualList || !manualClock || !autoList || !autoClock) return;

  let running = false;
  let runToken = 0;

  function renderEndState(): void {
    manualList!.innerHTML = '';
    MANUAL_STEPS.forEach((step) => {
      const li = document.createElement('li');
      li.className = 'race-step is-done';
      li.textContent = step.text;
      manualList!.appendChild(li);
    });
    manualClock!.textContent = formatClock(TOTAL_MANUAL_MINUTES);

    autoList!.innerHTML = '';
    AUTO_STEPS.forEach((text) => {
      const li = document.createElement('li');
      li.className = 'race-step race-step--auto is-done';
      li.textContent = text;
      autoList!.appendChild(li);
    });
    autoClock!.textContent = `${AUTOMATED_SECONDS.toFixed(1)}s`;
    root.classList.add('is-finished');
  }

  async function runManualSide(token: number): Promise<void> {
    let elapsed = 0;
    for (const step of MANUAL_STEPS) {
      if (token !== runToken) return;
      const li = document.createElement('li');
      li.className = 'race-step';
      manualList!.appendChild(li);

      const startedAt = performance.now();
      const durationMs = step.text.length * TYPE_SPEED_MS + STEP_GAP_MS;
      const startElapsed = elapsed;

      const typing = typeInto(li, step.text);
      const clockTick = (async () => {
        while (performance.now() - startedAt < durationMs) {
          if (token !== runToken) return;
          const progress = Math.min((performance.now() - startedAt) / durationMs, 1);
          manualClock!.textContent = formatClock(startElapsed + step.manualMinutes * progress);
          await wait(50);
        }
      })();

      await Promise.all([typing, clockTick]);
      if (token !== runToken) return;
      li.classList.add('is-done');
      elapsed = startElapsed + step.manualMinutes;
      manualClock!.textContent = formatClock(elapsed);
      await wait(STEP_GAP_MS);
    }
  }

  async function runAutoSide(token: number): Promise<void> {
    const stepGap = (AUTOMATED_SECONDS * 1000) / AUTO_STEPS.length;
    const startedAt = performance.now();

    const clockTick = (async () => {
      while (performance.now() - startedAt < AUTOMATED_SECONDS * 1000) {
        if (token !== runToken) return;
        autoClock!.textContent = `${((performance.now() - startedAt) / 1000).toFixed(1)}s`;
        await wait(50);
      }
      autoClock!.textContent = `${AUTOMATED_SECONDS.toFixed(1)}s`;
    })();

    for (const text of AUTO_STEPS) {
      if (token !== runToken) return;
      await wait(stepGap);
      const li = document.createElement('li');
      li.className = 'race-step race-step--auto is-done';
      li.textContent = text;
      autoList!.appendChild(li);
    }
    await clockTick;
  }

  async function run(): Promise<void> {
    if (running) return;
    running = true;
    runToken += 1;
    const token = runToken;

    root.classList.remove('is-finished');
    manualList!.innerHTML = '';
    autoList!.innerHTML = '';
    manualClock!.textContent = '00:00';
    autoClock!.textContent = '0.0s';
    playBtn!.disabled = true;

    await Promise.all([runManualSide(token), runAutoSide(token)]);

    if (token === runToken) {
      root.classList.add('is-finished');
      playBtn!.textContent = '> Replay the race';
      playBtn!.disabled = false;
    }
    running = false;
  }

  if (prefersReducedMotion()) {
    renderEndState();
    playBtn.hidden = true;
    return;
  }

  playBtn.addEventListener('click', () => {
    void run();
  });
}

export function initRaceDemos(): void {
  document.querySelectorAll<HTMLElement>('[data-race-demo]').forEach(initRaceDemo);
}
```

- [ ] Run `pnpm vitest run src/scripts/race-demo.test.ts`. Expected: all tests pass.
- [ ] Create `src/components/RaceDemo.astro` with exactly:

```astro
---
// RaceDemo.astro
// Split-panel race: manual process vs automated workflow. Self-initialising.
---

<div class="race-demo" data-race-demo>
  <div class="race-head">
    <p class="race-scenario">Scenario: a new lead emails asking for a quote.</p>
    <button type="button" class="race-play" data-race-play>&gt; Run the race</button>
  </div>

  <div class="race-panels">
    <section class="race-panel" aria-label="Manual process">
      <div class="race-bar">
        <span class="race-dot race-dot--red"></span>
        <span class="race-dot race-dot--yellow"></span>
        <span class="race-dot race-dot--green"></span>
        <span class="race-title">manual/you-doing-it</span>
        <span class="race-clock" data-race-manual-clock aria-label="Simulated time spent">00:00</span>
      </div>
      <ol class="race-steps" data-race-manual-steps></ol>
      <p class="race-footnote">Simulated clock. Seven steps, about 22 minutes, every single lead.</p>
    </section>

    <section class="race-panel race-panel--auto" aria-label="Automated process">
      <div class="race-bar">
        <span class="race-dot race-dot--red"></span>
        <span class="race-dot race-dot--yellow"></span>
        <span class="race-dot race-dot--green"></span>
        <span class="race-title">automated/workflow</span>
        <span class="race-clock race-clock--auto" data-race-auto-clock aria-label="Time taken by the workflow">0.0s</span>
      </div>
      <ol class="race-steps" data-race-auto-steps></ol>
      <p class="race-footnote">Same job. The workflow does it in seconds, every time.</p>
    </section>
  </div>
</div>

<style>
  .race-demo {
    display: grid;
    gap: var(--space-4);
  }

  .race-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .race-scenario {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--type-body-sm);
    color: var(--color-text-secondary);
  }

  .race-play {
    min-height: 44px;
    padding: var(--space-3) var(--space-6);
    background: var(--color-green-500);
    color: var(--color-on-accent);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: var(--type-label);
    font-weight: 700;
    transition: background var(--duration-quick) var(--easing-smooth);
  }

  .race-play:hover {
    background: var(--color-green-400);
  }

  .race-play:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .race-panels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-4);
    align-items: stretch;
  }

  .race-panel {
    display: grid;
    grid-template-rows: auto 1fr auto;
    border: 1px solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    background: var(--color-surface-00);
    overflow: hidden;
  }

  .race-panel--auto {
    border-color: color-mix(in srgb, var(--color-green-500) 42%, var(--color-border-subtle));
  }

  .race-bar {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: 38px;
    padding: 0 var(--space-3);
    background: var(--color-surface-02);
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .race-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .race-dot--red { background: var(--color-error); }
  .race-dot--yellow { background: var(--color-warning); }
  .race-dot--green { background: var(--color-success); }

  .race-title {
    margin-left: var(--space-2);
    flex: 1;
    font-family: var(--font-mono);
    font-size: var(--type-caption);
    color: var(--color-text-muted);
  }

  .race-clock {
    font-family: var(--font-mono);
    font-size: var(--type-label);
    font-weight: 700;
    color: var(--color-warning);
    font-variant-numeric: tabular-nums;
  }

  .race-clock--auto {
    color: var(--color-green-500);
  }

  .race-steps {
    display: grid;
    align-content: start;
    gap: var(--space-2);
    min-height: 260px;
    margin: 0;
    padding: var(--space-4);
    list-style: none;
  }

  :global(.race-step) {
    font-family: var(--font-mono);
    font-size: var(--type-body-sm);
    color: var(--color-text-secondary);
    line-height: 1.5;
    padding-left: var(--space-4);
    position: relative;
  }

  :global(.race-step)::before {
    content: '·';
    position: absolute;
    left: 0;
    color: var(--color-text-muted);
  }

  :global(.race-step.is-done)::before {
    content: '✓';
    color: var(--color-green-500);
  }

  :global(.race-step--auto) {
    color: var(--color-text-primary);
  }

  .race-footnote {
    margin: 0;
    padding: var(--space-3) var(--space-4);
    border-top: 1px solid var(--color-border-subtle);
    font-family: var(--font-mono);
    font-size: var(--type-caption);
    color: var(--color-text-muted);
  }

  @media (max-width: 768px) {
    .race-panels {
      grid-template-columns: 1fr;
    }

    .race-steps {
      min-height: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .race-play {
      transition: none;
    }
  }
</style>

<script>
  import { initRaceDemos } from '../scripts/race-demo.ts';

  initRaceDemos();
</script>
```

- [ ] In `src/pages/services/automation.astro`, add the frontmatter import next to the Task 2 import:

```astro
import RaceDemo from '../../components/RaceDemo.astro';
```

- [ ] Insert this section directly after the closing `</section>` of the `#roi` section added in Task 2:

```astro
    <section class="section-block" id="race">
      <div class="container">
        <div class="section-header" data-reveal>
          <p class="section-tag">$ time manual vs automated</p>
          <h2>Manual vs automated. Same job.</h2>
          <p>Seven steps a human does every time a lead comes in, against one workflow.</p>
        </div>
        <div data-reveal>
          <RaceDemo />
        </div>
      </div>
    </section>
```

- [ ] Run `pnpm build`. Expected: success. Then verify:

```bash
grep -c 'data-race-demo' .vercel/output/static/services/automation/index.html   # expect: 1
grep -c 'Run the race' .vercel/output/static/services/automation/index.html     # expect: 1
```

- [ ] Commit:

```bash
git add src/scripts/race-demo.ts src/scripts/race-demo.test.ts src/components/RaceDemo.astro src/pages/services/automation.astro
git commit -m "Add before/after race demo to automation page

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Homepage ROI (#roi) and race sections

**Files:**
- Modify: `src/pages/index.astro` (frontmatter imports lines 1-8; insert two sections between the services section closing `</section>` at line 450 and the `<!-- ===== WHO WE WORK WITH ===== -->` comment at line 452; extend the z-index selector list at lines 739-748; add section padding styles)

**Interfaces:**
- Consumes: `<RoiCalculator />`, `<RaceDemo />` (self-initialising components from Tasks 2-3)

NOTE: `src/pages/index.astro` is heavily edited by Plan 4 (hero, service cards, proof strip). Keep this edit strictly to: two imports, two inserted sections, one selector-list extension, one small style block. Do not touch the hero, service cards, FAQ, or schema.

- [ ] Add imports to the frontmatter after line 6 (`import BlogCard ...`):

```astro
import RoiCalculator from '../components/RoiCalculator.astro';
import RaceDemo from '../components/RaceDemo.astro';
```

- [ ] Insert between the services `</section>` (line 450) and the `<!-- ===== WHO WE WORK WITH ===== -->` comment:

```astro
  <!-- ===== ROI CALCULATOR ===== -->
  <section class="roi-section" id="roi">
    <div class="container">
      <div class="section-header" data-reveal>
        <span class="section-tag">the maths</span>
        <h2>What is the manual work costing you?</h2>
        <p>Drag the sliders. The assumption is on screen, not hidden in a footnote.</p>
      </div>
      <div data-reveal>
        <RoiCalculator />
      </div>
    </div>
  </section>

  <!-- ===== BEFORE / AFTER RACE ===== -->
  <section class="race-section" id="race">
    <div class="container">
      <div class="section-header" data-reveal>
        <span class="section-tag">the race</span>
        <h2>Manual vs automated. Same job.</h2>
        <p>Seven steps a human does every time a lead comes in, against one workflow.</p>
      </div>
      <div data-reveal>
        <RaceDemo />
      </div>
    </div>
  </section>
```

- [ ] In the `<style>` block, extend the z-index selector list (currently lines 740-748) so the new sections sit above the fixed starfield overlays. Change:

```css
  .section-divider,
  .services,
  .audience,
  .about-section,
  .faq,
  .final-cta {
    position: relative;
    z-index: 2;
  }
```

to:

```css
  .section-divider,
  .services,
  .roi-section,
  .race-section,
  .audience,
  .about-section,
  .faq,
  .final-cta {
    position: relative;
    z-index: 2;
  }
```

- [ ] Add padding rules immediately after the `.services { padding: ... }` rule (around line 970):

```css
  .roi-section,
  .race-section {
    padding: clamp(40px, 6vw, 64px) 0;
  }
```

- [ ] Run `pnpm build`. Expected: success. Verify:

```bash
grep -c 'id="roi"' .vercel/output/static/index.html          # expect: 1
grep -c 'data-race-demo' .vercel/output/static/index.html    # expect: 1
grep -c 'data-roi-calculator' .vercel/output/static/index.html  # expect: 1
```

- [ ] Commit:

```bash
git add src/pages/index.astro
git commit -m "Add ROI calculator and race demo sections to homepage

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Industry switcher on the automation demo

**Files:**
- Modify: `src/scripts/automation-demo.ts` (add `INDUSTRIES` data map, `applyIndustry`, button wiring inside `initOneAutomationDemo` at lines 77-207)
- Modify: `src/pages/services/automation.astro` (add industry buttons inside `.automation-demo` after the `.graph-topline` div at lines 120-124; add button styles)
- Test: `src/scripts/automation-demo.test.ts`

**Interfaces:**
- Produces: `INDUSTRIES: Record<IndustryKey, Industry>`, `NODE_KEYS` (exported for tests)
- Engine logic (`runSequence`, `animateEdge`, tooltip) unchanged; only node labels/status/config strings swap.

- [ ] Write the failing test at `src/scripts/automation-demo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { INDUSTRIES, NODE_KEYS } from './automation-demo';

describe('INDUSTRIES data map', () => {
  it('defines exactly four industries', () => {
    expect(Object.keys(INDUSTRIES).sort()).toEqual(['agency', 'clinic', 'ecommerce', 'trades']);
    expect(Object.values(INDUSTRIES).map((i) => i.name).sort()).toEqual([
      'Agency',
      'Clinic',
      'E-commerce',
      'Trades',
    ]);
  });

  it('defines every node for every industry', () => {
    Object.values(INDUSTRIES).forEach((industry) => {
      expect(industry.flow.length).toBeGreaterThan(0);
      expect(industry.title.length).toBeGreaterThan(0);
      NODE_KEYS.forEach((key) => {
        const node = industry.nodes[key];
        expect(node.label.length).toBeGreaterThan(0);
        expect(node.icon.length).toBeGreaterThan(0);
        expect(node.status.length).toBeGreaterThan(0);
        expect(node.configTitle.length).toBeGreaterThan(0);
        expect(node.config.length).toBeGreaterThan(0);
      });
    });
  });

  it('tells the trades story from the spec', () => {
    const trades = INDUSTRIES.trades;
    expect(trades.nodes.email.label).toBe('Quote request');
    expect(trades.nodes.claude.label).toBe('AI drafts estimate');
    expect(trades.nodes.notion.label).toBe('Job booked');
    expect(trades.nodes.slack.label).toBe('Invoice sent');
  });

  it('contains no em dashes', () => {
    expect(JSON.stringify(INDUSTRIES)).not.toMatch(/—/);
  });
});
```

- [ ] Run `pnpm vitest run src/scripts/automation-demo.test.ts`. Expected failure: `INDUSTRIES` is not exported.
- [ ] In `src/scripts/automation-demo.ts`, add the data map and helpers directly after the `clamp` function (line 18):

```ts
// ─── Industry data map ───────────────────────────────────────────────────────
// Swaps node labels, status lines, and tooltip config strings.
// The animation engine (edges, particles, sequence) is untouched.

export const NODE_KEYS = ['email', 'claude', 'notion', 'slack'] as const;
export type NodeKey = (typeof NODE_KEYS)[number];

export interface IndustryNode {
  label: string;
  icon: string;
  status: string;
  configTitle: string;
  config: string;
}

export interface Industry {
  name: string;
  flow: string;
  title: string;
  nodes: Record<NodeKey, IndustryNode>;
}

export type IndustryKey = 'trades' | 'agency' | 'ecommerce' | 'clinic';

export const INDUSTRIES: Record<IndustryKey, Industry> = {
  trades: {
    name: 'Trades',
    flow: 'n8n run trades-flow',
    title:
      'Quote request received, AI drafts the estimate, then the job is booked in the calendar and the invoice is sent.',
    nodes: {
      email: {
        label: 'Quote request',
        icon: 'WhatsApp',
        status: 'received: new quote request',
        configTitle: 'Quote request trigger',
        config:
          'trigger: new WhatsApp or form message · filter: contains job details · payload: name, job, photos',
      },
      claude: {
        label: 'AI drafts estimate',
        icon: 'Claude',
        status: 'drafted: estimate ready',
        configTitle: 'AI drafts estimate',
        config:
          'model: claude · inputs: job description, your price list · output: itemised estimate for approval',
      },
      notion: {
        label: 'Job booked',
        icon: 'Calendar',
        status: 'booked: Tuesday 09:00',
        configTitle: 'Job booked in calendar',
        config: 'calendar: jobs diary · action: create booking · notify: customer confirmation text',
      },
      slack: {
        label: 'Invoice sent',
        icon: 'Xero',
        status: 'sent: invoice #204',
        configTitle: 'Invoice sent',
        config: 'ledger: Xero · action: draft and send invoice · terms: 14 days · reminder: auto chase',
      },
    },
  },
  agency: {
    name: 'Agency',
    flow: 'n8n run agency-flow',
    title:
      'A client brief lands, AI summarises it, then a task is created and a reply is drafted for review.',
    nodes: {
      email: {
        label: 'Brief lands',
        icon: 'Gmail',
        status: 'received: client brief',
        configTitle: 'Brief trigger',
        config: 'trigger: new email from a client domain · payload: brief, attachments, deadline',
      },
      claude: {
        label: 'AI summarises',
        icon: 'Claude',
        status: 'summarised: scope + deadline',
        configTitle: 'AI summarises brief',
        config: 'model: claude · output: scope summary, deadline, flagged gaps · tone: internal shorthand',
      },
      notion: {
        label: 'Task created',
        icon: 'Notion',
        status: 'created: task in sprint',
        configTitle: 'Task created',
        config: 'database: client work · fields: client, scope, owner, due date · action: create task',
      },
      slack: {
        label: 'Reply drafted',
        icon: 'Gmail',
        status: 'drafted: reply for review',
        configTitle: 'Reply drafted',
        config: 'draft: confirmation with timeline · state: saved to drafts · a human approves before send',
      },
    },
  },
  ecommerce: {
    name: 'E-commerce',
    flow: 'n8n run ecommerce-flow',
    title:
      'An order query arrives, AI classifies it, then the order is updated and the customer gets a reply.',
    nodes: {
      email: {
        label: 'Order query',
        icon: 'Email',
        status: 'received: where is my order',
        configTitle: 'Order query trigger',
        config: 'trigger: new support email · lookup: order number, courier status · payload: customer history',
      },
      claude: {
        label: 'AI classifies',
        icon: 'Claude',
        status: 'classified: delivery query',
        configTitle: 'AI classifies query',
        config: 'model: claude · classes: delivery, refund, exchange, other · escalate: anything ambiguous',
      },
      notion: {
        label: 'Order updated',
        icon: 'Shopify',
        status: 'updated: order #1182',
        configTitle: 'Order updated',
        config: 'store: Shopify · action: log query against the order · tag: delivery question',
      },
      slack: {
        label: 'Reply sent',
        icon: 'Email',
        status: 'sent: tracking link shared',
        configTitle: 'Reply sent',
        config: 'reply: courier status + tracking link · tone: brand voice · fallback: route to a human',
      },
    },
  },
  clinic: {
    name: 'Clinic',
    flow: 'n8n run clinic-flow',
    title:
      'A booking request arrives, AI checks the diary, then the appointment is booked and a reminder is scheduled.',
    nodes: {
      email: {
        label: 'Booking request',
        icon: 'Form',
        status: 'received: new patient request',
        configTitle: 'Booking request trigger',
        config: 'trigger: website form or voicemail transcript · payload: name, preferred times, reason',
      },
      claude: {
        label: 'AI checks diary',
        icon: 'Claude',
        status: 'matched: two open slots',
        configTitle: 'AI checks diary',
        config: 'model: claude · inputs: practitioner diaries, appointment type · output: best slot options',
      },
      notion: {
        label: 'Appointment booked',
        icon: 'Calendar',
        status: 'booked: Thu 14:30',
        configTitle: 'Appointment booked',
        config: 'calendar: clinic diary · action: create appointment · notify: front desk',
      },
      slack: {
        label: 'Reminder scheduled',
        icon: 'SMS',
        status: 'scheduled: 24h reminder',
        configTitle: 'Reminder scheduled',
        config: 'channel: SMS · schedule: 24 hours before · include: reschedule link',
      },
    },
  },
};

function applyIndustry(root: HTMLElement, industry: Industry): void {
  NODE_KEYS.forEach((key) => {
    const node = root.querySelector<SVGGElement>(`[data-automation-node="${key}"]`);
    if (!node) return;
    const data = industry.nodes[key];
    const label = node.querySelector<SVGTextElement>('.node-label');
    const icon = node.querySelector<SVGTextElement>('.node-icon');
    const status = node.querySelector<SVGTextElement>('.node-status');
    if (label) label.textContent = data.label;
    if (icon) icon.textContent = data.icon;
    if (status) status.textContent = data.status;
    node.dataset['configTitle'] = data.configTitle;
    node.dataset['config'] = data.config;
  });

  const topline = root.querySelector<HTMLElement>('.graph-topline span');
  if (topline) topline.textContent = `$ ${industry.flow}`;

  const svgTitle = root.querySelector<SVGTitleElement>('#automation-title');
  if (svgTitle) svgTitle.textContent = industry.title;
}
```

- [ ] Inside `initOneAutomationDemo`, after the existing `runAgain?.addEventListener(...)` block (currently lines 178-180) and before `initTooltip(root);`, add the button wiring:

```ts
  root.querySelectorAll<HTMLButtonElement>('[data-automation-industry]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset['automationIndustry'] as IndustryKey | undefined;
      const industry = key ? INDUSTRIES[key] : undefined;
      if (!industry) return;

      root.querySelectorAll<HTMLButtonElement>('[data-automation-industry]').forEach((b) => {
        b.setAttribute('aria-pressed', String(b === button));
        b.classList.toggle('is-active', b === button);
      });

      applyIndustry(root, industry);
      hasBooted = true;
      runSequence();
    });
  });
```

- [ ] In `src/pages/services/automation.astro`, insert the button row inside `.automation-demo`, directly after the closing `</div>` of `.graph-topline` (line 124):

```astro
          <div class="industry-row" role="group" aria-label="Show this workflow for an industry">
            <span class="industry-label">show it for:</span>
            <button type="button" class="industry-btn" data-automation-industry="trades" aria-pressed="false">Trades</button>
            <button type="button" class="industry-btn" data-automation-industry="agency" aria-pressed="false">Agency</button>
            <button type="button" class="industry-btn" data-automation-industry="ecommerce" aria-pressed="false">E-commerce</button>
            <button type="button" class="industry-btn" data-automation-industry="clinic" aria-pressed="false">Clinic</button>
          </div>
```

- [ ] Add styles to the page `<style>` block, after the `.graph-topline span, .graph-hint` rule (around line 519):

```css
  .industry-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .industry-label {
    font-family: var(--font-mono);
    font-size: var(--type-caption);
    color: var(--color-text-muted);
  }

  .industry-btn {
    padding: var(--space-1) var(--space-3);
    border: 1px solid var(--color-border-muted);
    border-radius: var(--radius-sm);
    background: var(--color-surface-01);
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
    font-size: var(--type-caption);
    transition:
      color var(--duration-quick) var(--easing-smooth),
      border-color var(--duration-quick) var(--easing-smooth);
  }

  .industry-btn:hover {
    color: var(--color-text-primary);
    border-color: var(--color-border-visible);
  }

  .industry-btn.is-active,
  .industry-btn[aria-pressed='true'] {
    color: var(--color-green-500);
    border-color: var(--color-green-500);
  }

  @media (prefers-reduced-motion: reduce) {
    .industry-btn {
      transition: none;
    }
  }
```

- [ ] Run `pnpm vitest run src/scripts/automation-demo.test.ts`. Expected: all tests pass.
- [ ] Run `pnpm build`. Expected: success. Verify:

```bash
grep -o 'data-automation-industry' .vercel/output/static/services/automation/index.html | wc -l   # expect: 4
```

- [ ] Commit:

```bash
git add src/scripts/automation-demo.ts src/scripts/automation-demo.test.ts src/pages/services/automation.astro
git commit -m "Add industry switcher to automation demo

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Extract shared terminal engine, refactor terminal.ts

**Files:**
- Create: `src/scripts/terminal-engine.ts`
- Modify: `src/scripts/terminal.ts` (full rewrite of everything below the command bodies; command output strings stay byte-identical)
- Test: `src/scripts/terminal.test.ts`

**Interfaces:**
- Produces: `createTerminal(config)` and `AutoplayLine` exactly per the shared contract, plus exported helpers `dispatchCommand(commands, input): string[]`, `L`, `escapeHtml`, and types `CommandFn`, `TerminalHandle`, `TerminalConfig`
- Consumes: existing DOM (`#interactiveTerminal` with child `.terminal-output`, `.terminal-input`, `.terminal-ghost` in `src/pages/index.astro` lines 497-525); `window.__openChatDrawer` from chat-drawer.ts

Behaviour must be identical: same boot lines and delays (180ms/80ms blank), same tab completion, same history, same `clear` handling (no echo), same fade rendering (12ms per line), same post-boot ghost `help`.

- [ ] Write the failing snapshot test at `src/scripts/terminal.test.ts`. These arrays are the EXACT current outputs of `processCommand` in `src/scripts/terminal.ts` (lines 79-171 as of this plan), locking the refactor to identical behaviour:

```ts
import { describe, expect, it } from 'vitest';
import { dispatchCommand } from './terminal-engine';
import { COMMANDS } from './terminal';

describe('homepage terminal commands (refactor invariance)', () => {
  it('renders status exactly as before the refactor', () => {
    expect(dispatchCommand(COMMANDS, 'status')).toEqual([
      '<span class="t-muted">&gt; checking systems...</span> <span class="t-green">✓</span>',
      '',
      '<span class="t-muted">  founder:</span>        Charlie W',
      '<span class="t-muted">  location:</span>        London, UK',
      '<span class="t-muted">  status:</span>          <span class="t-green">[● ACTIVE]</span>',
      '<span class="t-muted">  specialty:</span>       AI systems + automation',
      '<span class="t-muted">  clients served:</span>  40+',
      '<span class="t-muted">  current load:</span>    accepting new clients',
      '',
      '<span class="t-pink">→ run "book" to get started</span>',
    ]);
  });

  it('renders stack exactly as before the refactor', () => {
    expect(dispatchCommand(COMMANDS, 'stack')).toEqual([
      '<span class="t-green">CAMBER CO STACK</span>',
      '',
      '<span class="t-muted">  automation:</span>  n8n, Make, Zapier',
      '<span class="t-muted">  ai/ml:</span>       OpenAI, Anthropic, local LLMs',
      '<span class="t-muted">  platforms:</span>   WhatsApp, Slack, Discord, Telegram',
      '<span class="t-muted">  infra:</span>       Cloudflare, PostgreSQL, serverless',
      '<span class="t-muted">  frontend:</span>    Astro, vanilla JS',
      '<span class="t-muted">  languages:</span>   TypeScript, Python',
      '',
      '<span class="t-muted">"use the right tool, not the shiny one"</span>',
    ]);
  });

  it('renders contact exactly as before the refactor', () => {
    expect(dispatchCommand(COMMANDS, 'contact')).toEqual([
      '<span class="t-green">GET IN TOUCH</span>',
      '',
      '<span class="t-muted">  email:</span>     hello@camberco.co.uk',
      '<span class="t-muted">  form:</span>      camberco.co.uk/contact',
      '<span class="t-muted">  web:</span>       camberco.co.uk',
      '',
      '<span class="t-pink">→ get in touch — no commitment</span>',
    ]);
  });

  it('reports unknown commands with the same message', () => {
    expect(dispatchCommand(COMMANDS, 'frobnicate')).toEqual([
      '<span class="t-muted">command not found: frobnicate. type "help" for available commands.</span>',
    ]);
  });

  it('keeps help discoverable', () => {
    const help = dispatchCommand(COMMANDS, 'help').join('\n');
    expect(help).toContain('available commands');
    expect(help).toContain('book');
    expect(help).toContain('explore');
  });

  it('escapes HTML in unknown command names', () => {
    expect(dispatchCommand(COMMANDS, '<img>')).toEqual([
      '<span class="t-muted">command not found: &lt;img&gt;. type "help" for available commands.</span>',
    ]);
  });
});
```

- [ ] Run `pnpm vitest run src/scripts/terminal.test.ts`. Expected failure: cannot resolve `./terminal-engine` (and `COMMANDS` not exported).
- [ ] Create `src/scripts/terminal-engine.ts` with exactly:

```ts
// src/scripts/terminal-engine.ts
// Shared interactive terminal engine for the homepage terminal (terminal.ts)
// and the /about-me terminal (about-terminal.ts).
// Owns: element lookup, boot sequence, input handling, history, tab
// completion, ghost suggestions, output rendering, and scripted autoplay.

export type AutoplayLine = { type: 'command' | 'output'; text: string; delayMs?: number };

export type CommandFn = (args: string[]) => string | string[];

export interface TerminalConfig {
  root: HTMLElement;
  commands: Record<string, CommandFn>;
  bootLines?: string[];
  promptLabel?: string;
  /** Completion candidates. Defaults to the command names. */
  completions?: string[];
  /** IntersectionObserver threshold for booting (default 0.3). */
  observeThreshold?: number;
  /** Delay between boot lines in ms; blank lines always use 80 (default 180). */
  bootLineDelayMs?: number;
}

export interface TerminalHandle {
  run(cmd: string): void;
  autoplay(script: AutoplayLine[]): Promise<void>;
  destroy(): void;
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Line helper — tagged template that splits on newlines and auto-dedents.
export function L(strings: TemplateStringsArray, ...values: string[]): string[] {
  let result = '';
  strings.forEach((str, i) => {
    result += str + (values[i] ?? '');
  });
  const lines = result.split('\n');
  if (lines[0].trim() === '') lines.shift();
  if (lines[lines.length - 1]?.trim() === '') lines.pop();
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const match = line.match(/^( *)/);
    if (match && match[1].length < minIndent) {
      minIndent = match[1].length;
    }
  }
  if (minIndent === Infinity) minIndent = 0;
  return lines.map((l) => l.slice(minIndent));
}

/** Pure command dispatch. Exported so command registries can be unit tested. */
export function dispatchCommand(commands: Record<string, CommandFn>, input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const parts = trimmed.split(/\s+/);
  const cmdName = parts[0].toLowerCase();
  const args = parts.slice(1);

  const cmd = commands[cmdName];
  if (!cmd) {
    return [
      `<span class="t-muted">command not found: ${escapeHtml(cmdName)}. type "help" for available commands.</span>`,
    ];
  }

  const out = cmd(args);
  return Array.isArray(out) ? out : [out];
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function wait(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function createTerminal(config: TerminalConfig): TerminalHandle {
  const {
    root,
    commands,
    bootLines = [],
    promptLabel = '$',
    observeThreshold = 0.3,
    bootLineDelayMs = 180,
  } = config;

  const output = root.querySelector<HTMLElement>('.terminal-output');
  const input = root.querySelector<HTMLInputElement>('.terminal-input');
  const ghost = root.querySelector<HTMLElement>('.terminal-ghost');

  if (!output || !input || !ghost) {
    return { run: () => {}, autoplay: () => Promise.resolve(), destroy: () => {} };
  }

  const completions = config.completions ?? Object.keys(commands);

  const history: string[] = [];
  let historyIndex = -1;
  let booted = false;
  let busy = false;
  let destroyed = false;

  function getCompletion(partial: string): string | null {
    if (!partial) return null;
    const lower = partial.toLowerCase();
    return completions.find((c) => c.startsWith(lower) && c !== lower) ?? null;
  }

  function updateGhost(): void {
    const val = input!.value;
    const completion = getCompletion(val);
    if (completion && val.length > 0) {
      ghost!.textContent = completion;
      ghost!.style.display = '';
    } else {
      ghost!.textContent = '';
      ghost!.style.display = 'none';
    }
  }

  async function typewriteLines(target: HTMLElement, lines: string[], speed = 8): Promise<void> {
    const reducedMotion = prefersReducedMotion();

    for (const line of lines) {
      const div = document.createElement('div');
      div.className = 'tl';
      target.appendChild(div);

      if (reducedMotion || speed <= 0) {
        div.innerHTML = line || '&nbsp;';
      } else {
        div.innerHTML = line || '&nbsp;';
        div.classList.add('tl-fadein');
        await wait(speed);
      }

      output!.scrollTop = output!.scrollHeight;
    }
  }

  function appendCmdEcho(cmdText: string): HTMLSpanElement {
    const cmdLine = document.createElement('div');
    cmdLine.className = 'tl tl-cmd';
    const promptSpan = document.createElement('span');
    promptSpan.className = 't-prompt';
    promptSpan.textContent = `${promptLabel} `;
    const cmdSpan = document.createElement('span');
    cmdSpan.textContent = cmdText;
    cmdLine.appendChild(promptSpan);
    cmdLine.appendChild(cmdSpan);
    output!.appendChild(cmdLine);
    output!.scrollTop = output!.scrollHeight;
    return cmdSpan;
  }

  function appendSpacer(): void {
    const spacer = document.createElement('div');
    spacer.className = 'tl-spacer';
    output!.appendChild(spacer);
    output!.scrollTop = output!.scrollHeight;
  }

  async function runAndRender(cmdText: string, animate = true): Promise<void> {
    appendCmdEcho(cmdText);

    const lines = dispatchCommand(commands, cmdText);
    if (lines.length > 0) {
      const block = document.createElement('div');
      block.className = 'tl-block';
      output!.appendChild(block);
      await typewriteLines(block, lines, animate ? 12 : 0);
    }

    appendSpacer();
  }

  async function execute(cmd: string): Promise<void> {
    if (cmd.toLowerCase() === 'clear') {
      output!.innerHTML = '';
    } else {
      await runAndRender(cmd, true);
    }
  }

  async function bootSequence(): Promise<void> {
    const reducedMotion = prefersReducedMotion();
    for (const line of bootLines) {
      const div = document.createElement('div');
      div.className = 'tl tl-boot';
      div.innerHTML = line || '&nbsp;';
      output!.appendChild(div);
      output!.scrollTop = output!.scrollHeight;
      if (!reducedMotion) await wait(line === '' ? 80 : bootLineDelayMs);
    }
  }

  async function onKeydown(e: KeyboardEvent): Promise<void> {
    if (e.key === 'Tab') {
      e.preventDefault();
      const completion = getCompletion(input!.value);
      if (completion) {
        input!.value = completion;
        updateGhost();
      }
      return;
    }

    if (e.key === 'Enter') {
      if (busy) return;
      const cmd = input!.value.trim();
      if (!cmd) return;

      busy = true;
      history.push(cmd);
      historyIndex = history.length;
      input!.value = '';
      ghost!.textContent = '';
      ghost!.style.display = 'none';

      await execute(cmd);

      busy = false;
      input!.focus();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        input!.value = history[historyIndex];
        updateGhost();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        historyIndex++;
        input!.value = history[historyIndex];
      } else {
        historyIndex = history.length;
        input!.value = '';
      }
      updateGhost();
      return;
    }
  }

  function onRootClick(): void {
    if (!busy) input!.focus();
  }

  input.addEventListener('input', updateGhost);
  input.addEventListener('keydown', onKeydown);
  root.addEventListener('click', onRootClick);

  const observer = new IntersectionObserver(
    async (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || booted) continue;
        booted = true;
        observer.unobserve(root);

        busy = true;
        await bootSequence();
        busy = false;

        input!.placeholder = '';
        ghost!.textContent = 'help';
        ghost!.style.display = '';
      }
    },
    { threshold: observeThreshold },
  );

  observer.observe(root);

  return {
    run(cmd: string): void {
      if (busy || destroyed) return;
      busy = true;
      void execute(cmd).then(() => {
        busy = false;
      });
    },

    async autoplay(script: AutoplayLine[]): Promise<void> {
      if (busy || destroyed) return;
      busy = true;
      const reducedMotion = prefersReducedMotion();

      for (const line of script) {
        if (destroyed) break;

        if (line.type === 'command') {
          const cmdSpan = appendCmdEcho('');
          if (reducedMotion) {
            cmdSpan.textContent = line.text;
          } else {
            for (const char of line.text) {
              cmdSpan.textContent += char;
              await wait(38);
            }
          }
          output!.scrollTop = output!.scrollHeight;
          if (!reducedMotion) await wait(line.delayMs ?? 260);
        } else {
          const div = document.createElement('div');
          div.className = 'tl';
          div.innerHTML = line.text || '&nbsp;';
          if (!reducedMotion) div.classList.add('tl-fadein');
          output!.appendChild(div);
          output!.scrollTop = output!.scrollHeight;
          if (!reducedMotion) await wait(line.delayMs ?? 350);
        }
      }

      appendSpacer();
      busy = false;
    },

    destroy(): void {
      destroyed = true;
      input!.removeEventListener('input', updateGhost);
      input!.removeEventListener('keydown', onKeydown);
      root.removeEventListener('click', onRootClick);
      observer.disconnect();
    },
  };
}
```

- [ ] Rewrite `src/scripts/terminal.ts`. KEEP the file header comment, `PUBLIC_COMMANDS`, `ALL_COMPLETIONS`, and every command's output strings byte-identical (copy the bodies of `help`, `status`, `about`, `services`, `explore`, `stack`, `contact`, `book`, `clear`, and all easter eggs from the current file, lines 59-285). Changes:
  1. Replace the local `escapeHtml` and `L` definitions (lines 17-42) with `import { createTerminal, L, escapeHtml } from './terminal-engine'; import type { CommandFn } from './terminal-engine';` (keep the existing `import type { ServiceKey } from './chat-prompts';` and the `declare global` block).
  2. Flatten the registry: the `Command` interface (`{ description, run }`) is deleted; `COMMANDS` becomes `export const COMMANDS: Record<string, CommandFn> = { ... }` where each entry is the former `run` function directly (descriptions were never read). Example of the mechanical change:

```ts
// before
help: { description: 'list available commands', run: () => L`...` },
// after
help: () => L`...`,
```

  3. Export the completions list: `export const ALL_COMPLETIONS = [...]` (same contents).
  4. Extract the boot lines (current lines 380-387) into a module constant:

```ts
const BOOT_LINES = [
  '<span class="t-muted">camber-os v2.0.0</span>',
  '<span class="t-muted">connecting to London node...</span> <span class="t-green">connected</span>',
  '<span class="t-muted">loading services...</span> <span class="t-green">6 active</span>',
  '',
  '<span class="t-green">system ready.</span> type <span class="t-pink">help</span> to begin.',
  '',
];
```

  5. Delete `processCommand`, `getCompletion`, `typewriteLines`, `runAndRender`, `bootSequence` and the whole body of `initTerminal` (lines 288-516). Replace `initTerminal` with:

```ts
export function initTerminal(): void {
  const root = document.getElementById('interactiveTerminal');
  if (!root) return;

  createTerminal({
    root,
    commands: COMMANDS,
    completions: ALL_COMPLETIONS,
    bootLines: BOOT_LINES,
    promptLabel: '$',
    observeThreshold: 0.3,
    bootLineDelayMs: 180,
  });
}
```

- [ ] Run `pnpm vitest run src/scripts/terminal.test.ts`. Expected: all 6 tests pass.
- [ ] Run `pnpm build`. Expected: success (index.astro's `initTerminal()` import is unchanged).
- [ ] Manual spot check (optional but recommended): `pnpm dev`, open `http://localhost:4321/`, scroll to the terminal, confirm boot lines type in, `help` tab-completes, `status` renders, `clear` clears.
- [ ] Commit:

```bash
git add src/scripts/terminal-engine.ts src/scripts/terminal.ts src/scripts/terminal.test.ts
git commit -m "Extract shared terminal engine, refactor homepage terminal

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Refactor about-terminal.ts onto the engine

**Files:**
- Modify: `src/scripts/about-terminal.ts` (same shape of refactor as Task 6; command outputs byte-identical)
- Test: `src/scripts/about-terminal.test.ts`

**Interfaces:**
- Consumes: `createTerminal`, `dispatchCommand`, `L`, `escapeHtml`, `CommandFn` from `src/scripts/terminal-engine.ts`
- Produces: `COMMANDS` export (about registry), `initAboutTerminal(): void` (name unchanged; `src/pages/about-me.astro` line 1778 keeps working)

- [ ] Write the failing test at `src/scripts/about-terminal.test.ts` (exact outputs of `links` after Plan 4's email fix, which changes cw5790@gmail.com to hello@camberco.co.uk in `src/scripts/about-terminal.ts`, not the lines 160-172 as of this plan):

```ts
import { describe, expect, it } from 'vitest';
import { dispatchCommand } from './terminal-engine';
import { COMMANDS } from './about-terminal';

describe('about terminal commands (refactor invariance)', () => {
  it('renders links exactly as before the refactor', () => {
    expect(dispatchCommand(COMMANDS, 'links')).toEqual([
      '<span class="t-green">FIND ME</span>',
      '',
      '  <span class="t-muted">linkedin:</span>  <span class="t-green">linkedin.com/in/charlie-waite</span>',
      '  <span class="t-muted">github:</span>    <span class="t-green">github.com/charliearlie</span>',
      '  <span class="t-muted">email:</span>     <span class="t-green">hello@camberco.co.uk</span>',
      '  <span class="t-muted">work:</span>      <span class="t-green">hello@camberco.co.uk</span>',
      '',
      '<span class="t-pink">→ run "contact" to send a message</span>',
    ]);
  });

  it('keeps whoami identity intact', () => {
    const out = dispatchCommand(COMMANDS, 'whoami').join('\n');
    expect(out).toContain('Charlie Waite');
    expect(out).toContain('Camber Co');
  });

  it('handles sudo hire-me', () => {
    expect(dispatchCommand(COMMANDS, 'sudo hire-me')).toEqual([
      '<span class="t-pink">[sudo] password for charlie:</span>',
      '<span class="t-green">authenticated.</span> redirecting to /contact...',
    ]);
  });

  it('reports unknown commands with the same message', () => {
    expect(dispatchCommand(COMMANDS, 'nope')).toEqual([
      '<span class="t-muted">command not found: nope. type "help" for available commands.</span>',
    ]);
  });
});
```

- [ ] Run `pnpm vitest run src/scripts/about-terminal.test.ts`. Expected failure: `COMMANDS` not exported.
- [ ] Refactor `src/scripts/about-terminal.ts`:
  1. Replace local `escapeHtml` and `L` (lines 9-31) with `import { createTerminal, L, escapeHtml } from './terminal-engine'; import type { CommandFn } from './terminal-engine';`. Keep `scrollToId` (lines 33-38) as-is.
  2. Flatten the `Command` registry to `export const COMMANDS: Record<string, CommandFn> = { ... }` (same mechanical change as Task 6; every output string stays byte-identical, including all easter eggs, `git`, `vim`, `:wq`, `:q`, `:q!`, `cat README.md`).
  3. Extract the boot lines (current lines 444-455) into `const BOOT_LINES = [...]` verbatim.
  4. Delete `processCommand`, `getCompletion`, `typewriteLines`, `runAndRender`, `bootSequence` and the body of `initAboutTerminal` (lines 361-578). Replace with:

```ts
export function initAboutTerminal(): void {
  const root = document.getElementById('aboutTerminal');
  if (!root) return;

  createTerminal({
    root,
    commands: COMMANDS,
    completions: ALL_COMPLETIONS,
    bootLines: BOOT_LINES,
    promptLabel: '$',
    observeThreshold: 0.2,
    bootLineDelayMs: 160,
  });
}
```

  (Keep `PUBLIC_COMMANDS` and `ALL_COMPLETIONS` with identical contents; export `ALL_COMPLETIONS` is optional, module-local is fine.)
- [ ] Run `pnpm vitest run src/scripts/about-terminal.test.ts`. Expected: all 4 tests pass.
- [ ] Run `pnpm vitest run` (whole suite). Expected: everything passes.
- [ ] Run `pnpm build`. Expected: success.
- [ ] Confirm the duplication is gone: `grep -c 'function typewriteLines' src/scripts/*.ts` should report the function in `terminal-engine.ts` only (as a nested/local function, `grep -rn 'typewriteLines' src/scripts` shows matches only in terminal-engine.ts).
- [ ] Commit:

```bash
git add src/scripts/about-terminal.ts src/scripts/about-terminal.test.ts
git commit -m "Refactor about terminal onto shared engine

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: `demo inbox` autoplay command

**Files:**
- Modify: `src/scripts/terminal.ts` (capture the `TerminalHandle`, add `demo` command + autoplay script, extend completions and help)
- Test: extend `src/scripts/terminal.test.ts`

**Interfaces:**
- Consumes: `TerminalHandle.autoplay(script: AutoplayLine[])` from Task 6
- Produces: `INBOX_DEMO: AutoplayLine[]` export (for tests)

- [ ] Add failing tests to `src/scripts/terminal.test.ts`:

```ts
import { COMMANDS, INBOX_DEMO } from './terminal';   // merge into the existing import

describe('demo inbox', () => {
  it('lists demo inbox in help', () => {
    expect(dispatchCommand(COMMANDS, 'help').join('\n')).toContain('demo inbox');
  });

  it('shows usage for bare demo', () => {
    expect(dispatchCommand(COMMANDS, 'demo')).toEqual([
      '<span class="t-muted">usage:</span> demo <span class="t-green">inbox</span>',
    ]);
  });

  it('acknowledges demo inbox and schedules the replay', () => {
    expect(dispatchCommand(COMMANDS, 'demo inbox')).toEqual([
      '<span class="t-green">launching inbox agent...</span>',
    ]);
  });

  it('tells the triage story without em dashes', () => {
    const all = INBOX_DEMO.map((l) => l.text).join('\n');
    expect(all).toContain('3 new emails');
    expect(all).toContain('invoice logged to Xero');
    expect(all).toContain('reply drafted');
    expect(all).not.toMatch(/—/);
  });
});
```

  Note: `dispatchCommand(COMMANDS, 'demo inbox')` runs in node where `window` exists only if guarded; the implementation below guards `window.setTimeout` behind `typeof window !== 'undefined'` so the test passes in the node environment.
- [ ] Run `pnpm vitest run src/scripts/terminal.test.ts`. Expected failure: `INBOX_DEMO` not exported; `demo` command not found.
- [ ] In `src/scripts/terminal.ts`:
  1. Extend the engine import: `import { createTerminal, L, escapeHtml } from './terminal-engine'; import type { AutoplayLine, CommandFn, TerminalHandle } from './terminal-engine';`
  2. Add module state and the script above `COMMANDS`:

```ts
let handle: TerminalHandle | null = null;

// Scripted replay: an agent triaging email. Typed-out theatre via autoplay.
export const INBOX_DEMO: AutoplayLine[] = [
  { type: 'command', text: 'agent run inbox-triage' },
  { type: 'output', text: '<span class="t-muted">connecting to inbox...</span> <span class="t-green">connected</span>', delayMs: 500 },
  { type: 'output', text: '<span class="t-green">3 new emails</span>', delayMs: 450 },
  { type: 'output', text: '', delayMs: 150 },
  { type: 'output', text: '<span class="t-muted">[1/3]</span> supplier invoice <span class="t-green">→ classified: finance</span>', delayMs: 420 },
  { type: 'output', text: '<span class="t-muted">[2/3]</span> quote request <span class="t-green">→ classified: new lead</span>', delayMs: 420 },
  { type: 'output', text: '<span class="t-muted">[3/3]</span> newsletter <span class="t-muted">→ archived</span>', delayMs: 420 },
  { type: 'output', text: '', delayMs: 150 },
  { type: 'output', text: '<span class="t-green">✓</span> invoice logged to Xero', delayMs: 480 },
  { type: 'output', text: '<span class="t-green">✓</span> reply drafted for the quote request', delayMs: 480 },
  { type: 'output', text: '<span class="t-green">✓</span> follow-up scheduled for Friday', delayMs: 480 },
  { type: 'output', text: '', delayMs: 150 },
  { type: 'output', text: '<span class="t-muted">3 emails handled. none needed a human.</span>', delayMs: 350 },
  { type: 'output', text: '<span class="t-pink">→ this can run on your inbox. type "book".</span>' },
];
```

  3. Add the `demo` command to `COMMANDS` (after `book`):

```ts
  demo: (args) => {
    if ((args[0] || '').toLowerCase() === 'inbox') {
      if (typeof window !== 'undefined') {
        window.setTimeout(() => {
          handle?.autoplay(INBOX_DEMO);
        }, 350);
      }
      return ['<span class="t-green">launching inbox agent...</span>'];
    }
    return ['<span class="t-muted">usage:</span> demo <span class="t-green">inbox</span>'];
  },
```

  4. In the `help` command's template, insert this line between the `book` line and the `clear` line (keep column alignment with two-space gutter):

```
      <span class="t-green">demo inbox</span>        watch an agent clear an inbox
```

  5. Add `'demo inbox'` to `PUBLIC_COMMANDS` (after `'book'`) and `'demo'` to `ALL_COMPLETIONS`.
  6. In `initTerminal`, assign the handle: `handle = createTerminal({ ... });`
- [ ] Run `pnpm vitest run src/scripts/terminal.test.ts`. Expected: all tests pass (including the Task 6 invariance tests except `help`, which now also contains `demo inbox`; the Task 6 help test uses `toContain` so it still passes).
- [ ] Run `pnpm build`. Expected: success.
- [ ] Manual check (optional): `pnpm dev`, type `demo inbox` in the homepage terminal, watch `agent run inbox-triage` type itself and the triage lines appear. With `prefers-reduced-motion` emulated, everything renders instantly.
- [ ] Commit:

```bash
git add src/scripts/terminal.ts src/scripts/terminal.test.ts
git commit -m "Add demo inbox autoplay to homepage terminal

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Move scroll-reveal CSS into tokens.css, delete the injection path

**Files:**
- Modify: `src/styles/tokens.css` (append reveal styles after the reduced-motion block ending at line 224)
- Modify: `src/scripts/scroll-reveal.ts` (delete the `SCROLL_REVEAL_CSS` export, lines 1-19)
- Modify: `src/pages/services/automation.astro` (script block, currently lines 988-1003), `src/pages/services/builds.astro` (lines 1009-1022), `src/pages/services/apps.astro` (lines ~985-1001), `src/pages/services/index.astro` (lines ~476-487), `src/pages/about-me.astro` (lines 1768-1778)

**Interfaces:**
- Consumes: nothing new. `initScrollReveal()` / `initCounters()` keep their signatures.
- Produces: static CSS for `[data-reveal]` / `[data-reveal-stagger]` in the global stylesheet.

Why: the homepage calls `initScrollReveal()` but never injects `SCROLL_REVEAL_CSS`, so reveals silently no-op there; service pages inject it after first paint, causing a hide-then-reveal flash. Static CSS fixes both. The rules are wrapped in `@media (scripting: enabled)` so browsers with JavaScript disabled (or ancient browsers that ignore the media query) never get content hidden.

- [ ] Append to the end of `src/styles/tokens.css`:

```css
/* ============================================================
   Scroll Reveal
   Static styles for [data-reveal] / [data-reveal-stagger]
   (driven by src/scripts/scroll-reveal.ts). Scoped to
   scripting-enabled browsers so content is never hidden
   when JavaScript is unavailable.
   ============================================================ */

@media (scripting: enabled) {
  [data-reveal],
  [data-reveal-stagger] > * {
    opacity: 0;
    transform: translateY(16px);
    transition:
      opacity 400ms cubic-bezier(0.16, 1, 0.3, 1),
      transform 400ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .reveal-visible,
  [data-reveal-stagger].revealed > * {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  [data-reveal],
  [data-reveal-stagger] > * {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
```

- [ ] Delete lines 1-19 of `src/scripts/scroll-reveal.ts` (the whole `export const SCROLL_REVEAL_CSS = ...` block). Everything else in the file stays.
- [ ] In `src/pages/services/automation.astro`, change the script block imports and delete the injection guard. Replace:

```ts
  import { initScrollReveal, initCounters, SCROLL_REVEAL_CSS } from '../../scripts/scroll-reveal.ts';
```

with

```ts
  import { initScrollReveal, initCounters } from '../../scripts/scroll-reveal.ts';
```

and delete these six lines:

```ts
  if (!document.getElementById('scroll-reveal-css')) {
    const style = document.createElement('style');
    style.id = 'scroll-reveal-css';
    style.textContent = SCROLL_REVEAL_CSS;
    document.head.appendChild(style);
  }
```

- [ ] Apply the identical import change + six-line deletion in `src/pages/services/builds.astro`, `src/pages/services/apps.astro`, and `src/pages/services/index.astro`.
- [ ] In `src/pages/about-me.astro` (lines 1768-1778), change the import the same way and delete these three lines:

```ts
  const style = document.createElement('style');
  style.textContent = SCROLL_REVEAL_CSS;
  document.head.appendChild(style);
```

- [ ] Sweep for stragglers (Plan 3 creates new pages (/work, /privacy, and four service pages) from the automation template that copy the injection block):

```bash
grep -rn 'SCROLL_REVEAL_CSS' src/ || echo CLEAN
```

If any file still references it, apply the same import change + block deletion there, then re-run until `CLEAN`.
- [ ] Run `pnpm build`. Expected: success.
- [ ] Verify the CSS ships statically and no page injects it:

```bash
grep -c 'scripting: enabled' src/styles/tokens.css                          # expect: 1
grep -rl 'scroll-reveal-css' .vercel/output/static/_astro 2>/dev/null | wc -l  # expect: 0
grep -rl 'data-reveal' .vercel/output/static/index.html                     # expect: match (attribute present)
```

- [ ] Manual check (optional): `pnpm dev`, open the homepage; sections below the fold now fade/slide in on scroll. Open /services/automation; no flash of hidden-then-shown content on load.
- [ ] Commit:

```bash
git add src/styles/tokens.css src/scripts/scroll-reveal.ts src/pages/services/automation.astro src/pages/services/builds.astro src/pages/services/apps.astro src/pages/services/index.astro src/pages/about-me.astro
git commit -m "Ship scroll-reveal CSS statically, remove JS injection

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Starfield: named three imports, dynamic import, RAF pause when invisible

**Files:**
- Create: `src/scripts/starfield.ts`
- Modify: `src/components/StarfieldHero.astro` (replace the whole `<script>` block, lines 63-415; add a reduced-motion CSS fallback)

**Interfaces:**
- Produces: `startStarfield(canvas: HTMLCanvasElement): { stop(): void }`
- Consumes: `three` (named imports only), theme attribute `data-theme` on `<html>` (set by Layout.astro inline script; toggled by Nav.astro; `light` means light theme, anything else is dark)

Behaviour: three.js loads ONLY when the theme is dark AND the visitor does not prefer reduced motion. The RAF loop pauses (after rendering one static frame) whenever the canvas is effectively invisible: light theme, hidden tab, or scrolled past 1.5 viewports. It resumes when conditions return.

- [ ] Create `src/scripts/starfield.ts` with exactly:

```ts
// src/scripts/starfield.ts
// WebGL warp-speed starfield. Loaded via dynamic import from
// StarfieldHero.astro only when the theme is dark and motion is allowed.
// Named three imports keep the chunk tree-shakeable.

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from 'three';

const PAUSE_SCROLL_FACTOR = 1.5;

export function startStarfield(canvas: HTMLCanvasElement): { stop(): void } {
  // -------------------------------------------------------------------------
  // Particle count - reduce on low-end devices
  // -------------------------------------------------------------------------
  const isLowEnd =
    typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 4;

  const PARTICLE_COUNT = isLowEnd ? 1200 : 3000;

  // -------------------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------------------
  const SPREAD_XY = 800;
  const Z_NEAR = 0;
  const Z_FAR = -2000;
  const CRUISE_SPEED = 14; // units per frame at 60 fps equivalent
  const BOOT_DURATION_MS = 800;

  // -------------------------------------------------------------------------
  // Renderer, scene, camera
  // -------------------------------------------------------------------------
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 1);

  const scene = new Scene();
  const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 3000);
  camera.position.set(0, 0, 0);

  // -------------------------------------------------------------------------
  // Particle data arrays
  // -------------------------------------------------------------------------
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const prevPositions = new Float32Array(PARTICLE_COUNT * 3);
  const colors = new Float32Array(PARTICLE_COUNT * 3);

  const colorWhite = new Color(0xf0f0f0);
  const colorGreen = new Color(0x22c55e);
  const colorPink = new Color(0xec4899);

  function randomXY(): [number, number] {
    return [(Math.random() - 0.5) * 2 * SPREAD_XY, (Math.random() - 0.5) * 2 * SPREAD_XY];
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const [x, y] = randomXY();
    const z = Math.random() * (Z_NEAR - Z_FAR) + Z_FAR;

    const idx = i * 3;
    positions[idx] = x;
    positions[idx + 1] = y;
    positions[idx + 2] = z;

    prevPositions[idx] = x;
    prevPositions[idx + 1] = y;
    prevPositions[idx + 2] = z;

    const rand = Math.random();
    let col: Color;
    if (rand < 0.8) {
      col = colorWhite;
    } else if (rand < 0.95) {
      col = colorGreen;
    } else {
      col = colorPink;
    }
    colors[idx] = col.r;
    colors[idx + 1] = col.g;
    colors[idx + 2] = col.b;
  }

  // -------------------------------------------------------------------------
  // Points geometry + custom shader material
  // -------------------------------------------------------------------------
  const pointsGeo = new BufferGeometry();
  const posAttr = new BufferAttribute(positions, 3);
  posAttr.setUsage(DynamicDrawUsage);
  pointsGeo.setAttribute('position', posAttr);

  const colorAttr = new BufferAttribute(colors, 3);
  pointsGeo.setAttribute('color', colorAttr);

  const vertexShader = /* glsl */ `
    attribute vec3 color;
    varying vec3 vColor;

    void main() {
      vColor = color;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

      float depth = clamp(1.0 + position.z / 2000.0, 0.0, 1.0);
      float size = mix(0.8, 5.0, depth * depth);

      gl_PointSize = size * (300.0 / -mvPosition.z);
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = /* glsl */ `
    varying vec3 vColor;

    void main() {
      vec2 uv = gl_PointCoord - vec2(0.5);
      float d = length(uv);
      if (d > 0.5) discard;
      float alpha = smoothstep(0.5, 0.1, d);
      gl_FragColor = vec4(vColor, alpha);
    }
  `;

  const pointsMat = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    vertexColors: false,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });

  const points = new Points(pointsGeo, pointsMat);
  scene.add(points);

  // -------------------------------------------------------------------------
  // Line streaks geometry
  // -------------------------------------------------------------------------
  const linePositions = new Float32Array(PARTICLE_COUNT * 6);
  const lineColors = new Float32Array(PARTICLE_COUNT * 6);

  const lineGeo = new BufferGeometry();
  const linePosAttr = new BufferAttribute(linePositions, 3);
  linePosAttr.setUsage(DynamicDrawUsage);
  lineGeo.setAttribute('position', linePosAttr);

  const lineColorAttr = new BufferAttribute(lineColors, 3);
  lineColorAttr.setUsage(DynamicDrawUsage);
  lineGeo.setAttribute('color', lineColorAttr);

  const lineMat = new LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.5,
    blending: AdditiveBlending,
    depthWrite: false,
  });

  const lineSegments = new LineSegments(lineGeo, lineMat);
  scene.add(lineSegments);

  // -------------------------------------------------------------------------
  // Run state: pause RAF when the canvas is effectively invisible
  // (light theme, hidden tab, or scrolled past 1.5 viewports).
  // -------------------------------------------------------------------------
  const bootStartTime = performance.now();
  let currentSpeed = 0;

  let scrollY = window.scrollY;
  let smoothScrollFactor = 1.0;
  let rafId = 0;
  let paused = false;
  let stopped = false;
  let lastTime = performance.now();

  function isVisible(): boolean {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    return (
      !isLight &&
      !document.hidden &&
      scrollY <= window.innerHeight * PAUSE_SCROLL_FACTOR
    );
  }

  function easeInCubic(t: number): number {
    return t * t * t;
  }

  function animate(now: number): void {
    if (stopped) return;

    if (!isVisible()) {
      // Render one static frame, then stop scheduling frames.
      paused = true;
      renderer.render(scene, camera);
      return;
    }

    const delta = Math.min((now - lastTime) / 16.667, 3);
    lastTime = now;

    const elapsed = now - bootStartTime;
    if (elapsed < BOOT_DURATION_MS) {
      const t = elapsed / BOOT_DURATION_MS;
      currentSpeed = easeInCubic(t) * CRUISE_SPEED;
    } else {
      currentSpeed = CRUISE_SPEED;
    }

    const viewportHeight = window.innerHeight;
    const scrollRatio = Math.min(scrollY / viewportHeight, 1.0);
    const targetScrollFactor = scrollRatio >= 1.0 ? 0.3 : 1.0 - scrollRatio * 0.7;
    smoothScrollFactor += (targetScrollFactor - smoothScrollFactor) * 0.08;

    const targetOpacity = scrollRatio >= 1.0 ? 0.3 : 1.0 - scrollRatio * 0.7;
    canvas.style.opacity = String(Math.max(0.3, targetOpacity));

    const frameSpeed = currentSpeed * smoothScrollFactor * delta;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const idx = i * 3;

      prevPositions[idx] = positions[idx];
      prevPositions[idx + 1] = positions[idx + 1];
      prevPositions[idx + 2] = positions[idx + 2];

      positions[idx + 2] += frameSpeed;

      if (positions[idx + 2] > Z_NEAR) {
        const [x, y] = randomXY();
        positions[idx] = x;
        positions[idx + 1] = y;
        positions[idx + 2] = Z_FAR;

        prevPositions[idx] = x;
        prevPositions[idx + 1] = y;
        prevPositions[idx + 2] = Z_FAR;
      }

      const lineIdx = i * 6;
      const curZ = positions[idx + 2];

      const nearness = Math.max(0, (curZ - Z_FAR) / -Z_FAR);
      const trailScale = nearness > 0.75 ? 2.5 : 1.0;

      const trailZ = prevPositions[idx + 2] - frameSpeed * (trailScale - 1.0);
      linePositions[lineIdx] = prevPositions[idx];
      linePositions[lineIdx + 1] = prevPositions[idx + 1];
      linePositions[lineIdx + 2] = trailZ;

      linePositions[lineIdx + 3] = positions[idx];
      linePositions[lineIdx + 4] = positions[idx + 1];
      linePositions[lineIdx + 5] = curZ;

      const dimFactor = nearness * 0.6;
      lineColors[lineIdx] = colors[idx] * dimFactor;
      lineColors[lineIdx + 1] = colors[idx + 1] * dimFactor;
      lineColors[lineIdx + 2] = colors[idx + 2] * dimFactor;

      lineColors[lineIdx + 3] = colors[idx] * nearness;
      lineColors[lineIdx + 4] = colors[idx + 1] * nearness;
      lineColors[lineIdx + 5] = colors[idx + 2] * nearness;
    }

    posAttr.needsUpdate = true;
    linePosAttr.needsUpdate = true;
    lineColorAttr.needsUpdate = true;

    renderer.render(scene, camera);

    rafId = requestAnimationFrame(animate);
  }

  function resumeIfVisible(): void {
    if (stopped || !paused || !isVisible()) return;
    paused = false;
    lastTime = performance.now();
    rafId = requestAnimationFrame(animate);
  }

  function onScroll(): void {
    scrollY = window.scrollY;
    resumeIfVisible();
  }

  function onVisibilityChange(): void {
    resumeIfVisible();
  }

  const themeObserver = new MutationObserver(() => {
    resumeIfVisible();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);

  // -------------------------------------------------------------------------
  // Resize handling (debounced)
  // -------------------------------------------------------------------------
  let resizeTimer: ReturnType<typeof setTimeout>;

  function onResize(): void {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }, 150);
  }

  window.addEventListener('resize', onResize, { passive: true });

  rafId = requestAnimationFrame(animate);

  return {
    stop(): void {
      stopped = true;
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      themeObserver.disconnect();
      pointsGeo.dispose();
      lineGeo.dispose();
      pointsMat.dispose();
      lineMat.dispose();
      renderer.dispose();
    },
  };
}
```

- [ ] In `src/components/StarfieldHero.astro`, replace the ENTIRE `<script>` block (lines 63-415) with:

```astro
<script>
  // Gate the three.js payload: load only for dark theme with motion allowed.
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function isDarkTheme(): boolean {
    return document.documentElement.getAttribute('data-theme') !== 'light';
  }

  let started = false;

  async function maybeStart(): Promise<void> {
    if (started || prefersReducedMotion || !isDarkTheme()) return;
    started = true;
    const canvas = document.getElementById('starfield-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const { startStarfield } = await import('../scripts/starfield.ts');
    startStarfield(canvas);
  }

  maybeStart();

  // If the visitor switches from light to dark later, load the starfield then.
  const themeGate = new MutationObserver(() => {
    void maybeStart();
  });
  themeGate.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
</script>
```

- [ ] In the `<style>` block of `StarfieldHero.astro`, add a static reduced-motion fallback after the light-theme rule (after line 60):

```css
  /* Reduced motion: no WebGL loads. A faint static field of CSS stars instead. */
  @media (prefers-reduced-motion: reduce) {
    #starfield-canvas {
      opacity: 0.35;
      background:
        radial-gradient(1.5px 1.5px at 12% 24%, rgba(240, 240, 240, 0.8) 0, transparent 100%),
        radial-gradient(1px 1px at 32% 68%, rgba(240, 240, 240, 0.6) 0, transparent 100%),
        radial-gradient(1.5px 1.5px at 48% 14%, rgba(34, 197, 94, 0.7) 0, transparent 100%),
        radial-gradient(1px 1px at 61% 42%, rgba(240, 240, 240, 0.6) 0, transparent 100%),
        radial-gradient(1.5px 1.5px at 74% 77%, rgba(240, 240, 240, 0.8) 0, transparent 100%),
        radial-gradient(1px 1px at 85% 21%, rgba(236, 72, 153, 0.6) 0, transparent 100%),
        radial-gradient(1px 1px at 21% 87%, rgba(240, 240, 240, 0.5) 0, transparent 100%),
        radial-gradient(1.5px 1.5px at 92% 58%, rgba(240, 240, 240, 0.7) 0, transparent 100%),
        #000;
    }

    #scanline-overlay {
      display: none;
    }
  }
```

- [ ] Confirm no eager three import remains: `grep -rn "import \* as THREE" src/` expects no matches; `grep -rn "from 'three'" src/` matches only `src/scripts/starfield.ts`.
- [ ] Run `pnpm build`. Expected: success. Verify the chunk split:

```bash
ls .vercel/output/static/_astro | grep -i starfield          # expect: one starfield.*.js chunk
grep -l 'WebGLRenderer' .vercel/output/static/_astro/*.js | wc -l   # expect: 1 (three isolated to the dynamic chunk)
grep -irl 'starfield\.' .vercel/output/static/index.html | wc -l    # expect: 0 (not referenced from HTML; loaded via dynamic import only)
```

- [ ] Manual check (optional): `pnpm dev`, open homepage in light theme (toggle via nav): network tab shows no three.js chunk. Switch to dark: chunk loads, starfield runs. Scroll two viewports down: RAF stops (performance panel shows idle).
- [ ] Commit:

```bash
git add src/scripts/starfield.ts src/components/StarfieldHero.astro
git commit -m "Lazy-load starfield with named three imports, pause RAF when invisible

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Chat drawer polish (chips, focus trap, inert, floating affordance)

**Files:**
- Modify: `src/components/ChatDrawer.astro` (add `fab` prop, chips markup between messages and input row at line 18-20, FAB markup, styles)
- Modify: `src/scripts/chat-drawer.ts` (chips wiring, focus trap, focus restore, inert, FAB hide/show; full replacement content below)
- Modify: `src/pages/services/automation.astro` line 353, `src/pages/services/builds.astro` line 310, `src/pages/services/apps.astro` line 265, `src/pages/services/index.astro` line 158 (pass `fab`)

**Interfaces:**
- Consumes: `ServiceKey` from `src/scripts/chat-prompts.ts`
- Produces: `ChatDrawer` component prop `fab?: ServiceKey`; drawer is `inert` while hidden, traps focus while open, restores focus on close

- [ ] Update `src/components/ChatDrawer.astro` frontmatter:

```astro
---
// ChatDrawer.astro — Slide-up chat drawer for AI enquiry conversations
interface Props {
  /** When set, renders a floating chat button that opens the drawer for this service. */
  fab?: 'consultations' | 'seo' | 'builds' | 'apps' | 'automation' | 'training' | 'personal-ai' | 'general';
}
const { fab } = Astro.props;
---
```

- [ ] Insert the chips block between the `chat-messages` div (line 18) and the `chat-input-row` div (line 20):

```astro
  <div class="chat-chips" id="chatChips">
    <button type="button" class="chat-chip" data-chat-chip>I run a trades business. What could you automate?</button>
    <button type="button" class="chat-chip" data-chat-chip>What could you automate for an agency?</button>
    <button type="button" class="chat-chip" data-chat-chip>How much does a chatbot cost?</button>
  </div>
```

- [ ] Add the FAB after the closing `</div>` of `.chat-drawer` (after line 35):

```astro
{fab && (
  <button type="button" class="chat-fab" data-chat-open={fab} aria-label="Chat with Camber AI">
    <span aria-hidden="true">&gt;_</span> chat
  </button>
)}
```

- [ ] Add these styles inside the component `<style>` (before the closing `@media (prefers-reduced-motion: reduce)` block, and extend that block as shown):

```css
  .chat-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0 16px 12px;
    flex-shrink: 0;
  }

  .chat-chips[hidden] {
    display: none;
  }

  .chat-chip {
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.72rem;
    color: var(--color-text-secondary, #d0d0d0);
    background: var(--color-surface-01, #111);
    border: 1px solid var(--color-border-subtle, #1a1a2e);
    border-radius: 999px;
    padding: 6px 12px;
    cursor: pointer;
    transition: border-color 0.15s ease, color 0.15s ease;
  }

  .chat-chip:hover {
    color: var(--color-green-500, #22c55e);
    border-color: var(--color-green-500, #22c55e);
  }

  .chat-fab {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 950;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 18px;
    font-family: var(--font-mono, 'JetBrains Mono', monospace);
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--color-green-500, #22c55e);
    background: var(--color-surface-00, #0a0a0a);
    border: 1px solid var(--color-green-500, #22c55e);
    border-radius: 999px;
    cursor: pointer;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
  }

  .chat-fab:hover {
    transform: translateY(-1px);
    box-shadow: 0 0 20px var(--color-green-glow, rgba(34, 197, 94, 0.15)), 0 4px 24px rgba(0, 0, 0, 0.4);
  }

  .chat-fab[hidden] {
    display: none;
  }
```

and extend the existing reduced-motion block to:

```css
  @media (prefers-reduced-motion: reduce) {
    .chat-drawer { transition: none; }
    .chat-drawer-backdrop { transition: none; }
    :global(.chat-msg) { animation: none; }
    .chat-chip { transition: none; }
    .chat-fab { transition: none; }
  }
```

- [ ] Replace `src/scripts/chat-drawer.ts` in full with:

```ts
// src/scripts/chat-drawer.ts
// Client-side logic for the AI enquiry chat drawer

import type { ServiceKey } from './chat-prompts';

declare global {
  interface Window {
    __openChatDrawer?: (service: ServiceKey) => void;
  }
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function linkify(text: string): string {
  const safe = escapeHtml(text);
  return safe.replace(
    /(https?:\/\/[^\s)&]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  );
}

let currentService: ServiceKey = 'general';
let messages: Message[] = [];
let isStreaming = false;
let lastFocused: HTMLElement | null = null;

function getElements() {
  return {
    drawer: document.getElementById('chatDrawer'),
    backdrop: document.getElementById('chatBackdrop'),
    messagesEl: document.getElementById('chatMessages'),
    input: document.getElementById('chatInput') as HTMLInputElement | null,
    closeBtn: document.getElementById('chatClose'),
    sendBtn: document.getElementById('chatSend'),
    title: document.getElementById('chatTitle'),
    chips: document.getElementById('chatChips'),
    fab: document.querySelector<HTMLElement>('.chat-fab'),
  };
}

function isOpen(): boolean {
  return document.getElementById('chatDrawer')?.getAttribute('aria-hidden') === 'false';
}

function appendMessage(container: HTMLElement, role: 'user' | 'assistant', content: string): HTMLElement {
  const div = document.createElement('div');
  div.className = `chat-msg chat-msg--${role === 'user' ? 'user' : 'bot'}`;
  div.innerHTML = linkify(content);
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

async function streamResponse(messagesEl: HTMLElement): Promise<void> {
  isStreaming = true;

  const msgEl = document.createElement('div');
  msgEl.className = 'chat-msg chat-msg--bot chat-msg--streaming';
  msgEl.textContent = '...';
  messagesEl.appendChild(msgEl);
  messagesEl.scrollTop = messagesEl.scrollHeight;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: currentService, messages }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Something went wrong.' }));
      msgEl.classList.remove('chat-msg--streaming');
      msgEl.textContent = err.error || 'Something went wrong. Please try again.';
      isStreaming = false;
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      msgEl.textContent = 'Connection error. Please try again.';
      msgEl.classList.remove('chat-msg--streaming');
      isStreaming = false;
      return;
    }

    const decoder = new TextDecoder();
    let fullText = '';
    msgEl.textContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      msgEl.innerHTML = linkify(fullText);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    msgEl.classList.remove('chat-msg--streaming');
    messages.push({ role: 'assistant', content: fullText });
  } catch {
    msgEl.classList.remove('chat-msg--streaming');
    msgEl.innerHTML =
      'connection lost. <a href="/contact/">get in touch directly</a>';
  }

  isStreaming = false;
}

function openDrawer(service: ServiceKey = 'general') {
  const els = getElements();
  if (!els.drawer || !els.backdrop || !els.messagesEl || !els.input || !els.title) return;

  lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  currentService = service;
  messages = [];
  els.messagesEl.innerHTML = '';

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
  els.title.textContent = titles[service] || 'camber/ai';

  (els.drawer as HTMLElement).inert = false;
  els.drawer.setAttribute('aria-hidden', 'false');
  els.backdrop.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  els.chips?.removeAttribute('hidden');
  if (els.fab) els.fab.hidden = true;

  setTimeout(() => els.input?.focus(), 350);

  // Auto-send empty conversation to get the bot's opening line
  streamResponse(els.messagesEl);
}

function closeDrawer() {
  const els = getElements();
  if (!els.drawer || !els.backdrop) return;

  els.drawer.setAttribute('aria-hidden', 'true');
  (els.drawer as HTMLElement).inert = true;
  els.backdrop.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  if (els.fab) els.fab.hidden = false;

  lastFocused?.focus();
  lastFocused = null;
}

function sendMessage(text?: string) {
  const els = getElements();
  if (!els.input || !els.messagesEl || isStreaming) return;

  const value = (text ?? els.input.value).trim();
  if (!value) return;

  els.input.value = '';
  els.chips?.setAttribute('hidden', '');
  messages.push({ role: 'user', content: value });
  appendMessage(els.messagesEl, 'user', value);
  streamResponse(els.messagesEl);
}

function trapFocus(e: KeyboardEvent): void {
  if (e.key !== 'Tab' || !isOpen()) return;
  const drawer = document.getElementById('chatDrawer');
  if (!drawer) return;

  const focusables = Array.from(
    drawer.querySelectorAll<HTMLElement>('button, input, a[href]'),
  ).filter((el) => !el.hasAttribute('hidden') && el.offsetParent !== null);
  if (focusables.length === 0) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;

  if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  } else if (!(active instanceof HTMLElement) || !drawer.contains(active)) {
    e.preventDefault();
    first.focus();
  }
}

export function initChatDrawer(): void {
  const els = getElements();
  if (!els.drawer) return;

  // Hidden drawers are inert: unfocusable and invisible to assistive tech.
  (els.drawer as HTMLElement).inert = true;

  els.closeBtn?.addEventListener('click', closeDrawer);
  els.backdrop?.addEventListener('click', closeDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) closeDrawer();
    trapFocus(e);
  });

  els.sendBtn?.addEventListener('click', () => sendMessage());

  els.input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !isStreaming) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.querySelectorAll<HTMLElement>('[data-chat-chip]').forEach((chip) => {
    chip.addEventListener('click', () => {
      sendMessage(chip.textContent ?? '');
    });
  });

  window.__openChatDrawer = openDrawer;
}
```

- [ ] Pass the FAB prop on the service pages:
  - `src/pages/services/automation.astro` line 353: `<ChatDrawer fab="automation" />`
  - `src/pages/services/builds.astro` line 310: `<ChatDrawer fab="builds" />`
  - `src/pages/services/apps.astro` line 265: `<ChatDrawer fab="apps" />`
  - `src/pages/services/index.astro` line 158: `<ChatDrawer fab="general" />`
  (Homepage and contact page keep `<ChatDrawer />` with no FAB.)
- [ ] Run `pnpm build`. Expected: success. Verify:

```bash
grep -c 'chat-fab' .vercel/output/static/services/automation/index.html   # expect: >= 1
grep -o 'data-chat-chip' .vercel/output/static/services/automation/index.html | wc -l  # expect: 3
grep -c 'chat-fab' .vercel/output/static/index.html                        # expect: 0 (no FAB on homepage)
```

- [ ] Manual check (optional): `pnpm dev`, open /services/automation. FAB floats bottom-right. Click it: drawer opens with 3 chips, FAB hides, Tab cycles inside the drawer only, Escape closes, focus returns to the FAB, chips send their text as the first message.
- [ ] Commit:

```bash
git add src/components/ChatDrawer.astro src/scripts/chat-drawer.ts src/pages/services/automation.astro src/pages/services/builds.astro src/pages/services/apps.astro src/pages/services/index.astro
git commit -m "Polish chat drawer: prompt chips, focus trap, inert, floating button

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Builds page mock: before/after toggle, labelled Illustration

**Files:**
- Modify: `src/pages/services/builds.astro` (window bar at lines 127-132; wrap the current `.proof-site` in an "after" panel and add a "before" panel inside `.proof-browser-body` at lines 133-159; add styles; add toggle wiring to the script block)

**Interfaces:** none new; self-contained page behaviour.

NOTE: Plan 3 may replace the fictional Northstar mock content with real work (this site, bio-core). The toggle wiring below is content-agnostic: it toggles `[data-mock-panel]` visibility whatever the "after" panel contains. If Plan 3 landed first, keep its "after" content and only wrap it.

- [ ] Update the window bar (lines 127-132) to:

```astro
            <div class="window-bar">
              <span class="window-dot window-dot--red"></span>
              <span class="window-dot window-dot--yellow"></span>
              <span class="window-dot window-dot--green"></span>
              <span class="browser-url">https://client-site.com/offer</span>
              <span class="mock-label">Illustration</span>
              <div class="mock-toggle" role="group" aria-label="Toggle before and after states">
                <button type="button" class="mock-toggle-btn" data-mock-state="before" aria-pressed="false">Before</button>
                <button type="button" class="mock-toggle-btn is-active" data-mock-state="after" aria-pressed="true">After</button>
              </div>
            </div>
```

- [ ] Inside `.proof-browser-body`, wrap the existing `.proof-site` div in an "after" panel and add the "before" panel above it:

```astro
            <div class="proof-browser-body">
              <div data-mock-panel="before" hidden>
                <div class="proof-site proof-site--before">
                  <nav class="before-nav" aria-hidden="true">
                    <span class="before-brand">Northstar Studio</span>
                    <span>Home</span>
                    <span>About</span>
                    <span>Services</span>
                    <span>Portfolio</span>
                    <span>News</span>
                    <span>Contact</span>
                  </nav>
                  <section class="before-hero">
                    <h2>Welcome to our website</h2>
                    <p>
                      We are a full service creative digital agency studio offering end to end
                      solutions across brand, web, print, social, video and more, for clients of
                      every size in every sector. Please explore our site to learn more about
                      everything we can do for you and your business today.
                    </p>
                    <div class="before-actions" aria-hidden="true">
                      <span>Learn more</span>
                      <span>Our services</span>
                      <span>Download brochure</span>
                      <span>Contact us</span>
                    </div>
                  </section>
                  <div class="before-popup" aria-hidden="true">
                    <strong>Join our newsletter!</strong>
                    <span>Subscribe for weekly updates</span>
                  </div>
                  <div class="before-cookie" aria-hidden="true">
                    This website uses cookies. Accept | Manage | Decline
                  </div>
                </div>
              </div>
              <div data-mock-panel="after">
                <!-- existing .proof-site div moves here unchanged -->
              </div>
            </div>
```

- [ ] Add styles to the page `<style>` block (after the `.proof-metrics strong` rule around line 647):

```css
  .mock-label {
    margin-left: var(--space-2);
    padding: 2px var(--space-2);
    border: 1px solid var(--color-border-muted);
    border-radius: var(--radius-sm);
    font-family: var(--font-mono);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .mock-toggle {
    display: inline-flex;
    gap: 2px;
    margin-left: var(--space-2);
    flex-shrink: 0;
  }

  .mock-toggle-btn {
    padding: 2px var(--space-2);
    border: 1px solid var(--color-border-muted);
    border-radius: var(--radius-sm);
    background: var(--color-surface-01);
    color: var(--color-text-muted);
    font-family: var(--font-mono);
    font-size: 10px;
  }

  .mock-toggle-btn.is-active,
  .mock-toggle-btn[aria-pressed='true'] {
    color: var(--color-green-500);
    border-color: var(--color-green-500);
  }

  .proof-site--before {
    align-content: start;
    gap: var(--space-4);
    background: linear-gradient(140deg, #3a3a44, #2c2c34);
    position: relative;
  }

  .before-nav {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    font-size: var(--type-caption);
    color: color-mix(in srgb, var(--color-text-inverse) 60%, transparent);
  }

  .before-brand {
    font-weight: 800;
    color: var(--color-text-inverse);
  }

  .before-hero h2 {
    max-width: none;
    font-family: var(--font-sans);
    font-size: var(--type-h2);
    line-height: 1.2;
    letter-spacing: 0;
  }

  .before-hero p {
    max-width: none;
    font-size: var(--type-body-sm);
    line-height: 1.5;
  }

  .before-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-3);
  }

  .before-actions span {
    padding: var(--space-2) var(--space-3);
    border: 1px solid color-mix(in srgb, var(--color-text-inverse) 30%, transparent);
    border-radius: var(--radius-sm);
    font-size: var(--type-caption);
    font-weight: 700;
  }

  .before-popup {
    position: absolute;
    right: var(--space-4);
    bottom: 72px;
    display: grid;
    gap: var(--space-1);
    padding: var(--space-3);
    border: 1px solid color-mix(in srgb, var(--color-text-inverse) 30%, transparent);
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--color-text-primary) 80%, transparent);
    font-size: var(--type-caption);
  }

  .before-cookie {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: var(--space-2) var(--space-4);
    background: color-mix(in srgb, var(--color-text-primary) 85%, transparent);
    border-top: 1px solid color-mix(in srgb, var(--color-text-inverse) 20%, transparent);
    font-size: var(--type-caption);
    text-align: center;
  }
```

- [ ] Append the toggle wiring to the page's `<script>` block (after the existing `data-chat-open` wiring):

```ts
  // Before/after mock toggle
  const mockButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-mock-state]'));
  const mockPanels = Array.from(document.querySelectorAll<HTMLElement>('[data-mock-panel]'));

  mockButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const state = button.dataset.mockState;
      mockButtons.forEach((b) => {
        const active = b === button;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-pressed', String(active));
      });
      mockPanels.forEach((panel) => {
        panel.hidden = panel.dataset.mockPanel !== state;
      });
    });
  });
```

- [ ] Run `pnpm build`. Expected: success. Verify:

```bash
grep -c 'Illustration' .vercel/output/static/services/builds/index.html        # expect: 1
grep -o 'data-mock-state' .vercel/output/static/services/builds/index.html | wc -l     # expect: 2
grep -o 'data-mock-panel' .vercel/output/static/services/builds/index.html | wc -l     # expect: 2
grep -c 'Welcome to our website' .vercel/output/static/services/builds/index.html  # expect: 1
```

- [ ] Commit:

```bash
git add src/pages/services/builds.astro
git commit -m "Add labelled before/after toggle to builds page mock

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: Apps quiz: five sales-narrative questions, no emoji

**Files:**
- Modify: `src/scripts/app-demo.ts` (replace `QUESTIONS` at lines 10-21, export it; remove the trophy emoji at line 61)
- Test: `src/scripts/app-demo.test.ts`

**Interfaces:**
- Produces: `QUESTIONS: QuizQuestion[]` export (and `QuizQuestion` interface export) for tests

- [ ] Write the failing test at `src/scripts/app-demo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { QUESTIONS } from './app-demo';

describe('apps quiz', () => {
  it('has five visitor-facing questions', () => {
    expect(QUESTIONS).toHaveLength(5);
  });

  it('every question has four answers and a valid correct index', () => {
    QUESTIONS.forEach((q) => {
      expect(q.answers).toHaveLength(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(4);
      expect(q.question.length).toBeGreaterThan(0);
    });
  });

  it('teaches the sales narrative', () => {
    const all = JSON.stringify(QUESTIONS);
    expect(all).toContain('Football IQ');
    expect(all).toContain('Weeks, not months');
  });

  it('contains no emoji and no em dashes', () => {
    const all = JSON.stringify(QUESTIONS);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(all).not.toMatch(/—/);
  });
});
```

- [ ] Run `pnpm vitest run src/scripts/app-demo.test.ts`. Expected failure: `QUESTIONS` not exported.
- [ ] In `src/scripts/app-demo.ts`, export the interface and replace lines 4-21 with:

```ts
export interface QuizQuestion {
  question: string;
  answers: string[];
  correctIndex: number;
}

export const QUESTIONS: QuizQuestion[] = [
  {
    question: 'What kills most app ideas before launch?',
    answers: [
      'Slow, expensive agency quotes',
      'Not enough features',
      'The wrong logo',
      'Too much user feedback',
    ],
    correctIndex: 0,
  },
  {
    question: 'What should version one of your app do?',
    answers: [
      'Everything you can think of',
      'One job your users would pay for',
      'Match every competitor feature',
      'Win a design award',
    ],
    correctIndex: 1,
  },
  {
    question: 'How does Camber ship without a big dev team?',
    answers: [
      'Offshore outsourcing',
      'No-code templates',
      'One senior builder, React Native and AI tooling',
      'It does not',
    ],
    correctIndex: 2,
  },
  {
    question: 'How soon should you have a build you can tap?',
    answers: [
      'In about 12 months',
      'After the funding round',
      'Once the spec is perfect',
      'Weeks, not months',
    ],
    correctIndex: 3,
  },
  {
    question: 'What proves this is not just talk?',
    answers: [
      'Football IQ, live on the App Store',
      'A pitch deck',
      'A mood board',
      'A roadmap PDF',
    ],
    correctIndex: 0,
  },
];
```

- [ ] In `renderDone` (currently line 61), remove the trophy emoji. Change:

```ts
    title.textContent = "🏆 Done - you're ready";
```

to:

```ts
    title.textContent = "Done - you're ready";
```

- [ ] Run `pnpm vitest run src/scripts/app-demo.test.ts`. Expected: all tests pass.
- [ ] Confirm no emoji remains in the file: `grep -c '🏆' src/scripts/app-demo.ts` expects `0`.
- [ ] Run `pnpm build`. Expected: success.
- [ ] Run the full suite once more: `pnpm vitest run`. Expected: all tests across Tasks 1-13 pass.
- [ ] Commit:

```bash
git add src/scripts/app-demo.ts src/scripts/app-demo.test.ts
git commit -m "Grow apps quiz to five sales-narrative questions, drop emoji

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Final acceptance sweep (run after all tasks)

- [ ] `pnpm vitest run` passes.
- [ ] `pnpm build` passes.
- [ ] `grep -rn 'SCROLL_REVEAL_CSS' src/` returns nothing.
- [ ] `grep -rn "import \* as THREE" src/` returns nothing.
- [ ] No em dashes in new copy: `grep -n '—' src/scripts/roi-calculator.ts src/scripts/race-demo.ts src/components/RoiCalculator.astro src/components/RaceDemo.astro src/scripts/starfield.ts` returns nothing (pre-existing terminal command strings retained verbatim are exempt; they are Plan 2's copy pass).
- [ ] With `prefers-reduced-motion: reduce` emulated in devtools: ROI values update instantly, race shows completed side-by-side end state, automation demo renders all nodes lit, terminal renders instantly, no three.js network request.
