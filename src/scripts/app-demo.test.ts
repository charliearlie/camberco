import { describe, expect, it } from 'vitest';
import { QUESTIONS } from './app-demo';

describe('apps quiz', () => {
  it('has five visitor-facing questions', () => {
    expect(QUESTIONS).toHaveLength(5);
  });

  it('every question has four answers and a valid correct index', () => {
    QUESTIONS.forEach((q) => {
      expect(q.answers).toHaveLength(4);
      expect(q.correctIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctIndex).toBeLessThan(4);
      expect(q.question.length).toBeGreaterThan(0);
    });
  });

  it('teaches the sales narrative', () => {
    const all = JSON.stringify(QUESTIONS);
    expect(all).toContain('Football IQ');
    expect(all).toContain('Weeks, not months');
  });

  it('contains no emoji and no em dashes', () => {
    const all = JSON.stringify(QUESTIONS);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(all).not.toMatch(/—/);
  });
});
