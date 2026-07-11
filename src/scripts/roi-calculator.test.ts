import { describe, expect, it } from 'vitest';
import { RECOVERY_RATE, calcSavings } from './roi-calculator';

describe('calcSavings', () => {
  it('exposes the 70% recovery assumption', () => {
    expect(RECOVERY_RATE).toBe(0.7);
  });

  it('computes savings for 10 h/week at £25/h across 2 people', () => {
    const result = calcSavings({ hoursPerWeek: 10, hourlyCost: 25, people: 2 });
    // 10 * 2 * 0.7 = 14 recovered hours per week; * 52 / 12 = 60.666... per month
    expect(result.hoursPerMonth).toBeCloseTo(60.6667, 3);
    expect(result.poundsPerMonth).toBeCloseTo(1516.67, 1);
    expect(result.poundsPerYear).toBeCloseTo(18200, 6);
  });

  it('computes savings for a single person', () => {
    const result = calcSavings({ hoursPerWeek: 5, hourlyCost: 30, people: 1 });
    // 5 * 1 * 0.7 = 3.5 recovered hours per week; * 52 / 12 = 15.1666... per month
    expect(result.hoursPerMonth).toBeCloseTo(15.1667, 3);
    expect(result.poundsPerMonth).toBeCloseTo(455, 6);
    expect(result.poundsPerYear).toBeCloseTo(5460, 6);
  });

  it('returns zero savings for zero hours', () => {
    const result = calcSavings({ hoursPerWeek: 0, hourlyCost: 25, people: 3 });
    expect(result.hoursPerMonth).toBe(0);
    expect(result.poundsPerMonth).toBe(0);
    expect(result.poundsPerYear).toBe(0);
  });
});
