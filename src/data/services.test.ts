import { describe, expect, it } from 'vitest';
import { services } from './services';

describe('services data', () => {
  it('has exactly seven services in the agreed order', () => {
    expect(services.map((s) => s.slug)).toEqual([
      'automation',
      'builds',
      'apps',
      'consultations',
      'seo',
      'training',
      'personal-ai',
    ]);
  });

  it('uses the exact contract titles', () => {
    expect(services.map((s) => s.title)).toEqual([
      'Workflow automation',
      'Website builds',
      'Mobile apps',
      'AI consultations',
      'SEO services',
      'Training & coaching',
      'Personal AI',
    ]);
  });

  it('uses the exact contract prices', () => {
    expect(services.map((s) => s.fromPrice)).toEqual([
      'from £1,200',
      'from £2,500',
      'from £4,500',
      '£297 per session',
      'from £750',
      'from £197',
      'from £497',
    ]);
  });

  it('links every service to its own page', () => {
    for (const s of services) {
      expect(s.href).toBe(`/services/${s.slug}`);
    }
  });

  it('has a non-empty blurb and chat key for every service', () => {
    for (const s of services) {
      expect(s.blurb.length).toBeGreaterThan(0);
      expect(s.chat.length).toBeGreaterThan(0);
    }
  });

  it('contains no em dashes anywhere', () => {
    expect(JSON.stringify(services)).not.toContain('—');
  });
});
