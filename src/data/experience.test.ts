import { describe, expect, it } from 'vitest';
import { experience } from './experience';

describe('experience data', () => {
  it('has the full professional history', () => {
    expect(experience).toHaveLength(7);
  });

  it('has unique company slugs covering the agreed set', () => {
    expect(experience.map((r) => r.companySlug).sort()).toEqual([
      'bbc',
      'blue-bridge',
      'fairplay',
      'just-eat',
      'oddschecker',
      'plymouth',
      'trainline',
    ]);
  });

  it('features exactly the five marquee enterprise roles on /work', () => {
    const featured = experience.filter((r) => r.featured).map((r) => r.companySlug).sort();
    expect(featured).toEqual(['bbc', 'fairplay', 'just-eat', 'oddschecker', 'trainline']);
  });

  it('features Just Eat, Trainline and BBC (the named enterprise credentials)', () => {
    for (const slug of ['just-eat', 'trainline', 'bbc']) {
      const role = experience.find((r) => r.companySlug === slug);
      expect(role?.featured).toBe(true);
    }
  });

  it('leaves the junior role and education off the /work highlights', () => {
    for (const slug of ['blue-bridge', 'plymouth']) {
      expect(experience.find((r) => r.companySlug === slug)?.featured).toBe(false);
    }
  });

  it('has unique commit hashes', () => {
    const hashes = experience.map((r) => r.hash);
    expect(new Set(hashes).size).toBe(hashes.length);
  });

  it('has the fields both pages render for every role', () => {
    for (const r of experience) {
      expect(r.company.length).toBeGreaterThan(0);
      expect(r.title.length).toBeGreaterThan(0);
      expect(r.date.length).toBeGreaterThan(0);
      expect(r.summary.length).toBeGreaterThan(0);
      expect(r.highlight.length).toBeGreaterThan(0);
      expect(r.body.length).toBeGreaterThan(0);
      expect(r.tags.length).toBeGreaterThan(0);
    }
  });

  it('keeps the new /work highlight copy free of em dashes', () => {
    for (const r of experience) {
      expect(r.highlight).not.toContain('—');
    }
  });
});
