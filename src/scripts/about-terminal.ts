// src/scripts/about-terminal.ts — Personal terminal for /about-me
// Mirrors the homepage terminal but with personal commands.

import { createTerminal, L, escapeHtml } from './terminal-engine';
import type { CommandFn } from './terminal-engine';

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

export const COMMANDS: Record<string, CommandFn> = {
  help: () => L`
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

  whoami: () => L`
    <span class="t-green">Charlie Waite</span> · Tech Lead & AI Engineer

    12 years shipping software. Currently leading
    the subscriptions team at Fairplay Sports Media
    and running <span class="t-pink">Camber Co</span> on the side.

    Helped generate millions in revenue across product,
    subscriptions, marketplaces, and ecommerce.

    Based in London, UK. Available for select work.
    `,

  cv: () => {
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

  projects: () => {
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

  skills: () => {
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

  now: () => {
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

  links: () => L`
    <span class="t-green">FIND ME</span>

      <span class="t-muted">linkedin:</span>  <span class="t-green">linkedin.com/in/charlie-waite</span>
      <span class="t-muted">github:</span>    <span class="t-green">github.com/charliearlie</span>
      <span class="t-muted">email:</span>     <span class="t-green">hello@camberco.co.uk</span>
      <span class="t-muted">work:</span>      <span class="t-green">hello@camberco.co.uk</span>

    <span class="t-pink">→ run "contact" to send a message</span>
    `,

  contact: () => {
    window.location.href = '/contact';
    return L`
      <span class="t-green">opening /contact ...</span>
      `;
  },

  clear: () => [],

  // ── Easter eggs ──────────────────────────────────────────────

  sudo: (args) => {
    if (args[0] === 'hire-me') {
      return [
        '<span class="t-pink">[sudo] password for charlie:</span>',
        '<span class="t-green">authenticated.</span> redirecting to /contact...',
      ];
    }
    return ['<span class="t-pink">nice try.</span> <span class="t-muted">try "sudo hire-me"</span>'];
  },

  ping: (args) => {
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

  git: (args) => {
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

  vim: () => ['<span class="t-pink">vim opened.</span> <span class="t-muted">type :q to escape (just like real life).</span>'],

  ':wq': () => ['<span class="t-green">saved & quit.</span> <span class="t-muted">welcome back.</span>'],

  ':q': () => ['<span class="t-muted">there is no escape from this terminal. only commands.</span>'],

  ':q!': () => ['<span class="t-pink">drama.</span> <span class="t-muted">but okay.</span>'],

  exit: () => ['<span class="t-muted">type "contact" instead. let\'s talk.</span>'],

  matrix: () => L`
    <span class="t-green">wake up, Neo...</span>
    <span class="t-green">the matrix has you...</span>
    <span class="t-green">follow the white rabbit.</span>

    <span class="t-muted">...kidding. type "contact" to talk shop.</span>
    `,

  awwwards: () => ['<span class="t-pink">flattered.</span> <span class="t-muted">but I\'m here to ship, not to win.</span>'],

  '42': () => ['the answer to life, the universe, and shipping AI products.'],

  ls: () => ['<span class="t-green">career/</span>  <span class="t-green">projects/</span>  <span class="t-green">skills/</span>  <span class="t-green">now/</span>  README.md  .env <span class="t-muted">(nope)</span>'],

  cat: (args) => {
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

  rm: () => ['<span class="t-pink">absolutely not.</span>'],

  cd: () => ['<span class="t-muted">you\'re already on the about page.</span>'],

  npm: () => ['<span class="t-muted">we use pnpm here.</span>'],

  pnpm: () => ['<span class="t-green">good choice.</span>'],

  hello: () => ['<span class="t-green">hey!</span> type <span class="t-pink">help</span> to see what I can do.'],

  hi: () => ['<span class="t-green">hey!</span> type <span class="t-pink">help</span> to see what I can do.'],
};

const BOOT_LINES = [
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

export function initAboutTerminal(): void {
  const root = document.getElementById('aboutTerminal');
  if (!root) return;

  createTerminal({
    root,
    commands: COMMANDS,
    completions: ALL_COMPLETIONS,
    bootLines: BOOT_LINES,
    promptLabel: '$',
    observeThreshold: 0.2,
    bootLineDelayMs: 160,
  });
}
