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
        body: JSON.stringify({ name, email, website, service: 'Workflow automation', message }),
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
