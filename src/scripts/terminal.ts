// src/scripts/terminal.ts — Interactive terminal for the About section
// Features: tab completion, ghost suggestions, typewriter output, command history

import type { ServiceKey } from './chat-prompts';

declare global {
  interface Window {
    __openChatDrawer?: (service: ServiceKey) => void;
  }
}

interface Command {
  description: string;
  run: (args: string[]) => string[];  // returns array of lines
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Line helper — tagged template that splits on newlines and auto-dedents
function L(strings: TemplateStringsArray, ...values: string[]): string[] {
  let result = '';
  strings.forEach((str, i) => {
    result += str + (values[i] ?? '');
  });
  const lines = result.split('\n');
  // Trim leading/trailing blank lines
  if (lines[0].trim() === '') lines.shift();
  if (lines[lines.length - 1]?.trim() === '') lines.pop();
  // Find minimum indentation of non-empty lines
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

// ─── All visible command names for tab completion ────────────────────────────
const PUBLIC_COMMANDS = [
  'help', 'status', 'about', 'services',
  'explore consultations', 'explore automation', 'explore training', 'explore personal-ai',
  'stack', 'contact', 'book', 'clear',
];

const ALL_COMPLETIONS = [
  ...PUBLIC_COMMANDS,
  'explore',
  'ping', 'sudo', 'whoami', 'cowsay', 'matrix', 'exit',
  'ls', 'cat', 'rm', 'cd', 'npm', 'hello', 'hi', '42',
];

// ─── Command Registry ────────────────────────────────────────────────────────
const COMMANDS: Record<string, Command> = {
  help: {
    description: 'list available commands',
    run: () => L`
    <span class="t-muted">available commands:</span>

      <span class="t-green">help</span>              show this message
      <span class="t-green">status</span>            system status readout
      <span class="t-green">about</span>             founder info
      <span class="t-green">services</span>          list all services
      <span class="t-green">explore</span> <span class="t-muted">service</span>   chat with AI about a service
      <span class="t-green">stack</span>             tech stack
      <span class="t-green">contact</span>           get in touch
      <span class="t-green">book</span>              book a free audit call
      <span class="t-green">clear</span>             clear terminal

    <span class="t-muted">tab to autocomplete · ↑↓ history · try hidden commands</span>
    `,
  },

  status: {
    description: 'system status',
    run: () => L`
    <span class="t-muted">&gt; checking systems...</span> <span class="t-green">✓</span>

    <span class="t-muted">  founder:</span>        Charlie W
    <span class="t-muted">  location:</span>        London, UK
    <span class="t-muted">  status:</span>          <span class="t-green">[● ACTIVE]</span>
    <span class="t-muted">  specialty:</span>       AI systems + automation
    <span class="t-muted">  clients served:</span>  40+
    <span class="t-muted">  current load:</span>    accepting new clients

    <span class="t-pink">→ run "book" to get started</span>
    `,
  },

  about: {
    description: 'founder info',
    run: () => L`
    <span class="t-green">Charlie W</span> · Founder, Camber Co

    12 years building software.
    Using AI in production since 2023.
    Based in London, UK.

    I work with a small number of founders at a time —
    directly, hands-on. No account managers, no juniors.
    You get me, and you get results you can point at.
    `,
  },

  services: {
    description: 'list services',
    run: () => L`
    <span class="t-green">ACTIVE SERVICES</span>

    <span class="t-green">  consultations</span>   AI strategy sessions
    <span class="t-green">  automation</span>      n8n workflow engineering
    <span class="t-green">  training</span>        solo founder coaching
    <span class="t-green">  personal-ai</span>     your own AI assistant

    <span class="t-muted">run "explore &lt;service&gt;" to chat with AI about it</span>
    `,
  },

  explore: {
    description: 'explore a service',
    run: (args) => {
      const service = args[0] || '';
      const valid = ['consultations', 'automation', 'training', 'personal-ai'];
      if (valid.includes(service)) {
        setTimeout(() => {
          if (window.__openChatDrawer) {
            window.__openChatDrawer(service as ServiceKey);
          }
        }, 100);
        return [`<span class="t-green">opening chat...</span>`];
      }
      return [
        '<span class="t-muted">usage:</span> explore <span class="t-green">consultations</span> | <span class="t-green">automation</span> | <span class="t-green">training</span> | <span class="t-green">personal-ai</span>',
      ];
    },
  },

  stack: {
    description: 'tech stack',
    run: () => L`
    <span class="t-green">CAMBER CO STACK</span>

    <span class="t-muted">  automation:</span>  n8n, Make, Zapier
    <span class="t-muted">  ai/ml:</span>       OpenAI, Anthropic, local LLMs
    <span class="t-muted">  platforms:</span>   WhatsApp, Slack, Discord, Telegram
    <span class="t-muted">  infra:</span>       Vercel, Supabase, Cloudflare
    <span class="t-muted">  frontend:</span>    Astro, vanilla JS
    <span class="t-muted">  languages:</span>   TypeScript, Python

    <span class="t-muted">"use the right tool, not the shiny one"</span>
    `,
  },

  contact: {
    description: 'contact info',
    run: () => L`
    <span class="t-green">GET IN TOUCH</span>

    <span class="t-muted">  email:</span>     hello@camberco.co.uk
    <span class="t-muted">  form:</span>      camberco.co.uk/contact
    <span class="t-muted">  web:</span>       camberco.co.uk

    <span class="t-pink">→ get in touch — no commitment</span>
    `,
  },

  book: {
    description: 'get in touch',
    run: () => {
      window.location.href = '/contact/';
      return L`
      <span class="t-green">opening contact page...</span>

      → camberco.co.uk/contact
        tell us what you need
        no commitment required

      <span class="t-muted">if the page didn't open, visit /contact</span>
      `;
    },
  },

  clear: {
    description: 'clear terminal',
    run: () => [],
  },

  // ── Easter eggs ────────────────────────────────────────────────────────

  ping: {
    description: '',
    run: () => ['<span class="t-green">pong</span> <span class="t-muted">(12ms from London)</span>'],
  },

  sudo: {
    description: '',
    run: () => ['<span class="t-pink">nice try.</span> <span class="t-muted">this isn\'t that kind of terminal.</span>'],
  },

  whoami: {
    description: '',
    run: () => ['a founder who\'s about to save a lot of time <span class="t-green">✓</span>'],
  },

  '42': {
    description: '',
    run: () => ['the answer to life, the universe, and automation.'],
  },

  cowsay: {
    description: '',
    run: () => [
      ' __________________________',
      '&lt; automate everything.    &gt;',
      ' --------------------------',
      '        \\   ^__^',
      '         \\  (oo)\\_______',
      '            (__)\\       )\\/\\',
      '                ||----w |',
      '                ||     ||',
    ],
  },

  matrix: {
    description: '',
    run: () => L`
    <span class="t-green">wake up, founder...</span>
    <span class="t-green">the AI is here.</span>
    <span class="t-green">follow the white rabbit.</span>

    <span class="t-muted">...or just type "book"</span>
    `,
  },

  exit: {
    description: '',
    run: () => ['<span class="t-muted">there is no escape. only automation.</span>'],
  },

  ls: {
    description: '',
    run: () => ['<span class="t-green">automations/</span>  <span class="t-green">clients/</span>  <span class="t-green">ai-tools/</span>  README.md  .env <span class="t-muted">(nice try)</span>'],
  },

  cat: {
    description: '',
    run: (args) => [
      args[0] === '.env'
        ? '<span class="t-pink">ACCESS DENIED</span> <span class="t-muted">— secrets stay secret</span>'
        : `<span class="t-muted">cat: ${escapeHtml(args[0] || 'meow')}: permission denied</span>`,
    ],
  },

  rm: {
    description: '',
    run: () => ['<span class="t-pink">absolutely not.</span>'],
  },

  cd: {
    description: '',
    run: () => ['<span class="t-muted">you\'re already where you need to be.</span>'],
  },

  npm: {
    description: '',
    run: () => ['<span class="t-muted">we use pnpm here.</span> <span class="t-green">standards matter.</span>'],
  },

  hello: {
    description: '',
    run: () => ['<span class="t-green">hey!</span> type <span class="t-pink">help</span> to see what I can do.'],
  },

  hi: {
    description: '',
    run: () => ['<span class="t-green">hey!</span> type <span class="t-pink">help</span> to see what I can do.'],
  },
};

// ─── Process a command string ────────────────────────────────────────────────
function processCommand(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const parts = trimmed.split(/\s+/);
  const cmdName = parts[0].toLowerCase();
  const args = parts.slice(1);

  const cmd = COMMANDS[cmdName];
  if (!cmd) {
    return [`<span class="t-muted">command not found: ${escapeHtml(cmdName)}. type "help" for available commands.</span>`];
  }

  return cmd.run(args);
}

// ─── Tab completion ──────────────────────────────────────────────────────────
function getCompletion(partial: string): string | null {
  if (!partial) return null;
  const lower = partial.toLowerCase();
  const match = ALL_COMPLETIONS.find((c) => c.startsWith(lower) && c !== lower);
  return match ?? null;
}

// ─── Render lines with typewriter effect ─────────────────────────────────────
async function typewriteLines(
  outputEl: HTMLElement,
  lines: string[],
  speed: number = 8,
): Promise<void> {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  for (const line of lines) {
    const div = document.createElement('div');
    div.className = 'tl';
    outputEl.appendChild(div);

    if (reducedMotion || speed <= 0) {
      div.innerHTML = line || '&nbsp;';
    } else {
      // Parse HTML to extract text nodes and tags
      // We'll show the line instantly but with a brief fade
      div.innerHTML = line || '&nbsp;';
      div.classList.add('tl-fadein');
      await new Promise((r) => setTimeout(r, speed));
    }

    outputEl.scrollTop = outputEl.scrollHeight;
  }
}

// ─── Render a command + output block ─────────────────────────────────────────
async function runAndRender(
  outputEl: HTMLElement,
  cmdText: string,
  animate: boolean = true,
): Promise<void> {
  // Command echo line
  const cmdLine = document.createElement('div');
  cmdLine.className = 'tl tl-cmd';
  const promptSpan = document.createElement('span');
  promptSpan.className = 't-prompt';
  promptSpan.textContent = '$ ';
  const cmdSpan = document.createElement('span');
  cmdSpan.textContent = cmdText;
  cmdLine.appendChild(promptSpan);
  cmdLine.appendChild(cmdSpan);
  outputEl.appendChild(cmdLine);
  outputEl.scrollTop = outputEl.scrollHeight;

  // Process and render output
  const lines = processCommand(cmdText);
  if (lines.length > 0) {
    const block = document.createElement('div');
    block.className = 'tl-block';
    outputEl.appendChild(block);
    await typewriteLines(block, lines, animate ? 12 : 0);
  }

  // Spacer after output
  const spacer = document.createElement('div');
  spacer.className = 'tl-spacer';
  outputEl.appendChild(spacer);
  outputEl.scrollTop = outputEl.scrollHeight;
}

// ─── Boot sequence ───────────────────────────────────────────────────────────
async function bootSequence(outputEl: HTMLElement): Promise<void> {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const delay = (ms: number) =>
    reducedMotion ? Promise.resolve() : new Promise((r) => setTimeout(r, ms));

  const bootLines = [
    '<span class="t-muted">camber-os v2.0.0</span>',
    '<span class="t-muted">connecting to London node...</span> <span class="t-green">connected</span>',
    '<span class="t-muted">loading services...</span> <span class="t-green">4 active</span>',
    '',
    '<span class="t-green">system ready.</span> type <span class="t-pink">help</span> to begin.',
    '',
  ];

  for (const line of bootLines) {
    const div = document.createElement('div');
    div.className = 'tl tl-boot';
    div.innerHTML = line || '&nbsp;';
    outputEl.appendChild(div);
    outputEl.scrollTop = outputEl.scrollHeight;
    await delay(line === '' ? 80 : 180);
  }
}

// ─── Main init ───────────────────────────────────────────────────────────────
export function initTerminal(): void {
  const terminal = document.getElementById('interactiveTerminal');
  const output = document.getElementById('terminalOutput');
  const input = document.getElementById('terminalInput') as HTMLInputElement | null;
  const ghost = document.getElementById('terminalGhost');
  if (!terminal || !output || !input || !ghost) return;

  const history: string[] = [];
  let historyIndex = -1;
  let booted = false;
  let busy = false;

  // ── Ghost text / tab completion ──────────────────────────────────────────
  function updateGhost(): void {
    const val = input.value;
    const completion = getCompletion(val);
    if (completion && val.length > 0) {
      ghost.textContent = completion;
      ghost.style.display = '';
    } else {
      ghost.textContent = '';
      ghost.style.display = 'none';
    }
  }

  input.addEventListener('input', updateGhost);

  // ── Key handling ─────────────────────────────────────────────────────────
  input.addEventListener('keydown', async (e: KeyboardEvent) => {
    // Tab completion
    if (e.key === 'Tab') {
      e.preventDefault();
      const completion = getCompletion(input.value);
      if (completion) {
        input.value = completion;
        updateGhost();
      }
      return;
    }

    // Enter to execute
    if (e.key === 'Enter') {
      if (busy) return;
      const cmd = input.value.trim();
      if (!cmd) return;

      busy = true;
      history.push(cmd);
      historyIndex = history.length;
      input.value = '';
      ghost.textContent = '';
      ghost.style.display = 'none';

      if (cmd.toLowerCase() === 'clear') {
        output.innerHTML = '';
      } else {
        await runAndRender(output, cmd, true);
      }

      busy = false;
      input.focus();
      return;
    }

    // History navigation
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex > 0) {
        historyIndex--;
        input.value = history[historyIndex];
        updateGhost();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < history.length - 1) {
        historyIndex++;
        input.value = history[historyIndex];
      } else {
        historyIndex = history.length;
        input.value = '';
      }
      updateGhost();
      return;
    }
  });

  // ── Click to focus ───────────────────────────────────────────────────────
  terminal.addEventListener('click', () => {
    if (!busy) input.focus();
  });

  // ── Boot on scroll into view ─────────────────────────────────────────────
  const observer = new IntersectionObserver(
    async (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || booted) continue;
        booted = true;
        observer.unobserve(terminal);

        busy = true;
        await bootSequence(output);
        busy = false;

        // Set ghost to suggest "help"
        input.placeholder = '';
        ghost.textContent = 'help';
        ghost.style.display = '';
      }
    },
    { threshold: 0.3 },
  );

  observer.observe(terminal);
}
