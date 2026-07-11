import { describe, expect, it } from 'vitest';
import {
  AUTO_STEPS,
  AUTOMATED_SECONDS,
  MANUAL_STEPS,
  TOTAL_MANUAL_MINUTES,
  formatClock,
} from './race-demo';

describe('race demo data', () => {
  it('has exactly seven manual steps', () => {
    expect(MANUAL_STEPS).toHaveLength(7);
    MANUAL_STEPS.forEach((step) => {
      expect(step.text.length).toBeGreaterThan(0);
      expect(step.manualMinutes).toBeGreaterThan(0);
    });
  });

  it('totals 22 simulated manual minutes', () => {
    expect(TOTAL_MANUAL_MINUTES).toBe(22);
  });

  it('finishes the automated side in 3 seconds', () => {
    expect(AUTOMATED_SECONDS).toBe(3);
    expect(AUTO_STEPS.length).toBeGreaterThan(0);
  });

  it('contains no em dashes in any copy', () => {
    expect(JSON.stringify(MANUAL_STEPS) + JSON.stringify(AUTO_STEPS)).not.toMatch(/—/);
  });
});

describe('formatClock', () => {
  it('formats zero', () => {
    expect(formatClock(0)).toBe('00:00');
  });

  it('formats fractional minutes as mm:ss', () => {
    expect(formatClock(7.5)).toBe('07:30');
  });

  it('formats the manual total', () => {
    expect(formatClock(22)).toBe('22:00');
  });
});
