// Single source of truth for Charlie's professional experience.
// Consumed by the about-me career timeline (full history, git-log style) and
// the /work enterprise-experience section (featured roles only).
// `summary` is the git-log-style line used on about-me; `highlight` is the
// clean one-liner used on the /work cards.

export interface Experience {
  hash: string;
  date: string;
  company: string;
  companySlug: string;
  title: string;
  summary: string;
  highlight: string;
  body: string[];
  tags: string[];
  tag?: string;
  featured: boolean;
}

export const experience: Experience[] = [
  {
    hash: 'a4f9d2c',
    date: 'Jan 2024 — Present',
    company: 'Fairplay Sports Media',
    companySlug: 'fairplay',
    title: 'Tech Lead, Subscriptions',
    summary: 'feat(career): helped scale revenue-generating subscription products',
    highlight:
      'Lead the frontend for global subscriptions and run production AI agent fleets across the business.',
    body: [
      'Launched and scaled revenue-generating subscription products as part of a wider career helping generate millions in revenue across consumer platforms.',
      'Lead the frontend strategy for the global subscriptions team, balancing new commercial features with the modernisation of a 15-year-old legacy stack.',
      'AI advocate within the business — designing and deploying agents in n8n + ADK to automate internal workflows.',
      'Architect scalable frontend solutions that let marketing iterate quickly on pricing and bundles.',
    ],
    tags: ['Tech Lead', 'AI Agents', 'n8n', 'Subscriptions', 'Legacy Modernisation'],
    tag: 'tech-lead',
    featured: true,
  },
  {
    hash: '8c2b1a7',
    date: 'Oct 2022 — Jan 2024',
    company: 'Trainline',
    companySlug: 'trainline',
    title: 'Senior Web Engineer',
    summary: 'feat(a11y): full screen-reader-compliant booking flow',
    highlight:
      'Shipped a fully screen-reader-compliant booking flow for one of Europe\'s largest rail platforms.',
    body: [
      'Maintained and enhanced the web infrastructure for one of Europe\'s largest rail platforms.',
      'Spearheaded critical accessibility improvements, enabling a fully compliant end-to-end booking flow for screen reader users.',
      'Implemented Playwright for automated E2E testing across the platform — significantly reducing regression defects in production.',
      'On-call rotation, resolving high-priority customer issues to keep service running.',
    ],
    tags: ['Playwright', 'Accessibility', 'CI/CD', 'On-call'],
    tag: 'senior-eng',
    featured: true,
  },
  {
    hash: '3f1e7b9',
    date: 'Feb 2021 — Oct 2022',
    company: 'Just Eat Takeaway',
    companySlug: 'just-eat',
    title: 'Senior Web Engineer',
    summary: 'feat(i18n): unified global checkout — 500k+ daily users',
    highlight:
      'Built the unified global checkout used by 500,000+ customers a day across international markets.',
    body: [
      'Pivotal in building a unified global checkout used by 500,000+ customers daily across international markets.',
      'Led the i18n of core components, enabling expansion into new territories with bespoke language and currency requirements.',
      'Devised and ran rigorous A/B tests on checkout flows — directly impacting Gross Transaction Value.',
      'Mentored junior engineers and led code reviews in a high-traffic environment.',
    ],
    tags: ['i18n', 'A/B Testing', 'Checkout', 'Mentorship'],
    featured: true,
  },
  {
    hash: 'b29c4a1',
    date: 'Jul 2019 — Feb 2021',
    company: 'Oddschecker',
    companySlug: 'oddschecker',
    title: 'Senior Frontend Developer',
    summary: 'feat(launch): scaled UK + US sites through 800x traffic surge',
    highlight:
      'Led the frontend rebrand and scaled the site through an 800x traffic surge to 400,000+ daily users.',
    body: [
      'Led the frontend rebrand of the Oddschecker website — handled a traffic surge from 500 unique views to 400,000+ daily.',
      'Oversaw the US site launch and growth strategy, scaling from 60 daily users to a peak of 400,000.',
      'Established consistent dev processes and a component library — reducing tech debt and speeding feature delivery.',
      'Managed the frontend release lifecycle through periods of explosive concurrent traffic.',
    ],
    tags: ['Frontend Lead', 'Component Library', 'Release Management'],
    featured: true,
  },
  {
    hash: 'e7d34f2',
    date: 'Oct 2017 — Jan 2019',
    company: 'BBC (Editorial Services)',
    companySlug: 'bbc',
    title: 'Web Developer',
    summary: 'feat: video catalogue + EPG scheduling tools',
    highlight:
      'Built the internal tools running the BBC\'s entire online video catalogue and EPG scheduling.',
    body: [
      'Developed critical internal software managing the BBC\'s entire online video content library and EPG scheduling.',
      'Delivered robust, scalable tools supporting digital content delivery for internal production teams and external partners.',
    ],
    tags: ['Internal Tooling', 'Content Systems'],
    featured: true,
  },
  {
    hash: '5a08b6d',
    date: 'Jul 2016 — Oct 2017',
    company: 'Blue Bridge Solutions',
    companySlug: 'blue-bridge',
    title: 'Junior Full Stack Developer',
    summary: 'feat: web POS system with SQL Server reporting',
    highlight:
      'Designed a web-based point-of-sale system with complex SQL Server reporting.',
    body: [
      'Designed a web-based point-of-sale system in AngularJS + C# ASP.NET, including complex reporting features over SQL Server data.',
      'Managed the full application lifecycle — translating client business requirements into technical solutions.',
    ],
    tags: ['AngularJS', 'C#', 'SQL Server', 'Full Stack'],
    featured: false,
  },
  {
    hash: '0000000',
    date: '2013 — 2016',
    company: 'University of Plymouth',
    companySlug: 'plymouth',
    title: 'BSc Computer Science (2:1)',
    summary: 'root-commit: where it started',
    highlight: 'BSc Computer Science (2:1), with a first-class final year project.',
    body: [
      'BSc Computer Science, University of Plymouth (2:1).',
      'First-class grade on final year project. Academic Award of Excellence (Plymouth University & BCS).',
      '2012 — 2013: Cornwall College — Access to Computing (Distinction). Academic Award of Excellence for distinctions in all modules.',
    ],
    tags: ['Computer Science', '2:1', 'Awards'],
    tag: 'root-commit',
    featured: false,
  },
];
