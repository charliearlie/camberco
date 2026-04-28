// src/scripts/automation-demo.ts
// Lazy animated SVG workflow demo for /services/automation.

const EDGE_DURATION_MS = 1200;
const LOOP_PAUSE_MS = 1500;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function wait(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function initTooltip(root: HTMLElement): void {
  const tooltip = root.querySelector<HTMLElement>('[data-automation-tooltip]');
  if (!tooltip) return;

  function hide(): void {
    tooltip.classList.remove('is-visible');
    tooltip.setAttribute('aria-hidden', 'true');
  }

  function position(source: Element): void {
    const rect = source.getBoundingClientRect();
    const tipRect = tooltip.getBoundingClientRect();
    const gap = 10;
    const pad = 8;

    let left = rect.left + rect.width / 2 - tipRect.width / 2;
    let top = rect.top - tipRect.height - gap;

    if (top < pad) top = rect.bottom + gap;
    left = clamp(left, pad, window.innerWidth - tipRect.width - pad);
    top = clamp(top, pad, window.innerHeight - tipRect.height - pad);

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  root.querySelectorAll<SVGGElement>('[data-automation-node]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.stopPropagation();
      const title = node.dataset['configTitle'] ?? 'Config';
      const config = node.dataset['config'] ?? '';
      tooltip.innerHTML = '';

      const titleEl = document.createElement('strong');
      titleEl.textContent = title;
      const bodyEl = document.createElement('span');
      bodyEl.textContent = config;
      tooltip.append(titleEl, bodyEl);

      tooltip.classList.add('is-visible');
      tooltip.setAttribute('aria-hidden', 'false');
      position(node);
    });
  });

  root.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    if (!target?.closest('[data-automation-node]')) hide();
  });

  document.addEventListener('click', (event) => {
    if (!root.contains(event.target as Node)) hide();
  });
  window.addEventListener('scroll', hide, { passive: true });
  window.addEventListener('resize', hide, { passive: true });
}

function initOneAutomationDemo(root: HTMLElement): void {
  const paths = new Map<string, SVGPathElement>();
  root.querySelectorAll<SVGPathElement>('[data-edge]').forEach((path) => {
    paths.set(path.dataset['edge'] ?? '', path);
  });

  const nodes = new Map<string, SVGGElement>();
  root.querySelectorAll<SVGGElement>('[data-automation-node]').forEach((node) => {
    nodes.set(node.dataset['automationNode'] ?? '', node);
  });

  const particles = Array.from(root.querySelectorAll<SVGCircleElement>('[data-particle]'));
  const runAgain = root.querySelector<HTMLButtonElement>('[data-automation-run]');

  let runToken = 0;
  let hasBooted = false;

  function lightNode(key: string): void {
    nodes.get(key)?.classList.add('is-lit');
  }

  function resetGraph(): void {
    nodes.forEach((node) => node.classList.remove('is-lit'));
    particles.forEach((particle) => {
      particle.style.opacity = '0';
    });
  }

  function renderStatic(): void {
    nodes.forEach((node) => node.classList.add('is-lit'));
    particles.forEach((particle) => {
      particle.style.opacity = '0';
    });
    root.classList.add('is-static');
  }

  function animateEdge(edgeKey: string, particleIndex: number, token: number): Promise<void> {
    const path = paths.get(edgeKey);
    const particle = particles[particleIndex];
    if (!path || !particle) return Promise.resolve();

    const length = path.getTotalLength();
    const start = performance.now();
    particle.style.opacity = '1';

    return new Promise((resolve) => {
      function tick(now: number): void {
        if (token !== runToken) {
          particle.style.opacity = '0';
          resolve();
          return;
        }

        const progress = Math.min((now - start) / EDGE_DURATION_MS, 1);
        const point = path.getPointAtLength(length * progress);
        particle.setAttribute('cx', String(point.x));
        particle.setAttribute('cy', String(point.y));

        if (progress < 1) {
          window.requestAnimationFrame(tick);
        } else {
          particle.style.opacity = '0';
          resolve();
        }
      }

      window.requestAnimationFrame(tick);
    });
  }

  async function runSequence(): Promise<void> {
    runToken += 1;
    const token = runToken;
    root.classList.remove('is-static');
    resetGraph();

    if (prefersReducedMotion()) {
      renderStatic();
      return;
    }

    lightNode('email');
    await wait(240);
    if (token !== runToken) return;

    await animateEdge('email-claude', 0, token);
    if (token !== runToken) return;
    lightNode('claude');
    await wait(220);
    if (token !== runToken) return;

    await Promise.all([
      animateEdge('claude-notion', 1, token).then(() => lightNode('notion')),
      animateEdge('claude-slack', 2, token).then(() => lightNode('slack')),
    ]);
    if (token !== runToken) return;

    await wait(LOOP_PAUSE_MS);
    if (token === runToken) runSequence();
  }

  runAgain?.addEventListener('click', () => {
    runSequence();
  });

  initTooltip(root);

  function boot(): void {
    if (hasBooted) return;
    hasBooted = true;
    runSequence();
  }

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

export function initAutomationDemo(): void {
  document.querySelectorAll<HTMLElement>('[data-automation-demo]').forEach(initOneAutomationDemo);
}
