import { describe, expect, it } from 'vitest';
import { INDUSTRIES, NODE_KEYS } from './automation-demo';

describe('INDUSTRIES data map', () => {
  it('defines exactly four industries', () => {
    expect(Object.keys(INDUSTRIES).sort()).toEqual(['agency', 'clinic', 'ecommerce', 'trades']);
    expect(Object.values(INDUSTRIES).map((i) => i.name).sort()).toEqual([
      'Agency',
      'Clinic',
      'E-commerce',
      'Trades',
    ]);
  });

  it('defines every node for every industry', () => {
    Object.values(INDUSTRIES).forEach((industry) => {
      expect(industry.flow.length).toBeGreaterThan(0);
      expect(industry.title.length).toBeGreaterThan(0);
      NODE_KEYS.forEach((key) => {
        const node = industry.nodes[key];
        expect(node.label.length).toBeGreaterThan(0);
        expect(node.icon.length).toBeGreaterThan(0);
        expect(node.status.length).toBeGreaterThan(0);
        expect(node.configTitle.length).toBeGreaterThan(0);
        expect(node.config.length).toBeGreaterThan(0);
      });
    });
  });

  it('tells the trades story from the spec', () => {
    const trades = INDUSTRIES.trades;
    expect(trades.nodes.email.label).toBe('Quote request');
    expect(trades.nodes.claude.label).toBe('AI drafts estimate');
    expect(trades.nodes.notion.label).toBe('Job booked');
    expect(trades.nodes.slack.label).toBe('Invoice sent');
  });

  it('contains no em dashes', () => {
    expect(JSON.stringify(INDUSTRIES)).not.toMatch(/—/);
  });
});
