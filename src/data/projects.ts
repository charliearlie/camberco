// Single source of truth for every project surface:
// /work, about-me, services/apps, services/builds and the about terminal.
// metrics stays empty until Charlie approves numbers for publication.
// screenshots paths live under /src/assets/projects/; renderers must handle empty arrays.

export type Project = {
  slug: string;
  name: string;
  tagline: string;
  status: 'live' | 'in-submission' | 'in-development' | 'open-source' | 'professional-work';
  division: 'camber-builds' | 'professional-credential';
  links: { appStore?: string; github?: string; web?: string };
  tech: string[];
  metrics: { label: string; value: string }[];
  story: string;
  screenshots: string[];
  ogImage?: string;
};

export const projects: Project[] = [
  {
    slug: 'football-iq',
    name: 'Football IQ',
    tagline: 'Daily football trivia with 8+ game modes. AI-generated content nightly.',
    status: 'live',
    division: 'camber-builds',
    links: { appStore: 'https://apps.apple.com/app/id6757344691' },
    tech: ['React Native', 'Expo', 'Supabase', 'AI agents', 'PostHog', 'RevenueCat'],
    metrics: [],
    story:
      'A Wordle-style daily football trivia app with 8+ game modes: Career Path, Transfer Guess, Goalscorer Recall, Starting XI and more. Built with React Native and Expo on Supabase. An AI agent pipeline generates fresh puzzles nightly from real match data. Free for the last 7 days, with a one-time premium unlock for the growing archive.',
    screenshots: [],
  },
  {
    slug: 'jodz',
    name: 'Jodz',
    tagline: 'Privacy-first cashflow forecasting for iPhone and Mac.',
    status: 'in-submission',
    division: 'camber-builds',
    links: {},
    tech: ['Swift 6', 'SwiftUI', 'SwiftData', 'CloudKit'],
    metrics: [],
    story:
      'Jodz answers "where will my money be?" instead of "where did it go?". A single continuous timeline projects every bill, payday, subscription and scheduled event months ahead. Built end to end in Swift 6 and SwiftUI with SwiftData and a CloudKit private database. No third-party SDKs, no analytics, no tracking. Universal Purchase across iPhone and Mac with a Home Screen widget.',
    screenshots: [],
  },
  {
    slug: 'bio-core',
    name: 'bio-core',
    tagline: 'Specialist consumer e-commerce platform with AI support.',
    status: 'in-development',
    division: 'camber-builds',
    links: {},
    tech: ['Next.js 15', 'Supabase', 'WebGL', 'TanStack Query', 'Stripe'],
    metrics: [],
    story:
      'A high-performance specialist consumer e-commerce platform. Next.js 15, Supabase and Tailwind, with a custom WebGL aurora hero, a full admin dashboard for inventory, orders and content, and an AI-powered support chatbot with a configurable knowledge base. Adaptive performance tiering keeps it smooth from low-end Android to high-DPR desktop.',
    screenshots: [],
  },
  {
    slug: 'clippin',
    name: 'ClipPin',
    tagline: 'Open-source Mac clipboard history manager.',
    status: 'open-source',
    division: 'camber-builds',
    links: { github: 'https://github.com/charliearlie/ClipPin' },
    tech: ['Swift', 'macOS'],
    metrics: [],
    story:
      'A native Mac clipboard history manager, open source on GitHub. Built for the kind of person who copies twelve things in a row and needs them all back later.',
    screenshots: [],
  },
  {
    slug: 'whoscored-plus',
    name: 'WhoScored Plus',
    tagline: 'AI-assisted match analysis for one of the biggest football stats sites.',
    status: 'professional-work',
    division: 'professional-credential',
    links: {},
    tech: ['AI', 'Subscriptions', 'Sports Analytics'],
    metrics: [],
    story:
      'An AI-assisted analysis product shipped to the high-volume WhoScored audience. Part of a suite architected for rapid experimentation on pricing, bundles and content surfaces.',
    screenshots: [],
  },
  {
    slug: 'oddschecker-plus',
    name: 'Oddschecker Plus',
    tagline: 'AI-assisted analysis tools for the UK betting comparison leader.',
    status: 'professional-work',
    division: 'professional-credential',
    links: {},
    tech: ['AI', 'Subscriptions', 'Sports Analytics'],
    metrics: [],
    story:
      'AI-assisted analysis tools shipped to the Oddschecker audience. Charlie previously led the frontend rebrand of the Oddschecker website through an 800x traffic surge, so this is home turf.',
    screenshots: [],
  },
  {
    slug: 'gazzetta-ai-predictor',
    name: 'Gazzetta AI Predictor',
    tagline: 'AI match predictions for La Gazzetta dello Sport readers.',
    status: 'professional-work',
    division: 'professional-credential',
    links: {},
    tech: ['AI', 'Sports Analytics'],
    metrics: [],
    story:
      'An AI prediction product shipped to the readership of La Gazzetta dello Sport, one of the biggest sports titles in Europe. Built as part of a suite of AI-assisted sports analysis tools serving high-volume audiences.',
    screenshots: [],
  },
  {
    slug: 'ai-native-qa',
    name: 'AI-Native QA Systems',
    tagline: 'AI-driven browser automation with Playwright.',
    status: 'professional-work',
    division: 'professional-credential',
    links: {},
    tech: ['Playwright', 'AI Testing', 'Browser Automation', 'CI/CD'],
    metrics: [],
    story:
      'Playwright-based testing systems augmented with AI: tests that understand what they are looking at, not just what they are clicking. Built early as a productivity layer and shipped into production before most teams were paying attention.',
    screenshots: [],
  },
];
