import { describe, expect, it } from 'vitest';
import { SYSTEM_PROMPTS, type ServiceKey } from './chat-prompts';
import { services } from '../data/services';

describe('chat prompts', () => {
  it('has a prompt for every service chat key', () => {
    for (const s of services) {
      const prompt = SYSTEM_PROMPTS[s.chat as ServiceKey];
      expect(prompt, `missing prompt for chat key "${s.chat}"`).toBeTruthy();
    }
  });

  it('quotes every published from-price exactly, in every prompt', () => {
    for (const s of services) {
      expect(SYSTEM_PROMPTS.general).toContain(s.fromPrice);
    }
  });

  it('no longer forbids quoting prices', () => {
    for (const prompt of Object.values(SYSTEM_PROMPTS)) {
      expect(prompt).not.toContain('Never quote specific prices');
    }
  });

  it('bans invented discounts', () => {
    expect(SYSTEM_PROMPTS.general).toContain('Never invent discounts');
  });

  it('echoes the email back before submitting', () => {
    expect(SYSTEM_PROMPTS.general).toContain(
      'repeat the email address back to the user'
    );
  });

  it('routes proof questions to /work', () => {
    expect(SYSTEM_PROMPTS.general).toContain('camberco.co.uk/work');
  });

  it('does not leak the admin URL', () => {
    for (const prompt of Object.values(SYSTEM_PROMPTS)) {
      expect(prompt).not.toContain('/admin/enquiries');
    }
  });

  it('contains no em dashes', () => {
    for (const prompt of Object.values(SYSTEM_PROMPTS)) {
      expect(prompt).not.toContain('—');
    }
  });
});
