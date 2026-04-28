// src/scripts/build-demo.ts
// Lazy landing-page composer for /services/builds. No API calls, just instant DOM updates.

type AudienceKey = 'founders' | 'studios' | 'saas' | 'local';
type StyleKey = 'studio' | 'product' | 'editorial';
type AccentKey = 'green' | 'pink' | 'split';
type SectionKey = 'proof' | 'cards' | 'cta';

interface BuilderState {
  offer: string;
  audience: AudienceKey;
  style: StyleKey;
  accent: AccentKey;
  sections: Set<SectionKey>;
}

interface BuilderPreset {
  offer: string;
  audience: AudienceKey;
  style: StyleKey;
  accent: AccentKey;
  sections: SectionKey[];
}

const DEFAULT_STATE: BuilderState = {
  offer: 'AI operations audit',
  audience: 'founders',
  style: 'studio',
  accent: 'split',
  sections: new Set(['proof', 'cards', 'cta']),
};

const BUILDER_PRESETS: BuilderPreset[] = [
  {
    offer: 'Premium booking page',
    audience: 'local',
    style: 'product',
    accent: 'pink',
    sections: ['proof', 'cards', 'cta'],
  },
  {
    offer: 'Studio enquiry system',
    audience: 'studios',
    style: 'editorial',
    accent: 'split',
    sections: ['proof', 'cta'],
  },
  {
    offer: 'SaaS launch waitlist',
    audience: 'saas',
    style: 'product',
    accent: 'green',
    sections: ['proof', 'cards', 'cta'],
  },
  {
    offer: 'Founder sales page',
    audience: 'founders',
    style: 'studio',
    accent: 'split',
    sections: ['cards', 'cta'],
  },
];

const AUDIENCE_COPY: Record<AudienceKey, { label: string; proof: string; metric: string; detail: string }> = {
  founders: {
    label: 'for solo founders',
    proof: 'Built for lean teams shipping with focus.',
    metric: '14d',
    detail: 'from messy brief to launch-ready page',
  },
  studios: {
    label: 'for creative studios',
    proof: 'A cleaner front door for premium project enquiries.',
    metric: '3x',
    detail: 'clearer service paths for visitors',
  },
  saas: {
    label: 'for SaaS teams',
    proof: 'Position the product, qualify leads, and launch campaigns faster.',
    metric: '98',
    detail: 'performance score target from day one',
  },
  local: {
    label: 'for local operators',
    proof: 'Booking, trust, and conversion without the usual website sprawl.',
    metric: '24h',
    detail: 'turnaround for content edits after handoff',
  },
};

const STYLE_COPY: Record<StyleKey, { badge: string; tone: string }> = {
  studio: {
    badge: 'studio launch',
    tone: 'clean blocks, sharp contrast, and a direct route to enquiry.',
  },
  product: {
    badge: 'product page',
    tone: 'feature-led sections with proof, outcomes, and a confident action.',
  },
  editorial: {
    badge: 'editorial offer',
    tone: 'more breathing room, stronger copy hierarchy, and a polished story.',
  },
};

