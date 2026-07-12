import { describe, expect, it } from 'vitest';
import { dispatchCommand } from './terminal-engine';
import { COMMANDS, INBOX_DEMO } from './terminal';

describe('homepage terminal commands (refactor invariance)', () => {
  it('renders status exactly as before the refactor', () => {
    expect(dispatchCommand(COMMANDS, 'status')).toEqual([
      '<span class="t-muted">&gt; checking systems...</span> <span class="t-green">✓</span>',
      '',
      '<span class="t-muted">  founder:</span>        Charlie W',
      '<span class="t-muted">  location:</span>        London, UK',
      '<span class="t-muted">  status:</span>          <span class="t-green">[● ACTIVE]</span>',
      '<span class="t-muted">  specialty:</span>       AI systems + automation',
      '<span class="t-muted">  clients served:</span>  40+',
      '<span class="t-muted">  current load:</span>    accepting new clients',
      '',
      '<span class="t-pink">→ run "book" to get started</span>',
    ]);
  });

  it('renders stack exactly as before the refactor', () => {
    expect(dispatchCommand(COMMANDS, 'stack')).toEqual([
      '<span class="t-green">CAMBER CO STACK</span>',
      '',
      '<span class="t-muted">  automation:</span>  n8n, Make, Zapier',
      '<span class="t-muted">  ai/ml:</span>       OpenAI, Anthropic, local LLMs',
      '<span class="t-muted">  platforms:</span>   WhatsApp, Slack, Discord, Telegram',
      '<span class="t-muted">  infra:</span>       Cloudflare, PostgreSQL, serverless',
      '<span class="t-muted">  frontend:</span>    Astro, vanilla JS',
      '<span class="t-muted">  languages:</span>   TypeScript, Python',
      '',
      '<span class="t-muted">"use the right tool, not the shiny one"</span>',
    ]);
  });

  it('renders contact exactly as before the refactor', () => {
    expect(dispatchCommand(COMMANDS, 'contact')).toEqual([
      '<span class="t-green">GET IN TOUCH</span>',
      '',
      '<span class="t-muted">  email:</span>     hello@camberco.co.uk',
      '<span class="t-muted">  form:</span>      camberco.co.uk/contact',
      '<span class="t-muted">  web:</span>       camberco.co.uk',
      '',
      '<span class="t-pink">→ get in touch — no commitment</span>',
    ]);
  });

  it('renders services exactly as before the refactor, including the apps entry', () => {
    expect(dispatchCommand(COMMANDS, 'services')).toEqual([
      '<span class="t-green">ACTIVE SERVICES</span>',
      '',
      '<span class="t-green">  consultations</span>   AI strategy sessions',
      '<span class="t-green">  seo</span>             search engine optimisation',
      '<span class="t-green">  builds</span>          apps & website development',
      '<span class="t-green">  apps</span>            mobile app development',
      '<span class="t-green">  automation</span>      n8n workflow engineering',
      '<span class="t-green">  training</span>        solo founder coaching',
      '<span class="t-green">  personal-ai</span>     your own AI assistant',
      '',
      '<span class="t-muted">run "explore &lt;service&gt;" to chat with AI about it</span>',
    ]);
  });

  it('renders the explore usage/whitelist exactly as before the refactor, including apps', () => {
    expect(dispatchCommand(COMMANDS, 'explore')).toEqual([
      '<span class="t-muted">usage:</span> explore <span class="t-green">consultations</span> | <span class="t-green">seo</span> | <span class="t-green">builds</span> | <span class="t-green">apps</span> | <span class="t-green">automation</span> | <span class="t-green">training</span> | <span class="t-green">personal-ai</span>',
    ]);
  });

  it('reports unknown commands with the same message', () => {
    expect(dispatchCommand(COMMANDS, 'frobnicate')).toEqual([
      '<span class="t-muted">command not found: frobnicate. type "help" for available commands.</span>',
    ]);
  });

  it('keeps help discoverable', () => {
    const help = dispatchCommand(COMMANDS, 'help').join('\n');
    expect(help).toContain('available commands');
    expect(help).toContain('book');
    expect(help).toContain('explore');
  });

  it('escapes HTML in unknown command names', () => {
    expect(dispatchCommand(COMMANDS, '<img>')).toEqual([
      '<span class="t-muted">command not found: &lt;img&gt;. type "help" for available commands.</span>',
    ]);
  });
});

describe('demo inbox', () => {
  it('lists demo inbox in help', () => {
    expect(dispatchCommand(COMMANDS, 'help').join('\n')).toContain('demo inbox');
  });

  it('shows usage for bare demo', () => {
    expect(dispatchCommand(COMMANDS, 'demo')).toEqual([
      '<span class="t-muted">usage:</span> demo <span class="t-green">inbox</span>',
    ]);
  });

  it('acknowledges demo inbox and schedules the replay', () => {
    expect(dispatchCommand(COMMANDS, 'demo inbox')).toEqual([
      '<span class="t-green">launching inbox agent...</span>',
    ]);
  });

  it('tells the triage story without em dashes', () => {
    const all = INBOX_DEMO.map((l) => l.text).join('\n');
    expect(all).toContain('3 new emails');
    expect(all).toContain('invoice logged to Xero');
    expect(all).toContain('reply drafted');
    expect(all).not.toMatch(/—/);
  });
});
