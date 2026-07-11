# Camber Co Site Elevation - Design Spec

Date: 2026-07-10
Status: Approved approach, pending spec review
Owner: Charlie W
Scope decision: Option A, proof-first elevation (approved 2026-07-09)

## Context

An eight-lens audit (content/conversion, technical SEO, email flows, demos, business docs, portfolio, live site, UK market research) found a technically strong site with commercial leaks: no social proof, the free audit offer absent from every conversion point, pricing hidden from humans but published in JSON-LD, four of seven services with no crawlable page, canonical-domain mismatch (apex vs www), a stalled blog, and email sends that can silently fail on Vercel serverless.

Decisions locked in with Charlie:

1. Scope: full proof-first elevation (this spec).
2. Pricing: publish visible "from £X" anchors matching the schema.
3. Positioning: honest specialist. "The AI consultant who builds." No "go-to UK consultant" claims until proof exists.
4. Booking: Cal.com. Charlie creates the account and event; CTAs route to /contact with audit framing until the link exists.

## Goals

- Convert more of the existing traffic: every page ends in a clear, credible next step.
- Show proof: a real product showcase with screenshots, metrics and named work.
- Demonstrate value interactively: demos that quantify time and money saved, not just look good.
- Never lose a lead: reliable email alerts for every signup and enquiry.
- Be findable: fix SEO plumbing, add missing pages, be citable by AI assistants.

## Non-goals (deliberately out of scope)

- Nurture sequences beyond a single welcome email.
- Resend Audiences migration (list stays in Supabase).
- CAPTCHA/Turnstile (honeypot plus durable rate limiting is enough for now).
- YouTube channel, programmatic location pages, paid ads setup (covered in the GTM plan as later plays).
- Any redesign of the visual language. The terminal aesthetic stays; copy gets de-jargoned where it does decision-making work.

## Canonical service taxonomy

Used verbatim on homepage cards, /services grid, contact chips, chat drawer prompts and schema:

| Service | Page | From-price (visible + schema) |
|---|---|---|
| Workflow automation | /services/automation (exists) | from £1,200 |
| Website builds | /services/builds (exists) | from £2,500 * |
| Mobile apps | /services/apps (exists) | from £4,500 * |
| AI consultations | /services/consultations (new) | £297 per session |
| SEO services | /services/seo (new) | from £750 * |
| Training & coaching | /services/training (new) | from £197 solo, £1,500 team workshops |
| Personal AI | /services/personal-ai (new) | from £497 |

Entry offer, distinct from the free call: **AI Readiness Audit, £750** (paid half-day assessment with written report). The **free 30-minute audit call** is the site-wide CTA and is always described as free, no pitch. Copy must never conflate the two.

Prices marked * have no prior source in schema or docs and are proposed from UK market norms; Charlie confirms or amends at spec review. All others match existing JSON-LD or docs/pricing-structure.md. JSON-LD offers must be updated to exactly match the visible prices (add the missing three, keep the existing four).

## Workstream 1: Messaging and positioning

- Tagline everywhere (hero sub, footer, schema slogan): "The AI consultant who builds."
- Hero: outcome-led headline as real rendered text, largest type on the page: "Get 10-30 hours a month back. I build the AI systems that do your repetitive work." Typewriter animation retained as decoration above/behind it, progressive enhancement over real text (also fixes the JS-only H1 SEO issue).
- Primary CTA site-wide: "Book a free 30-minute audit". Secondary: "Chat about it" (drawer).
- Day job owned as scarcity: about page and homepage FAQ state "I take a small number of clients each quarter" and drop any copy that implies full-time availability. "I lead every project personally" stays (it is true).
- Fix trust drift: EST. year aligned with schema foundingDate (2024), one LinkedIn URL everywhere, Gmail replaced with hello@camberco.co.uk on about page.
- New /privacy page (data collected, use, retention, contact; company number) linked from footer. One-line consent note under newsletter and contact forms.
- De-jargon decision-surface copy: CTAs, form labels, section headings, FAQ answers in plain English. Terminal styling reserved for decoration and demos. "No toy generator." line cut.

