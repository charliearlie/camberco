export interface TypewriterOptions {
  /** Milliseconds per character (default: 40) */
  speed?: number;
  /** Delay before starting in ms (default: 0) */
  startDelay?: number;
  /** Cursor character — unused in DOM implementation; cursor is a styled span (default: '|') */
  cursor?: string;
  /** Cursor blink interval in ms — controls animation-duration via inline style (default: 530) */
  cursorBlinkRate?: number;
  /** Callback invoked once all lines have been typed */
  onComplete?: () => void;
}

export const TYPEWRITER_CSS = `\
.typewriter-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  background: var(--color-green-500, #22c55e);
  margin-left: 2px;
  vertical-align: text-bottom;
  animation: cursor-blink 1.06s step-end infinite;
}
@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .typewriter-cursor { animation: none; opacity: 1; }
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

function createCursorSpan(blinkRate: number): HTMLSpanElement {
  const cursor = document.createElement("span");
  cursor.className = "typewriter-cursor";
  cursor.setAttribute("aria-hidden", "true");
  // Allow per-instance blink rate by overriding the animation-duration.
  if (blinkRate !== 530) {
    cursor.style.animationDuration = `${blinkRate}ms`;
  }
  return cursor;
}

/**
 * Types a single line's text into `lineEl` character by character.
 * `cursor` is moved to the end of `lineEl` before the first character is
 * appended and stays there while typing.  Returns a Promise that resolves
 * once the last character has been appended.
 */
function typeLine(
  lineEl: HTMLElement,
  text: string,
  cursor: HTMLSpanElement,
  speed: number
): Promise<void> {
  return new Promise((resolve) => {
    // Ensure the cursor lives at the end of this line element.
    lineEl.appendChild(cursor);

    let index = 0;

    function typeNext(): void {
      if (index >= text.length) {
        resolve();
        return;
      }

      // Insert the next character as a text node just before the cursor.
      const char = document.createTextNode(text[index]);
      lineEl.insertBefore(char, cursor);
      index++;

      setTimeout(typeNext, speed);
    }

    // Kick off the chain.
    setTimeout(typeNext, speed);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Types `lines` into `container`, one per child div, sequentially.
 * The blinking cursor element migrates from line to line while typing.
 */
export function typewrite(
  container: HTMLElement,
  lines: string[],
  options: TypewriterOptions = {}
): void {
  const {
    speed = 40,
    startDelay = 0,
    cursorBlinkRate = 530,
    onComplete,
  } = options;

  // Accessibility: announce the full text immediately to screen readers.
  container.setAttribute("aria-label", lines.join(" "));
  container.setAttribute("aria-live", "polite");

  // Respect reduced-motion preference — show all text at once, no cursor.
  if (prefersReducedMotion()) {
    lines.forEach((text) => {
      const lineEl = document.createElement("div");
      lineEl.textContent = text;
      container.appendChild(lineEl);
    });
    onComplete?.();
    return;
  }

  const cursor = createCursorSpan(cursorBlinkRate);
  const LINE_GAP = 300; // ms pause between lines

  async function run(): Promise<void> {
    for (let i = 0; i < lines.length; i++) {
      const lineEl = document.createElement("div");
      container.appendChild(lineEl);

      await typeLine(lineEl, lines[i], cursor, speed);

      // Pause between lines (but not after the very last one).
      if (i < lines.length - 1) {
        await new Promise<void>((res) => setTimeout(res, LINE_GAP));
      }
    }

    // Cursor stays on the last line; fire completion callback.
    onComplete?.();
  }

  if (startDelay > 0) {
    setTimeout(run, startDelay);
  } else {
    void run();
  }
}

/**
 * Scans the document for `[data-typewriter]` elements and initialises a
 * typewriter effect on each one.
 *
 * Supported data attributes:
 *   data-lines        — JSON array of strings, e.g. '["Line 1","Line 2"]'
 *   data-speed        — ms per character (number)
 *   data-start-delay  — ms before starting (number)
 *   data-cursor-blink — cursor blink interval in ms (number)
 *
 * Example:
 *   <div
 *     data-typewriter
 *     data-lines='["Build faster.", "Think clearer.", "Ship smarter."]'
 *     data-speed="40"
 *   ></div>
 */
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

    // Fallback: use the element's own text content as a single line.
    if (lines.length === 0 && el.textContent?.trim()) {
      lines = [el.textContent.trim()];
      el.textContent = "";
    }

    if (lines.length === 0) return;

    const options: TypewriterOptions = {};

    const rawSpeed = el.dataset["speed"];
    if (rawSpeed !== undefined) options.speed = Number(rawSpeed);

    const rawDelay = el.dataset["startDelay"];
    if (rawDelay !== undefined) options.startDelay = Number(rawDelay);

    const rawBlink = el.dataset["cursorBlink"];
    if (rawBlink !== undefined) options.cursorBlinkRate = Number(rawBlink);

    typewrite(el, lines, options);
  });
}
