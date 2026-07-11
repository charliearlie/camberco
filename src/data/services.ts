// Single source of truth for every service surface:
// homepage cards, /services grid, contact chips, chat drawer prompts and JSON-LD offers.
// Titles and prices are contractual. Do not edit them without updating the schema too.

export type Service = {
  slug: string;
  title: string;
  href: string;
  fromPrice: string;
  blurb: string;
  chat: string;
};

export const services: Service[] = [
  {
    slug: 'automation',
    title: 'Workflow automation',
    href: '/services/automation',
    fromPrice: 'from £1,200',
    blurb: 'n8n workflows that connect your tools and do the repetitive work. Most clients get 10-30 hours a month back.',
    chat: 'automation',
  },
  {
    slug: 'builds',
    title: 'Website builds',
    href: '/services/builds',
    fromPrice: 'from £2,500',
    blurb: 'Fast, findable websites that make the offer obvious. Designed, built and shipped end to end.',
    chat: 'builds',
  },
  {
    slug: 'apps',
    title: 'Mobile apps',
    href: '/services/apps',
    fromPrice: 'from £4,500',
    blurb: 'From idea to App Store without hiring a dev team. React Native or SwiftUI, shipped for real.',
    chat: 'apps',
  },
  {
    slug: 'consultations',
    title: 'AI consultations',
    href: '/services/consultations',
    fromPrice: '£297 per session',
    blurb: 'A 60-minute session with an AI consultant who builds. Leave with a prioritised plan, not a slide deck.',
    chat: 'consultations',
  },
  {
    slug: 'seo',
    title: 'SEO services',
    href: '/services/seo',
    fromPrice: 'from £750',
    blurb: 'Technical SEO and content that gets small businesses found. Built into the site, not bolted on.',
    chat: 'seo',
  },
  {
    slug: 'training',
    title: 'Training & coaching',
    href: '/services/training',
    fromPrice: 'from £197',
    blurb: 'Hands-on AI coaching for founders and teams. Practical skills you can use the same day.',
    chat: 'training',
  },
  {
    slug: 'personal-ai',
    title: 'Personal AI',
    href: '/services/personal-ai',
    fromPrice: 'from £497',
    blurb: 'Your own AI assistant, set up around how you work. On-premises builds available for sensitive data.',
    chat: 'personal-ai',
  },
];
