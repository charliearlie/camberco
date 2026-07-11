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
