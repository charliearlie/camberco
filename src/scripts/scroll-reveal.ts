export const SCROLL_REVEAL_CSS = `\
[data-reveal], [data-reveal-stagger] > * {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 400ms cubic-bezier(0.16, 1, 0.3, 1),
              transform 400ms cubic-bezier(0.16, 1, 0.3, 1);
}
.reveal-visible, [data-reveal-stagger].revealed > * {
  opacity: 1;
  transform: translateY(0);
}
@media (prefers-reduced-motion: reduce) {
  [data-reveal], [data-reveal-stagger] > * {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
`;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// ---------------------------------------------------------------------------
// Scroll Reveal
// ---------------------------------------------------------------------------

/**
 * Initialises scroll-triggered reveal animations.
 *
 * Any element with [data-reveal] will fade in and slide up when it enters
 * the viewport.  Elements with [data-reveal-stagger] will stagger their
 * direct children's reveals (80 ms between each child).
 *
 * CSS classes applied:
 *   .reveal-hidden  — initial state (opacity: 0, translateY: 16px)
 *   .reveal-visible — revealed state (opacity: 1, translateY: 0)
 *
 * Usage:
 *   <div data-reveal>I fade in on scroll</div>
 *
 *   <div data-reveal-stagger>
 *     <div>Card 1 — 0 ms delay</div>
 *     <div>Card 2 — 80 ms delay</div>
 *     <div>Card 3 — 160 ms delay</div>
 *   </div>
 */
export function initScrollReveal(): void {
  const revealEls = Array.from(
    document.querySelectorAll<HTMLElement>("[data-reveal]")
  );
  const staggerEls = Array.from(
    document.querySelectorAll<HTMLElement>("[data-reveal-stagger]")
  );

  // Reduced-motion: skip animation entirely.
  if (prefersReducedMotion()) {
    revealEls.forEach((el) => el.classList.add("reveal-visible"));
    staggerEls.forEach((container) => {
      const children = Array.from(container.children) as HTMLElement[];
      children.forEach((child) => child.classList.add("reveal-visible"));
      container.classList.add("revealed");
    });
    return;
  }

  // Add hidden class so elements start invisible before the observer fires.
  revealEls.forEach((el) => el.classList.add("reveal-hidden"));

  const STAGGER_STEP = 80; // ms between each child

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;

        const target = entry.target as HTMLElement;

        if (target.hasAttribute("data-reveal")) {
          target.classList.remove("reveal-hidden");
          target.classList.add("reveal-visible");
          observer.unobserve(target);
          return;
        }

        if (target.hasAttribute("data-reveal-stagger")) {
          const children = Array.from(target.children) as HTMLElement[];
          children.forEach((child, i) => {
            child.style.transitionDelay = `${i * STAGGER_STEP}ms`;
            // Force a style recalculation so the browser registers the
            // initial hidden state before we apply reveal-visible.
            void child.offsetHeight; // eslint-disable-line @typescript-eslint/no-unused-expressions
            child.classList.add("reveal-visible");
          });
          target.classList.add("revealed");
          observer.unobserve(target);
        }
      });
    },
    { threshold: 0.2 }
  );

  revealEls.forEach((el) => observer.observe(el));
  staggerEls.forEach((el) => observer.observe(el));
}

// ---------------------------------------------------------------------------
// Number Counter
// ---------------------------------------------------------------------------

/**
 * Animates a number from 0 to its target value when the element enters the
 * viewport.
 *
 * Required attribute:
 *   data-count-to="40"      — target numeric value
 *
 * Optional attribute:
 *   data-count-suffix="+"   — text appended after the number (e.g. "+", "%", "x")
 *
 * Duration: 800 ms, ease-out (quartic).
 *
 * Example:
 *   <span data-count-to="40" data-count-suffix="+"></span>
 */
export function initCounters(): void {
  const DURATION = 800; // ms

  const elements = Array.from(
    document.querySelectorAll<HTMLElement>("[data-count-to]")
  );

  if (elements.length === 0) return;

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

    if (prefersReducedMotion()) {
      el.textContent = target.toFixed(decimals) + suffix;
      return;
    }

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
    // Initialise with "0" so there is no layout shift before the animation.
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
