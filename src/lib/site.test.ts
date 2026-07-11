import { describe, expect, it } from 'vitest';
import { AUDIT_CTA_LABEL, BOOKING_URL, SITE_URL } from './site';

describe('site constants', () => {
  it('uses the apex domain with no trailing slash', () => {
    expect(SITE_URL).toBe('https://camberco.co.uk');
  });

  it('routes audit CTAs to /contact until the Cal.com URL exists', () => {
    expect(BOOKING_URL).toBeNull();
  });

  it('labels the audit CTA as the free 30-minute audit', () => {
    expect(AUDIT_CTA_LABEL).toBe('Book a free 30-minute audit');
  });
});
