import { describe, expect, it } from 'vitest';
import { projects } from './projects';

const STATUSES = ['live', 'in-submission', 'in-development', 'open-source', 'professional-work'];
const DIVISIONS = ['camber-builds', 'professional-credential'];

describe('projects data', () => {
  it('has exactly eight projects', () => {
    expect(projects).toHaveLength(8);
  });

  it('has unique slugs covering the agreed set', () => {
    expect(projects.map((p) => p.slug).sort()).toEqual([
      'ai-native-qa',
      'bio-core',
      'clippin',
      'football-iq',
      'gazzetta-ai-predictor',
      'jodz',
      'oddschecker-plus',
      'whoscored-plus',
    ]);
  });

  it('only uses valid statuses and divisions', () => {
    for (const p of projects) {
      expect(STATUSES).toContain(p.status);
      expect(DIVISIONS).toContain(p.division);
    }
  });

  it('marks Football IQ live with the storefront-neutral App Store link', () => {
    const fiq = projects.find((p) => p.slug === 'football-iq');
    expect(fiq?.status).toBe('live');
    expect(fiq?.division).toBe('camber-builds');
    expect(fiq?.links.appStore).toBe('https://apps.apple.com/app/id6757344691');
  });

  it('links ClipPin to GitHub as open source', () => {
    const clippin = projects.find((p) => p.slug === 'clippin');
    expect(clippin?.status).toBe('open-source');
    expect(clippin?.links.github).toBe('https://github.com/charliearlie/ClipPin');
  });

  it('files professional work under professional-credential', () => {
    for (const slug of ['whoscored-plus', 'oddschecker-plus', 'gazzetta-ai-predictor', 'ai-native-qa']) {
      const p = projects.find((x) => x.slug === slug);
      expect(p?.status).toBe('professional-work');
      expect(p?.division).toBe('professional-credential');
    }
  });

  it('ships no metrics until Charlie approves numbers', () => {
    for (const p of projects) {
      expect(p.metrics).toEqual([]);
    }
  });

  it('has a tagline, story and tech list for every project', () => {
    for (const p of projects) {
      expect(p.tagline.length).toBeGreaterThan(0);
      expect(p.story.length).toBeGreaterThan(0);
      expect(p.tech.length).toBeGreaterThan(0);
    }
  });

  it('contains no em dashes anywhere', () => {
    expect(JSON.stringify(projects)).not.toContain('—');
  });
});