const BASE_PREVIEW_CSS = `
  :host {
    display: block;
    height: 100%;
    font-family: var(--font-sans);
    color: var(--color-text-inverse);
  }

  * {
    box-sizing: border-box;
  }

  button {
    font: inherit;
  }

  .preview-app {
    --preview-accent: var(--color-green-500);
    --preview-accent-2: var(--color-pink-500);
    --preview-ink: var(--color-text-inverse);
    --preview-paper: color-mix(in srgb, var(--color-text-primary) 94%, var(--color-green-500));
    --preview-sheet: color-mix(in srgb, var(--color-text-primary) 86%, var(--color-base));
    --preview-card: color-mix(in srgb, var(--color-text-primary) 78%, transparent);
    --preview-card-strong: color-mix(in srgb, var(--color-text-primary) 92%, transparent);
    --preview-muted: color-mix(in srgb, var(--preview-ink) 64%, var(--color-text-muted));
    --preview-line: color-mix(in srgb, var(--preview-ink) 14%, transparent);
    min-height: 100%;
    overflow: hidden;
    border: 1px solid var(--preview-line);
    border-radius: var(--radius-sm);
    background: var(--preview-paper);
    color: var(--preview-ink);
  }

  .preview-app--pink {
    --preview-accent: var(--color-pink-500);
    --preview-accent-2: var(--color-green-500);
    --preview-paper: color-mix(in srgb, var(--color-text-primary) 92%, var(--color-pink-500));
  }

  .preview-app--split {
    --preview-accent: var(--color-green-500);
    --preview-accent-2: var(--color-pink-500);
  }

  .preview-shell {
    min-height: 100%;
    padding: var(--space-6);
    display: grid;
    gap: var(--space-6);
    background:
      linear-gradient(140deg, color-mix(in srgb, var(--preview-paper) 90%, var(--preview-accent)), var(--preview-sheet));
  }

  .preview-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    color: var(--preview-muted);
    font-size: var(--type-caption);
  }

  .preview-brand {
    display: inline-flex;
    align-items: center;
    min-width: 0;
    gap: var(--space-2);
    color: var(--preview-ink);
    font-weight: 900;
  }

  .preview-brand::before {
    content: "";
    flex: 0 0 var(--space-2);
    width: var(--space-2);
    height: var(--space-2);
    border-radius: 50%;
    background: var(--preview-accent);
    box-shadow: 0 0 var(--space-4) color-mix(in srgb, var(--preview-accent) 70%, transparent);
  }

  .preview-nav span:last-child {
    flex-shrink: 0;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--preview-line);
    border-radius: var(--radius-sm);
    background: var(--preview-card);
    color: var(--preview-ink);
    box-shadow: 0 var(--space-1) var(--space-4) color-mix(in srgb, var(--preview-ink) 6%, transparent);
  }

  .preview-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.04fr) minmax(220px, 0.9fr);
    gap: var(--space-8);
    align-items: center;
    padding: clamp(var(--space-4), 5vw, var(--space-12)) 0;
  }

  .preview-copy-stack {
    min-width: 0;
  }

  .preview-kicker {
    display: inline-flex;
    width: fit-content;
    margin-bottom: var(--space-4);
    padding: var(--space-2) var(--space-3);
    border: 1px solid color-mix(in srgb, var(--preview-accent) 38%, transparent);
    border-radius: var(--radius-sm);
    color: var(--preview-ink);
    background: color-mix(in srgb, var(--preview-accent) 12%, var(--color-text-primary));
    font-weight: 900;
    font-size: var(--type-caption);
  }

  h1 {
    margin: 0;
    max-width: 12ch;
    font-family: var(--font-sans);
    font-size: clamp(var(--space-10), 8vw, var(--space-20));
    line-height: 0.95;
    letter-spacing: 0;
    color: var(--preview-ink);
  }

  .preview-copy {
    max-width: 48ch;
    margin: var(--space-6) 0 0;
    color: var(--preview-muted);
    font-size: var(--type-body);
    line-height: 1.65;
  }

  .preview-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-6);
  }

  .preview-primary,
  .preview-secondary {
    min-height: var(--space-10);
    padding: var(--space-2) var(--space-4);
    border-radius: var(--radius-sm);
    font-weight: 900;
    font-size: var(--type-caption);
  }

  .preview-primary {
    border: 1px solid transparent;
    background: var(--preview-accent);
    color: var(--preview-ink);
    box-shadow: 0 var(--space-2) var(--space-6) color-mix(in srgb, var(--preview-accent) 32%, transparent);
  }

  .preview-secondary {
    border: 1px solid var(--preview-line);
    background: var(--preview-card-strong);
    color: var(--preview-ink);
  }

  .preview-visual {
    position: relative;
    min-height: 300px;
    border: 1px solid var(--preview-line);
    border-radius: var(--radius-md);
    background: var(--preview-card);
    overflow: hidden;
    box-shadow: 0 var(--space-6) var(--space-16) color-mix(in srgb, var(--preview-ink) 12%, transparent);
  }

  .visual-card,
  .preview-visual-stat,
  .visual-chip {
    position: absolute;
    z-index: 1;
    border: 1px solid var(--preview-line);
    border-radius: var(--radius-md);
    background: var(--preview-card-strong);
    box-shadow: 0 var(--space-3) var(--space-8) color-mix(in srgb, var(--preview-ink) 10%, transparent);
  }

  .visual-card {
    display: grid;
    gap: var(--space-2);
    padding: var(--space-4);
  }

  .visual-card strong {
    color: var(--preview-ink);
    font-size: var(--type-h3);
    line-height: 1.1;
  }

  .visual-card em {
    color: var(--preview-muted);
    font-style: normal;
    font-size: var(--type-caption);
    line-height: 1.4;
  }

  .visual-dot-row {
    display: flex;
    gap: var(--space-1);
  }

  .visual-dot-row span,
  .visual-bars span {
    display: block;
    border-radius: var(--radius-sm);
    background: color-mix(in srgb, var(--preview-accent) 72%, var(--color-text-primary));
  }

  .visual-dot-row span {
    width: var(--space-2);
    height: var(--space-2);
    border-radius: 50%;
  }

  .visual-card--primary {
    top: var(--space-6);
    left: var(--space-6);
    width: min(62%, 250px);
  }

  .visual-card--secondary {
    right: var(--space-6);
    bottom: var(--space-6);
    width: min(56%, 220px);
  }

  .visual-bars {
    display: grid;
    gap: var(--space-2);
  }

  .visual-bars span {
    height: var(--space-2);
  }

  .visual-bars span:nth-child(1) {
    width: 82%;
  }

  .visual-bars span:nth-child(2) {
    width: 58%;
    background: color-mix(in srgb, var(--preview-accent-2) 64%, var(--color-text-primary));
  }

  .visual-bars span:nth-child(3) {
    width: 72%;
  }

  .visual-chip {
    left: var(--space-6);
    bottom: var(--space-6);
    padding: var(--space-2) var(--space-3);
    color: var(--preview-muted);
    font-size: var(--type-caption);
    font-weight: 800;
  }

  .preview-visual-stat {
    right: var(--space-6);
    top: var(--space-6);
    display: grid;
    gap: var(--space-1);
    padding: var(--space-4);
    background: var(--preview-accent);
    color: var(--preview-ink);
  }

  .preview-visual-stat strong {
    font-size: clamp(var(--space-8), 6vw, var(--space-12));
    line-height: 1;
  }

  .preview-visual-stat span {
    max-width: 18ch;
    font-size: var(--type-caption);
    line-height: 1.35;
  }

  .preview-proof {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
  }

  .preview-proof-item,
  .preview-card,
  .preview-cta {
    border: 1px solid var(--preview-line);
    border-radius: var(--radius-md);
    background: var(--preview-card);
    box-shadow: 0 var(--space-2) var(--space-8) color-mix(in srgb, var(--preview-ink) 7%, transparent);
  }

  .preview-proof-item {
    padding: var(--space-4);
  }

  .preview-proof-item strong {
    display: block;
    margin-bottom: var(--space-2);
    color: var(--preview-accent);
    font-size: var(--type-h2);
    line-height: 1;
  }

  .preview-proof-item span {
    color: var(--preview-muted);
    font-size: var(--type-caption);
    line-height: 1.45;
  }

  .preview-cards {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3);
  }

  .preview-card {
    min-height: 132px;
    padding: var(--space-4);
  }

  .preview-card small {
    display: block;
    margin-bottom: var(--space-3);
    color: var(--preview-accent);
    font-weight: 900;
  }

  .preview-card h2 {
    margin: 0 0 var(--space-2);
    font-family: var(--font-sans);
    font-size: var(--type-h3);
    letter-spacing: 0;
    color: var(--preview-ink);
  }

  .preview-card p {
    margin: 0;
    color: var(--preview-muted);
    font-size: var(--type-body-sm);
    line-height: 1.6;
  }

  .preview-cta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-4);
    padding: var(--space-4);
  }

  .preview-cta strong {
    color: var(--preview-ink);
  }

  .preview-cta span {
    color: var(--preview-muted);
    font-size: var(--type-caption);
  }

  .preview-cta button {
    flex-shrink: 0;
    border: 1px solid var(--preview-accent);
    border-radius: var(--radius-sm);
    background: transparent;
    color: var(--preview-accent);
    padding: var(--space-2) var(--space-3);
    font-weight: 900;
    font-size: var(--type-caption);
  }

  .preview-app--product {
    --preview-sheet: color-mix(in srgb, var(--color-text-primary) 88%, var(--preview-accent));
  }

  .preview-app--product .preview-shell {
    background:
      linear-gradient(90deg, color-mix(in srgb, var(--preview-accent) 13%, var(--color-text-primary)), transparent 54%),
      linear-gradient(180deg, var(--preview-paper), var(--preview-sheet));
  }

  .preview-app--product h1 {
    max-width: 11ch;
  }

  .preview-app--product .preview-visual {
    background:
      linear-gradient(90deg, color-mix(in srgb, var(--preview-accent) 72%, var(--preview-ink)) 0 9%, transparent 9% 100%),
      linear-gradient(150deg, var(--preview-card-strong), color-mix(in srgb, var(--preview-accent) 14%, var(--color-text-primary)));
  }

  .preview-app--product .visual-card--primary {
    left: auto;
    right: var(--space-6);
    width: 58%;
  }

  .preview-app--product .visual-card--secondary {
    left: var(--space-6);
    right: auto;
    width: 62%;
  }

  .preview-app--product .visual-chip {
    display: none;
  }

  .preview-app--product .preview-visual-stat {
    top: auto;
    bottom: var(--space-6);
    right: var(--space-6);
  }

  .preview-app--product .preview-proof {
    grid-template-columns: 1.2fr 1fr 1fr;
  }

  .preview-app--editorial {
    --preview-paper: color-mix(in srgb, var(--color-text-primary) 95%, var(--color-pink-500));
    --preview-sheet: color-mix(in srgb, var(--color-text-primary) 94%, var(--color-green-500));
    --preview-card: transparent;
  }

  .preview-app--editorial .preview-shell {
    padding: clamp(var(--space-6), 6vw, var(--space-16));
    background:
      linear-gradient(90deg, transparent, color-mix(in srgb, var(--preview-accent-2) 10%, transparent)),
      var(--preview-paper);
  }

  .preview-app--editorial .preview-nav {
    padding-bottom: var(--space-4);
    border-bottom: 1px solid var(--preview-line);
  }

  .preview-app--editorial .preview-nav span:last-child,
  .preview-app--editorial .preview-kicker {
    border-radius: 0;
    box-shadow: none;
  }

  .preview-app--editorial .preview-hero {
    grid-template-columns: 1fr;
    padding: var(--space-10) 0 var(--space-6);
    border-bottom: 1px solid var(--preview-line);
  }

  .preview-app--editorial h1 {
    max-width: 16ch;
    font-weight: 500;
    font-size: clamp(var(--space-10), 7vw, var(--space-24));
    line-height: 1;
  }

  .preview-app--editorial .preview-copy {
    max-width: 58ch;
    font-size: var(--type-body-lg);
  }

  .preview-app--editorial .preview-visual {
    display: none;
  }

  .preview-app--editorial .preview-proof {
    grid-template-columns: 1fr 1.4fr 1fr;
  }

  .preview-app--editorial .preview-proof-item,
  .preview-app--editorial .preview-card {
    border-width: 0 0 1px;
    border-radius: 0;
    box-shadow: none;
  }

  .preview-app--editorial .preview-cards {
    grid-template-columns: 1.35fr 1fr 1fr;
  }

  .preview-app--studio {
    --preview-paper: color-mix(in srgb, var(--color-text-primary) 93%, var(--color-green-500));
    --preview-sheet: color-mix(in srgb, var(--color-text-primary) 90%, var(--color-pink-500));
  }

  .preview-app--studio .preview-shell {
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--preview-paper) 88%, var(--preview-accent-2)), var(--preview-sheet));
  }

  .preview-app--studio .preview-visual {
    background:
      linear-gradient(135deg, color-mix(in srgb, var(--preview-accent) 18%, var(--color-text-primary)), var(--preview-card-strong));
  }

  .preview-app--studio .visual-card--primary {
    top: var(--space-4);
    left: var(--space-4);
    width: 54%;
    min-height: 46%;
    background: color-mix(in srgb, var(--preview-accent-2) 18%, var(--color-text-primary));
  }

  .preview-app--studio .visual-card--secondary {
    right: var(--space-4);
    bottom: var(--space-4);
    width: 56%;
    min-height: 44%;
    background: color-mix(in srgb, var(--preview-accent) 14%, var(--color-text-primary));
  }

  .preview-app--studio .visual-chip {
    right: var(--space-4);
    left: auto;
    top: var(--space-4);
    bottom: auto;
  }

  .preview-app--studio .preview-visual-stat {
    top: auto;
    right: auto;
    left: var(--space-6);
    bottom: var(--space-6);
  }

  @media (max-width: 720px) {
    .preview-shell {
      padding: var(--space-6);
    }

    .preview-hero,
    .preview-proof,
    .preview-cards,
    .preview-app--product .preview-proof,
    .preview-app--editorial .preview-proof,
    .preview-app--editorial .preview-cards {
      grid-template-columns: 1fr;
    }

    h1,
    .preview-app--editorial h1 {
      font-size: clamp(var(--space-8), 11vw, var(--space-14));
    }

    .preview-visual {
      min-height: 280px;
    }

    .preview-cta {
      align-items: flex-start;
      flex-direction: column;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    * {
      animation: none !important;
      transition: none !important;
    }
  }
`;

