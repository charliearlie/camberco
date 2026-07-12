import { describe, expect, it } from 'vitest';
import { dispatchCommand } from './terminal-engine';
import { COMMANDS } from './terminal';

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
