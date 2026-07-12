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