## Workstream 2: Conversion fixes

- Homepage service cards: primary action links to the service page, chat is secondary. The homepage grid shows all seven services (Mobile apps added as a seventh card, matching /services).
- Four new service pages following the automation.astro pattern (unique title/description/canonical, Service JSON-LD, FAQ section, from-price, audit CTA, internal links):
  - /services/consultations: entry-point product page, angled at "AI consultant London" queries. What you get in 60 minutes, £297, booking CTA.
  - /services/seo: also fixes "sells SEO with no SEO page". Targets "SEO for small businesses UK".
  - /services/training: solo founder sessions (£197) and team workshops (from £1,500).
  - /services/personal-ai: OpenClaw personal AI setup, from £497.
- Service page H1s rewritten as outcomes: automation "Stop doing the same work twice. Workflows that run themselves."; apps "From idea to App Store without a dev team."; builds keeps "Websites that make the offer obvious."
- The 10-30 hours/month claim moves into the automation page hero and homepage proof strip.
- Contact page: restate the free audit ("Every enquiry gets a free 30-minute audit call - no pitch"), a three-step what-happens-next block (reply within 24h, audit call, proposal), proof block, mailto fallback.
- Stats server-rendered with real values ("40+") and animated from zero on scroll. The "£m+" stat is removed and replaced with a Camber-specific stat (e.g. "hours automated per month across live workflows") unless Charlie supplies a defensible figure at spec review.
- Chatbot prompt updated: allowed to state the published from-prices, knows the shipped products and the /work page, never invents discounts.
- Blog index: slim CTA band after the featured post ("Reading about automation is free. So is the 30-minute audit call.").

## Workstream 3: /work showcase (Camber Builds)

- New page /work, added to Nav and Footer. Branded header: "Camber Builds - the product division of Camber Co. Apps and websites, designed, built and shipped."
- Single source of truth `src/data/projects.ts` consumed by /work, about-me.astro, services/apps.astro, services/builds.astro and about-terminal.ts. Shape:

```ts
type Project = {
  slug: string; name: string; tagline: string;
  status: 'live' | 'in-submission' | 'in-development' | 'open-source' | 'professional-work';
  division: 'camber-builds' | 'professional-credential';
  links: { appStore?: string; github?: string; web?: string };
  tech: string[];
  metrics: { label: string; value: string }[]; // only honest, confirmed numbers
  story: string; // problem, what was built, outcome
  screenshots: string[]; // paths under src/assets/projects/
  ogImage?: string;
};
```

- Products: Football IQ (live, App Store badge, MobileApplication JSON-LD, storefront-neutral link), Jodz, bio-core, ClipPin (GitHub link), WhoScored Plus, Oddschecker Plus, Gazzetta AI Predictor (each a named entry with the professional-work status pill so they read as credentials, not client claims), AI-Native QA Systems folded into the professional credentials section.
- Screenshots pulled from the App Store listing and live product pages where possible; gaps filled by Charlie into src/assets/projects/. Device-frame presentation reusing the phone-frame styling from services/apps.
- Football IQ metrics pulled from PostHog (org "Football IQ") - only numbers Charlie approves for publication.
- services/builds.astro: fictional "Northstar Studio" mock replaced by real work (this site, bio-core) or labelled "Illustration" in the window chrome.
- Homepage builds card gains a proof strip ("Shipped: Football IQ, WhoScored Plus, ...") linking to /work.
- Tech naming standardised once in projects.ts (Supabase, not PostgreSQL-vs-Supabase drift).

## Workstream 4: Interactive demos

