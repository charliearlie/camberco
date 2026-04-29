// src/scripts/about-terminal.ts — Personal terminal for /about-me
// Mirrors the homepage terminal but with personal commands.

interface Command {
  description: string;
  run: (args: string[]) => string[];
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function L(strings: TemplateStringsArray, ...values: string[]): string[] {
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

function scrollToId(id: string): void {
  setTimeout(() => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 200);
}

const PUBLIC_COMMANDS = [
  'help', 'whoami', 'cv', 'projects', 'skills', 'now', 'links', 'contact', 'clear',
];

const ALL_COMPLETIONS = [
  ...PUBLIC_COMMANDS,
  'ls', 'cat', 'sudo', 'sudo hire-me', 'ping', 'git', 'git log', 'git blame', 'git status',
  'vim', ':wq', ':q', 'exit', 'matrix', 'awwwards', '42', 'hello', 'hi', 'pnpm', 'npm',
];

const COMMANDS: Record<string, Command> = {
  help: {
    description: 'list available commands',
    run: () => L`
    <span class="t-muted">commands:</span>

      <span class="t-green">help</span>       show this message
      <span class="t-green">whoami</span>     short bio
      <span class="t-green">cv</span>         career summary
      <span class="t-green">projects</span>   shipped projects
      <span class="t-green">skills</span>     skills matrix
      <span class="t-green">now</span>        currently working on
      <span class="t-green">links</span>      linkedin, github, email
      <span class="t-green">contact</span>    open /contact
      <span class="t-green">clear</span>      clear terminal

    <span class="t-muted">tab to autocomplete · ↑↓ for history · hidden commands exist</span>
    `,
  },

  whoami: {
    description: 'who is this',
    run: () => L`
    <span class="t-green">Charlie Waite</span> · Tech Lead & AI Engineer

    12 years shipping software. Currently leading
    the subscriptions team at Fairplay Sports Media
    and running <span class="t-pink">Camber Co</span> on the side.

    Helped generate millions in revenue across product,
    subscriptions, marketplaces, and ecommerce.

    Based in London, UK. Available for select work.
    `,
  },

  cv: {
    description: 'career summary',
    run: () => {
      scrollToId('career');
      return L`
      <span class="t-muted">$ git log --career --oneline</span>

      <span class="t-green">2024 — Present</span>   <span class="t-pink">fairplay-sports-media</span>   tech lead, subscriptions
      <span class="t-green">2022 — 2024</span>      <span class="t-pink">trainline</span>               senior web engineer
      <span class="t-green">2021 — 2022</span>      <span class="t-pink">just-eat-takeaway</span>       senior web engineer
      <span class="t-green">2019 — 2021</span>      <span class="t-pink">oddschecker</span>             senior frontend developer
      <span class="t-green">2017 — 2019</span>      <span class="t-pink">bbc</span>                     web developer
      <span class="t-green">2016 — 2017</span>      <span class="t-pink">blue-bridge-solutions</span>   junior full stack

      <span class="t-muted">→ scrolling to full timeline...</span>
      `;
    },
  },

  projects: {
    description: 'shipped projects',
    run: () => {
      scrollToId('projects');
      return L`
      <span class="t-muted">$ ls -la projects/</span>

      <span class="t-green">football-iq/</span>     daily football trivia · live on App Store
      <span class="t-green">jodz/</span>            cashflow forecasting · iOS + Mac · in submission
      <span class="t-green">bio-core/</span>        specialist e-commerce platform · in development
      <span class="t-green">clippin/</span>         mac clipboard manager · open source
      <span class="t-green">plus-ai/</span>         WhoScored Plus, Oddschecker Plus, Gazzetta AI
      <span class="t-green">qa-systems/</span>      ai-native browser automation testing

      <span class="t-muted">→ scrolling to project gallery...</span>
      `;
    },
  },

  skills: {
    description: 'skills matrix',
    run: () => {
      scrollToId('skills');
      return L`
      <span class="t-muted">$ cat skills.json</span>

      {
        <span class="t-pink">"ai_automation"</span>:  ["Claude Code", "n8n", "ADK", "LLMs"],
        <span class="t-pink">"frontend"</span>:       ["React", "Astro", "TypeScript", "React Native"],
        <span class="t-pink">"testing_devops"</span>: ["Playwright", "CI/CD", "SQL Server", "a11y"],
        <span class="t-pink">"leadership"</span>:     ["legacy modernisation", "i18n", "A/B testing", "SEO"]
      }
      `;
    },
  },

  now: {
    description: 'current focus',
    run: () => {
      scrollToId('now');
      return L`
      <span class="t-muted">$ cat ~/.now</span>

      → leading subscriptions @ Fairplay
      → career revenue impact in the millions
      → scaling Camber Co — AI consultancy for SMBs
      → shipping Jodz to the App Store
      → building bio-core
      → designing n8n agent fleets for clients

      <span class="t-muted">last updated: today</span>
      `;
    },
  },

  links: {
    description: 'find me elsewhere',
    run: () => L`
    <span class="t-green">FIND ME</span>

      <span class="t-muted">linkedin:</span>  <span class="t-green">linkedin.com/in/charlie-waite</span>
      <span class="t-muted">github:</span>    <span class="t-green">github.com/charliearlie</span>
      <span class="t-muted">email:</span>     <span class="t-green">cw5790@gmail.com</span>
      <span class="t-muted">work:</span>      <span class="t-green">hello@camberco.co.uk</span>

    <span class="t-pink">→ run "contact" to send a message</span>
    `,
  },

  contact: {
    description: 'go to contact page',
    run: () => {
      window.location.href = '/contact/';
      return L`
      <span class="t-green">opening /contact ...</span>
      `;
    },
  },

  clear: {
    description: 'clear terminal',
    run: () => [],
  },

  // ── Easter eggs ──────────────────────────────────────────────

  'sudo': {
    description: '',
    run: (args) => {
      if (args[0] === 'hire-me') {
        return [
          '<span class="t-pink">[sudo] password for charlie:</span>',
          '<span class="t-green">authenticated.</span> redirecting to /contact...',
        ];
      }
      return ['<span class="t-pink">nice try.</span> <span class="t-muted">try "sudo hire-me"</span>'];
    },
  },

  ping: {
    description: '',
    run: (args) => {
      const target = args[0] || 'localhost';
      if (target === 'linkedin' || target === 'linkedin.com') {
        return [
          '<span class="t-muted">PING linkedin.com (52.97.146.140): 56 data bytes</span>',
          '<span class="t-green">64 bytes from charlie-waite: time=12ms</span>',
          '<span class="t-muted">→ <a href="https://linkedin.com/in/charlie-waite" target="_blank" rel="noopener" class="t-link">linkedin.com/in/charlie-waite</a></span>',
        ];
      }
      return [`<span class="t-muted">ping: cannot resolve ${escapeHtml(target)}: no such host</span>`];
    },
  },

  git: {
    description: '',
    run: (args) => {
      const sub = args[0];
      if (sub === 'log') {
        return L`
        <span class="t-pink">commit a4f9d2c</span> <span class="t-muted">(HEAD -> main, tag: tech-lead)</span>
        Author: charlie@fairplay
        Date:   Jan 2024 — Present

            feat(career): helped generate millions in revenue

        <span class="t-pink">commit 8c2b1a7</span>
        Author: charlie@trainline
        Date:   Oct 2022 — Jan 2024

            feat(a11y): full screen-reader-compliant booking flow

        <span class="t-muted">... scroll down for the rest</span>
        `;
      }
      if (sub === 'blame') {
        return ['<span class="t-muted">blame is not the answer.</span> <span class="t-green">ownership is.</span>'];
      }
      if (sub === 'status') {
        return L`
        <span class="t-muted">On branch</span> <span class="t-green">main</span>
        <span class="t-muted">Your branch is up to date.</span>

        <span class="t-green">nothing to commit, working tree clean.</span>
        `;
      }
      return ['<span class="t-muted">try: git log · git status · git blame</span>'];
    },
  },

  vim: {
    description: '',
    run: () => ['<span class="t-pink">vim opened.</span> <span class="t-muted">type :q to escape (just like real life).</span>'],
  },

  ':wq': {
    description: '',
    run: () => ['<span class="t-green">saved & quit.</span> <span class="t-muted">welcome back.</span>'],
  },

  ':q': {
    description: '',
    run: () => ['<span class="t-muted">there is no escape from this terminal. only commands.</span>'],
  },

  ':q!': {
    description: '',
    run: () => ['<span class="t-pink">drama.</span> <span class="t-muted">but okay.</span>'],
  },

  exit: {
    description: '',
    run: () => ['<span class="t-muted">type "contact" instead. let\'s talk.</span>'],
  },

  matrix: {
    description: '',
    run: () => L`
    <span class="t-green">wake up, Neo...</span>
    <span class="t-green">the matrix has you...</span>
    <span class="t-green">follow the white rabbit.</span>

    <span class="t-muted">...kidding. type "contact" to talk shop.</span>
    `,
  },

  awwwards: {
    description: '',
    run: () => ['<span class="t-pink">flattered.</span> <span class="t-muted">but I\'m here to ship, not to win.</span>'],
  },

  '42': {
    description: '',
    run: () => ['the answer to life, the universe, and shipping AI products.'],
  },

  ls: {
    description: '',
    run: () => ['<span class="t-green">career/</span>  <span class="t-green">projects/</span>  <span class="t-green">skills/</span>  <span class="t-green">now/</span>  README.md  .env <span class="t-muted">(nope)</span>'],
  },

  cat: {
    description: '',
    run: (args) => {
      const file = args[0] || '';
      if (file === '.env') {
        return ['<span class="t-pink">PERMISSION DENIED</span> <span class="t-muted">— secrets stay secret.</span>'];
      }
      if (file === 'README.md') {
        return L`
        <span class="t-green"># Charlie Waite</span>

        Tech lead. AI engineer. Founder of Camber Co.
        Ships things. Doesn't talk in slide decks.

        type <span class="t-pink">help</span> to explore.
        `;
      }
      if (file === 'resume.pdf' || file === 'cv.pdf') {
        return ['<span class="t-muted">cat: that\'s a binary file.</span> try <span class="t-green">cv</span> instead.'];
      }
      return [`<span class="t-muted">cat: ${escapeHtml(file || '?')}: no such file or directory</span>`];
    },
  },

  rm: {
    description: '',
    run: () => ['<span class="t-pink">absolutely not.</span>'],
  },

  cd: {
    description: '',
    run: () => ['<span class="t-muted">you\'re already on the about page.</span>'],
  },

  npm: {
    description: '',
    run: () => ['<span class="t-muted">we use pnpm here.</span>'],
  },

  pnpm: {
    description: '',
    run: () => ['<span class="t-green">good choice.</span>'],
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

function getCompletion(partial: string): string | null {
  if (!partial) return null;
  const lower = partial.toLowerCase();
  const match = ALL_COMPLETIONS.find((c) => c.startsWith(lower) && c !== lower);
  return match ?? null;
}

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
      div.innerHTML = line || '&nbsp;';
      div.classList.add('tl-fadein');
      await new Promise((r) => setTimeout(r, speed));
    }

    outputEl.scrollTop = outputEl.scrollHeight;
  }
}

async function runAndRender(
  outputEl: HTMLElement,
  cmdText: string,
  animate: boolean = true,
): Promise<void> {
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

  const lines = processCommand(cmdText);
  if (lines.length > 0) {
    const block = document.createElement('div');
    block.className = 'tl-block';
    outputEl.appendChild(block);
    await typewriteLines(block, lines, animate ? 12 : 0);
  }

  const spacer = document.createElement('div');
  spacer.className = 'tl-spacer';
  outputEl.appendChild(spacer);
  outputEl.scrollTop = outputEl.scrollHeight;
}

async function bootSequence(outputEl: HTMLElement): Promise<void> {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const delay = (ms: number) =>
    reducedMotion ? Promise.resolve() : new Promise((r) => setTimeout(r, ms));

  const bootLines = [
    '<span class="t-muted">camber-os v2.0.0 · /about-me</span>',
    '<span class="t-muted">loading profile...</span> <span class="t-green">charlie.identity ✓</span>',
    '<span class="t-muted">connecting to London node...</span> <span class="t-green">connected</span>',
    '',
    '<span class="t-pink">$</span> <span class="t-muted">whoami</span>',
    '<span class="t-green">Charlie Waite</span> · Tech Lead & AI Engineer.',
    '12 years building software. London, UK.',
    '',
    'type <span class="t-pink">help</span> to explore. tab autocompletes.',
    '',
  ];

  for (const line of bootLines) {
    const div = document.createElement('div');
    div.className = 'tl tl-boot';
    div.innerHTML = line || '&nbsp;';
    outputEl.appendChild(div);
    outputEl.scrollTop = outputEl.scrollHeight;
    await delay(line === '' ? 80 : 160);
  }
}

export function initAboutTerminal(): void {
  const terminal = document.getElementById('aboutTerminal');
  const output = document.getElementById('aboutTerminalOutput');
  const input = document.getElementById('aboutTerminalInput') as HTMLInputElement | null;
  const ghost = document.getElementById('aboutTerminalGhost');
  if (!terminal || !output || !input || !ghost) return;

  const history: string[] = [];
  let historyIndex = -1;
  let booted = false;
  let busy = false;

  function updateGhost(): void {
    if (!input || !ghost) return;
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

  input.addEventListener('keydown', async (e: KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const completion = getCompletion(input.value);
      if (completion) {
        input.value = completion;
        updateGhost();
      }
      return;
    }

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
        if (output) output.innerHTML = '';
      } else if (output) {
        await runAndRender(output, cmd, true);
      }

      busy = false;
      input.focus();
      return;
    }

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

  terminal.addEventListener('click', () => {
    if (!busy && input) input.focus();
  });

  const observer = new IntersectionObserver(
    async (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || booted) continue;
        booted = true;
        observer.unobserve(terminal);

        busy = true;
        if (output) await bootSequence(output);
        busy = false;

        if (input) {
          input.placeholder = '';
        }
        ghost.textContent = 'help';
        ghost.style.display = '';
      }
    },
    { threshold: 0.2 },
  );

  observer.observe(terminal);
}
