import { describe, expect, it } from 'vitest';

describe('vitest runner', () => {
  it('runs colocated tests under src/', () => {
    expect(1 + 1).toBe(2);
  });
});