- **ROI calculator** (automation page + homepage section): three sliders (hours/week of manual admin, average hourly cost £, people doing it), computes hours and pounds saved per month and year using a visible, configurable assumption (default: automation recovers 70% of manual time; stated on-screen as "assumes automation handles ~70% of this work"). Reuses the existing counter animation. CTA "Email me this estimate" posts to /api/enquiries with the inputs in the message body. Honeypot included. Reduced motion: values update instantly, no count-up.
- **Industry switcher** on the existing automation SVG demo: buttons for Trades / Agency / E-commerce / Clinic swap node labels, status lines and tooltip config strings via a data map. Engine unchanged. Example (Trades): "Quote request received -> AI drafts estimate -> Job booked in calendar -> Invoice sent".
- **Before/after race**: split panel, "Manual" side ticks through 7 steps with a running clock (typewriter primitive), "Automated" side completes in seconds (counter primitive). Play button, replay, static side-by-side end-state for reduced motion.
- **Terminal autopilot**: extract shared engine to src/scripts/terminal-engine.ts (kills the ~500-line duplication between terminal.ts and about-terminal.ts), add a scripted replay mode: `demo inbox` command types itself and shows an agent triaging email ("3 new emails -> classified -> invoice logged -> reply drafted").
- **Free fixes**: scroll-reveal CSS moved to static stylesheet (currently a silent no-op on the homepage and a flash on service pages); starfield switched to named imports plus dynamic import only when dark theme and motion allowed, RAF paused when canvas is invisible (light theme or scrolled past ~1.5 viewports, render one static frame); builds page mock gets a before/after toggle; apps quiz grows to 4-5 visitor-facing questions, emoji dropped.
- **Chat drawer**: persistent floating affordance on service pages, 2-3 suggested prompt chips in the empty state ("I run a trades business...", "What could you automate for an agency?"), focus trapped while open, focus restored on close, `inert` on hidden state.

## Workstream 5: Email system

- Owner alert to charlie@camberco.co.uk on every confirmed newsletter subscription (sent from confirm-subscription.ts after the update succeeds).
- Welcome email to the subscriber on confirmation: intro, three best posts, soft CTA to /contact.
- Reliability: every Resend send wrapped in `waitUntil()` from @vercel/functions (enquiry admin alert, visitor auto-reply, confirmation, welcome, digest). No more fire-and-forget after response.
- reply_to: admin notifications get reply_to set to the enquirer's email; visitor auto-replies get reply_to hello@camberco.co.uk.
- Digest: Resend batch API (100 per call), List-Unsubscribe and List-Unsubscribe-Post headers, last_sent_at tracked on subscribers.
- Confirm/unsubscribe converted to pages with a button that POSTs the state change (emailed GET links become idempotent), fixing scanner-prefetch corruption. Unsubscribe becomes soft delete (status='unsubscribed', unsubscribed_at); digest filters on confirmed AND active.
- Rate limiting moved to a Supabase table keyed on IP + window (5/hr forms, 30/hr chat), replacing in-memory maps that reset per cold start.
- Chat-sourced enquiries validated like form enquiries (EMAIL_RE, length caps); bot echoes the email back for confirmation before submitting.
- Migrations checked in for subscribers and blog_drafts (match live schema, unique email index, RLS enabled like enquiries).
- .env.example completed: RESEND_API_KEY, PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, VERCEL_DEPLOY_HOOK, OPENAI_API_KEY, OPENAI_MODEL. FROM_EMAIL/ADMIN_EMAIL centralised in src/lib/email.ts.

## Workstream 6: SEO package

