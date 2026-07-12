// src/scripts/terminal.ts — Interactive terminal for the About section
// Features: tab completion, ghost suggestions, typewriter output, command history

import type { ServiceKey } from './chat-prompts';
import { createTerminal, L, escapeHtml } from './terminal-engine';
import type { AutoplayLine, CommandFn, TerminalHandle } from './terminal-engine';

declare global {
  interface Window {
    __openChatDrawer?: (service: ServiceKey) => void;
  }
}

// ─── All visible command names for tab completion ────────────────────────────
const PUBLIC_COMMANDS = [
  'help', 'status', 'about', 'services',
  'explore consultations', 'explore automation', 'explore training', 'explore personal-ai',
  'stack', 'contact', 'book', 'demo inbox', 'clear',
];

export const ALL_COMPLETIONS = [
  ...PUBLIC_COMMANDS,
  'explore', 'demo',
  'ping', 'sudo', 'whoami', 'cowsay', 'matrix', 'exit',
  'ls', 'cat', 'rm', 'cd', 'npm', 'hello', 'hi', '42',
];

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

// ─── Command Registry ────────────────────────────────────────────────────────
export const COMMANDS: Record<string, CommandFn> = {
  help: () => L`
    <span class="t-muted">available commands:</span>

      <span class="t-green">help</span>              show this message
      <span class="t-green">status</span>            system status readout
      <span class="t-green">about</span>             founder info
      <span class="t-green">services</span>          list all services
      <span class="t-green">explore</span> <span class="t-muted">service</span>   chat with AI about a service
      <span class="t-green">stack</span>             tech stack
      <span class="t-green">contact</span>           get in touch
      <span class="t-green">book</span>              book a free audit call
      <span class="t-green">demo inbox</span>        watch an agent clear an inbox
      <span class="t-green">clear</span>             clear terminal

    <span class="t-muted">tab to autocomplete · ↑↓ history · try hidden commands</span>
    `,

  status: () => L`
    <span class="t-muted">&gt; checking systems...</span> <span class="t-green">✓</span>

    <span class="t-muted">  founder:</span>        Charlie W
    <span class="t-muted">  location:</span>        London, UK
    <span class="t-muted">  status:</span>          <span class="t-green">[● ACTIVE]</span>
    <span class="t-muted">  specialty:</span>       AI systems + automation
    <span class="t-muted">  clients served:</span>  40+
    <span class="t-muted">  current load:</span>    accepting new clients

    <span class="t-pink">→ run "book" to get started</span>
    `,

  about: () => L`
    <span class="t-green">Charlie W</span> · Founder, Camber Co

    12 years building software.
    Using AI in production since 2023.
    Based in London, UK.

    I lead every project personally, with a small team
    of trusted specialists behind the scenes.
    You get me, and you get results you can point at.
    `,

  services: () => L`
    <span class="t-green">ACTIVE SERVICES</span>

    <span class="t-green">  consultations</span>   AI strategy sessions
    <span class="t-green">  seo</span>             search engine optimisation
    <span class="t-green">  builds</span>          apps & website development
    <span class="t-green">  apps</span>            mobile app development
    <span class="t-green">  automation</span>      n8n workflow engineering
    <span class="t-green">  training</span>        solo founder coaching
    <span class="t-green">  personal-ai</span>     your own AI assistant

    <span class="t-muted">run "explore &lt;service&gt;" to chat with AI about it</span>
    `,

  explore: (args) => {
    const service = args[0] || '';
    const valid = ['consultations', 'seo', 'builds', 'apps', 'automation', 'training', 'personal-ai'];
    if (valid.includes(service)) {
      setTimeout(() => {
        if (window.__openChatDrawer) {
          window.__openChatDrawer(service as ServiceKey);
        }
      }, 100);
      return [`<span class="t-green">opening chat...</span>`];
    }
    return [
      '<span class="t-muted">usage:</span> explore <span class="t-green">consultations</span> | <span class="t-green">seo</span> | <span class="t-green">builds</span> | <span class="t-green">apps</span> | <span class="t-green">automation</span> | <span class="t-green">training</span> | <span class="t-green">personal-ai</span>',
    ];
  },

  stack: () => L`
    <span class="t-green">CAMBER CO STACK</span>

    <span class="t-muted">  automation:</span>  n8n, Make, Zapier
    <span class="t-muted">  ai/ml:</span>       OpenAI, Anthropic, local LLMs
    <span class="t-muted">  platforms:</span>   WhatsApp, Slack, Discord, Telegram
    <span class="t-muted">  infra:</span>       Cloudflare, PostgreSQL, serverless
    <span class="t-muted">  frontend:</span>    Astro, vanilla JS
    <span class="t-muted">  languages:</span>   TypeScript, Python

    <span class="t-muted">"use the right tool, not the shiny one"</span>
    `,

  contact: () => L`
    <span class="t-green">GET IN TOUCH</span>

    <span class="t-muted">  email:</span>     hello@camberco.co.uk
    <span class="t-muted">  form:</span>      camberco.co.uk/contact
    <span class="t-muted">  web:</span>       camberco.co.uk

    <span class="t-pink">→ get in touch — no commitment</span>
    `,

  book: () => {
    window.location.href = '/contact';
    return L`
      <span class="t-green">opening contact page...</span>

      → camberco.co.uk/contact
        tell us what you need
        no commitment required

      <span class="t-muted">if the page didn't open, visit /contact</span>
      `;
  },

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

  clear: () => [],

  // ── Easter eggs ────────────────────────────────────────────────────────

  ping: () => ['<span class="t-green">pong</span> <span class="t-muted">(12ms from London)</span>'],

  sudo: () => ['<span class="t-pink">nice try.</span> <span class="t-muted">this isn\'t that kind of terminal.</span>'],

  whoami: () => ['a founder who\'s about to save a lot of time <span class="t-green">✓</span>'],

  '42': () => ['the answer to life, the universe, and automation.'],

  cowsay: () => [
    ' __________________________',
    '&lt; automate everything.    &gt;',
    ' --------------------------',
    '        \\   ^__^',
    '         \\  (oo)\\_______',
    '            (__)\\       )\\/\\',
    '                ||----w |',
    '                ||     ||',
  ],

  matrix: () => L`
    <span class="t-green">wake up, founder...</span>
    <span class="t-green">the AI is here.</span>
    <span class="t-green">follow the white rabbit.</span>

    <span class="t-muted">...or just type "book"</span>
    `,

  exit: () => ['<span class="t-muted">there is no escape. only automation.</span>'],

  ls: () => ['<span class="t-green">automations/</span>  <span class="t-green">clients/</span>  <span class="t-green">ai-tools/</span>  README.md  .env <span class="t-muted">(nice try)</span>'],

  cat: (args) => [
    args[0] === '.env'
      ? '<span class="t-pink">ACCESS DENIED</span> <span class="t-muted">— secrets stay secret</span>'
      : `<span class="t-muted">cat: ${escapeHtml(args[0] || 'meow')}: permission denied</span>`,
  ],

  rm: () => ['<span class="t-pink">absolutely not.</span>'],

  cd: () => ['<span class="t-muted">you\'re already where you need to be.</span>'],

  npm: () => ['<span class="t-muted">we use pnpm here.</span> <span class="t-green">standards matter.</span>'],

  hello: () => ['<span class="t-green">hey!</span> type <span class="t-pink">help</span> to see what I can do.'],

  hi: () => ['<span class="t-green">hey!</span> type <span class="t-pink">help</span> to see what I can do.'],
};

const BOOT_LINES = [
  '<span class="t-muted">camber-os v2.0.0</span>',
  '<span class="t-muted">connecting to London node...</span> <span class="t-green">connected</span>',
  '<span class="t-muted">loading services...</span> <span class="t-green">7 active</span>',
  '',
  '<span class="t-green">system ready.</span> type <span class="t-pink">help</span> to begin.',
  '',
];

// ─── Main init ───────────────────────────────────────────────────────────────
export function initTerminal(): void {
  const root = document.getElementById('interactiveTerminal');
  if (!root) return;

  handle = createTerminal({
    root,
    commands: COMMANDS,
    completions: ALL_COMPLETIONS,
    bootLines: BOOT_LINES,
    promptLabel: '$',
    observeThreshold: 0.3,
    bootLineDelayMs: 180,
  });
}