function cloneDefaultState(): BuilderState {
  return {
    ...DEFAULT_STATE,
    sections: new Set(DEFAULT_STATE.sections),
  };
}

function stateFromPreset(preset: BuilderPreset): BuilderState {
  return {
    offer: preset.offer,
    audience: preset.audience,
    style: preset.style,
    accent: preset.accent,
    sections: new Set(preset.sections),
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normaliseOffer(value: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, 54) : DEFAULT_STATE.offer;
}

function renderPreview(host: HTMLElement, state: BuilderState): void {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  const audience = AUDIENCE_COPY[state.audience];
  const style = STYLE_COPY[state.style];
  const offer = escapeHtml(normaliseOffer(state.offer));
  const headline = `${offer} for people who need momentum.`;

  shadow.innerHTML = `
    <style>${BASE_PREVIEW_CSS}</style>
    <main class="preview-app preview-app--${state.style} preview-app--${state.accent}">
      <div class="preview-shell">
        <nav class="preview-nav" aria-label="Preview navigation">
          <span class="preview-brand">${escapeHtml(offer)}</span>
          <span>${escapeHtml(style.badge)}</span>
        </nav>

        <section class="preview-hero">
          <div>
            <span class="preview-kicker">${escapeHtml(audience.label)}</span>
            <h1>${escapeHtml(headline)}</h1>
            <p class="preview-copy">${escapeHtml(audience.proof)} ${escapeHtml(style.tone)}</p>
            <div class="preview-actions">
              <button class="preview-primary" type="button">Book the intro</button>
              <button class="preview-secondary" type="button">View proof</button>
            </div>
          </div>
          <div class="preview-visual" aria-hidden="true">
            <div class="preview-visual-stat">
              <strong>${escapeHtml(audience.metric)}</strong>
              <span>${escapeHtml(audience.detail)}</span>
            </div>
          </div>
        </section>

        ${state.sections.has('proof') ? `
          <section class="preview-proof" aria-label="Preview proof points">
            <div class="preview-proof-item">
              <strong>01</strong>
              <span>Offer clarified before design starts.</span>
            </div>
            <div class="preview-proof-item">
              <strong>02</strong>
              <span>Page built around one conversion action.</span>
            </div>
            <div class="preview-proof-item">
              <strong>03</strong>
              <span>Fast, responsive, and ready to measure.</span>
            </div>
          </section>
        ` : ''}

        ${state.sections.has('cards') ? `
          <section class="preview-cards" aria-label="Preview feature cards">
            <article class="preview-card">
              <small>positioning</small>
              <h2>Say the sharp thing first.</h2>
              <p>Clear hero copy that helps the right visitor self-select quickly.</p>
            </article>
            <article class="preview-card">
              <small>conversion</small>
              <h2>Guide the next click.</h2>
              <p>Focused page structure with fewer distractions and stronger signals.</p>
            </article>
            <article class="preview-card">
              <small>handoff</small>
              <h2>Keep it editable.</h2>
              <p>A landing section that can grow into the full site when needed.</p>
            </article>
          </section>
        ` : ''}

        ${state.sections.has('cta') ? `
          <section class="preview-cta" aria-label="Preview call to action">
            <div>
              <strong>Ready to shape the first page?</strong>
              <br />
              <span>Start small, ship clean, learn from real visitors.</span>
            </div>
            <button type="button">Start</button>
          </section>
        ` : ''}
      </div>
    </main>
  `;
}

function syncControls(root: HTMLElement, state: BuilderState): void {
  const offer = root.querySelector<HTMLInputElement>('[data-builder-offer]');
  const audience = root.querySelector<HTMLSelectElement>('[data-builder-audience]');
  if (offer) offer.value = state.offer;
  if (audience) audience.value = state.audience;

  root.querySelectorAll<HTMLInputElement>('[data-builder-style]').forEach((input) => {
    input.checked = input.value === state.style;
  });
  root.querySelectorAll<HTMLInputElement>('[data-builder-accent]').forEach((input) => {
    input.checked = input.value === state.accent;
  });
  root.querySelectorAll<HTMLInputElement>('[data-builder-section]').forEach((input) => {
    input.checked = state.sections.has(input.value as SectionKey);
  });
}

function initOneBuildDemo(root: HTMLElement): void {
  const previewHost = root.querySelector<HTMLElement>('[data-build-preview]');
  const reset = root.querySelector<HTMLButtonElement>('[data-build-reset]');
  const offer = root.querySelector<HTMLInputElement>('[data-builder-offer]');
  const audience = root.querySelector<HTMLSelectElement>('[data-builder-audience]');
  if (!previewHost) return;

  let state = cloneDefaultState();
  let hasBooted = false;
  let presetIndex = -1;

  function update(): void {
    renderPreview(previewHost!, state);
  }

  function boot(): void {
    if (hasBooted) return;
    hasBooted = true;
    syncControls(root, state);
    update();
    root.classList.add('is-ready');
  }

  offer?.addEventListener('input', () => {
    state.offer = normaliseOffer(offer.value);
    update();
  });

  audience?.addEventListener('change', () => {
    state.audience = audience.value as AudienceKey;
    update();
  });

  root.querySelectorAll<HTMLInputElement>('[data-builder-style]').forEach((input) => {
    input.addEventListener('change', () => {
      state.style = input.value as StyleKey;
      update();
    });
  });

  root.querySelectorAll<HTMLInputElement>('[data-builder-accent]').forEach((input) => {
    input.addEventListener('change', () => {
      state.accent = input.value as AccentKey;
      update();
    });
  });

  root.querySelectorAll<HTMLInputElement>('[data-builder-section]').forEach((input) => {
    input.addEventListener('change', () => {
      const section = input.value as SectionKey;
      if (input.checked) {
        state.sections.add(section);
      } else {
        state.sections.delete(section);
      }
      update();
    });
  });

  reset?.addEventListener('click', () => {
    state = cloneDefaultState();
    syncControls(root, state);
    update();
  });

  root.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    if (!target?.closest('[data-build-generate]')) return;
    presetIndex = (presetIndex + 1) % BUILDER_PRESETS.length;
    state = stateFromPreset(BUILDER_PRESETS[presetIndex]);
    syncControls(root, state);
    update();
  });

  if (!('IntersectionObserver' in window)) {
    boot();
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(root);
        boot();
      });
    },
    { threshold: 0.25 },
  );

  observer.observe(root);
}

export function initBuildDemo(): void {
  document.querySelectorAll<HTMLElement>('[data-build-demo]').forEach(initOneBuildDemo);
}
