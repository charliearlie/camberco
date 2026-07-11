// Single source of truth for site-wide URLs and CTA labels.
// Consumed by Layout, Nav, Footer, CTA components, email templates and JSON-LD.

export const SITE_URL = 'https://camberco.co.uk';

// Becomes the Cal.com booking URL when Charlie supplies it.
// CTA components: when BOOKING_URL is null, audit CTAs link to /contact.
export const BOOKING_URL: string | null = null;

// The free 30-minute audit call. Never conflate with the paid AI Readiness Audit.
export const AUDIT_CTA_LABEL = 'Book a free 30-minute audit';

// Companies House number, shown on /privacy once Charlie supplies it.
export const COMPANY_NUMBER: string | null = null;