- Canonical host: apex camberco.co.uk becomes the primary domain in Vercel (www 308s to apex), matching every existing canonical, sitemap URL and schema @id. Verified with curl post-change; sitemap resubmitted in Search Console. (Charlie action or CLI, guided.)
- Trailing slash: normalised to no-trailing-slash ("trailingSlash": false in vercel.json), canonicals derived from Astro.url + Astro.site in Layout.astro instead of hand-typed strings; Nav/Footer hrefs aligned.
- public/llms.txt: one-paragraph description (London AI automation consultancy for UK SMBs, run by Charlie), markdown links to /, all seven service pages, /work, /about-me, /blog and key posts, contact email, service and pricing summary. llms-full.txt with fuller service descriptions.
- OG: new 1200x630 default OG image (terminal aesthetic, tagline), width/height always emitted; product pages pass per-page ogImage; Organization logo dimensions fixed; Article publisher.logo points at the real logo.
- Blog: getPublishedPosts throws on Supabase error (build fails loudly); in-article images get loading="lazy" decoding="async" and dimensions; category pages only generated for categories with posts.
- Sitemap serialize hook adds lastmod (blog URLs map to updatedAt). RSS enriched with full content and author.
- Structured data nits: empty telephone removed, LocalBusiness image added, founding date and LinkedIn reconciled, FAQ schema text matches visible text, BreadcrumbList added to services/about/contact, prices in schema match visible prices.
- /admin gated by src/middleware.ts (server-side session check, redirect to /admin/login) with X-Robots-Tag: noindex on admin routes.
- New-page titles target researched keywords: consultations page "AI Consultant for Small Businesses in London | Camber Co"; automation title includes "n8n Workflow Automation for UK Small Businesses".

## Workstream 7: Go-to-market plan (phase 2, after build ships)

Delivered as a playbook artifact plus ready-to-use assets. Contents fixed by the market research:

1. LinkedIn founder-led system: 2-3 posts/week templates (build-in-public, before/after demos, honest-newcomer angle), 30-80 personalised touches/week playbook.
2. "Best AI automation agencies UK 2026" honest comparison post (includes competitors; the SERP is self-published listicles and is what AI assistants cite).
3. Google Business Profile setup checklist plus review-request flow after each project.
4. Directory listings: GoodFirms and DesignRush free tiers now, Clutch deferred until reviews exist; AutomationHire and n8n/Make partner directories as pipeline fill.
5. Partnership outreach templates: web agencies, accountants, business coaches, coworking spaces.
6. Content calendar: fortnightly cadence restart, weighted to case studies (Football IQ post is the template), problem-language posts ("automate lead follow-up for small business").
7. llms.txt/GEO checklist (mostly shipped by workstream 6).
8. Deferred Google Ads test plan: £500-1,500/month exact-match, only after proof assets exist; success criteria and negative keyword starter list.
9. First-clients bridge: early-client discount traded for case study and testimonial (per docs/pricing-structure.md), referral ask template.

## Inputs needed from Charlie (none block the build start)

- Cal.com account + event URL (until then, CTAs route to /contact with audit framing).
- Confirm or amend the three * prices (websites £2,500, apps £4,500, SEO £750).
- Approve which Football IQ metrics are publishable; provide audience-scale numbers for the Plus AI suite if desired.
- Any screenshots not obtainable from the App Store or live sites.
- Company registration number for /privacy.

## Acceptance criteria

- `astro build` passes; blog build fails loudly on Supabase error.
- Every public page has unique title, description, canonical (derived, apex, no trailing slash) and valid JSON-LD; visible prices match schema prices everywhere.
- All seven services reachable by crawlable links from homepage and /services; /work in nav; llms.txt served.
- A test newsletter signup produces: confirmation email, then on confirm a welcome email AND an owner alert; a test enquiry produces an admin alert with working reply_to and a visitor auto-reply. Verified in Resend logs.
- ROI calculator, industry switcher, before/after race, terminal autopilot all function with JS enabled, degrade gracefully with reduced motion, and the calculator's estimate email lands in enquiries.
- Homepage scroll-reveal animates; three.js no longer ships eagerly on light-theme/reduced-motion loads; RAF stops when starfield invisible.
- /admin redirects anonymous visitors to login server-side.
- No em dashes in any new copy; British English; short sentences; no filler.
