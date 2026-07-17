import { describe, expect, it } from 'vitest';
import { dispatchCommand } from './terminal-engine';
import { COMMANDS } from './about-terminal';

describe('about terminal commands (refactor invariance)', () => {
  it('renders links exactly as before the refactor', () => {
    expect(dispatchCommand(COMMANDS, 'links')).toEqual([
      '<span class="t-green">FIND ME</span>',
      '',
      '  <span class="t-muted">linkedin:</span>  <span class="t-green">linkedin.com/in/charlie-waite</span>',
      '  <span class="t-muted">github:</span>    <span class="t-green">github.com/charliearlie</span>',
      '  <span class="t-muted">email:</span>     <span class="t-green">hello@camberco.co.uk</span>',
      '  <span class="t-muted">work:</span>      <span class="t-green">hello@camberco.co.uk</span>',
      '',
      '<span class="t-pink">→ run "contact" to send a message</span>',
    ]);
  });

  it('keeps whoami identity intact', () => {
    const out = dispatchCommand(COMMANDS, 'whoami').join('\n');
    expect(out).toContain('Charlie');
    expect(out).toContain('Camber Co');
  });

  it('handles sudo hire-me', () => {
    expect(dispatchCommand(COMMANDS, 'sudo hire-me')).toEqual([
      '<span class="t-pink">[sudo] password for charlie:</span>',
      '<span class="t-green">authenticated.</span> redirecting to /contact...',
    ]);
  });

  it('reports unknown commands with the same message', () => {
    expect(dispatchCommand(COMMANDS, 'nope')).toEqual([
      '<span class="t-muted">command not found: nope. type "help" for available commands.</span>',
    ]);
  });
});
