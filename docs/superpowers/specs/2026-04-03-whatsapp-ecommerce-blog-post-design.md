# Blog Post Design Spec: WhatsApp + Ecommerce AI Automation

## Context

Camber Co needs to start building SEO-driven blog content to attract SMB owners looking for AI automation services. This is the first blog post — a flagship practitioner guide that demonstrates expertise without revealing implementation details. The goal is lead generation: show what's possible so prospects reach out for help.

## Content Summary

**Title:** "How AI-Powered WhatsApp Automation is Transforming Small Ecommerce Businesses"
**Format:** Practitioner guide (problem-solution arc)
**Audience:** Non-technical SMB ecommerce owners
**Tone:** Authoritative but accessible. Show expertise, don't give away recipes.
**Length:** ~1,200-1,500 words (6-7 min read)
**Category:** Automation
**Tags:** AI automation, WhatsApp, ecommerce, small business, workflow automation

## Post Structure

### 1. Hook / Introduction (~150 words)
- Open with the pain of running a small ecommerce store manually
- The promise: "What if your phone could run your store?"

### 2. The Problem (~250 words)
- Manual product uploading is tedious and error-prone
- Order notifications get missed or delayed
- Customer enquiries pile up outside business hours
- Small teams can't afford dedicated ops staff
- Frame as a **scaling bottleneck**, not a tech problem

### 3. The Solution: WhatsApp as Your Operations Hub (~300 words)
Three key workflows described at outcome level (no implementation details):
- **Product Publishing:** Photo + description via WhatsApp -> product goes live on website
- **Order Notifications:** Customer places order -> instant WhatsApp alert with details
- **Customer Comms:** Automated responses to common queries, human escalation for complex ones

### 4. How It Works — The Architecture (~200 words + diagram)
One workflow diagram showing named tools but no configuration:

```
WhatsApp Business API -> Automation Platform -> AI Processing (GPT/Claude) -> Ecommerce Platform
                                                       |
                                                       v
                                              Notification (WhatsApp back)
```

- Use generic terms: "Automation Platform" not n8n, "Ecommerce Platform" not WooCommerce
- Emphasise reliability and 24/7 operation
- Diagram built as inline SVG/HTML to match site design (not a screenshot)

### 5. Results & What This Means for Your Business (~200 words)
- Generic but credible outcomes: hours saved per week, faster response times, reduced errors
- Competitive advantage framing for small businesses
- "Previously required a dev team and enterprise budget — now accessible to any business"

### 6. CTA / Closing (~100 words)
- "Curious how this could work for your store?"
- Link to `/contact`
- Mention Camber Co builds these automations for SMBs

## SEO & Metadata

- **Slug:** `how-ai-whatsapp-automation-transforms-small-ecommerce`
- **Meta description (155 chars):** "Discover how small ecommerce businesses use AI-powered WhatsApp automation to publish products, manage orders, and respond to customers — all from their phone."
- **Target keywords:** whatsapp ecommerce automation, automate online store whatsapp, AI automation small business, whatsapp order notifications
- **Featured:** Yes (first/flagship post)
- **Cover image:** Stylised phone with WhatsApp + website mockup, matching site's dark aesthetic

## Technical Implementation

### Publishing method
Use the existing Supabase-backed CMS:
1. Create a new record in `blog_drafts` table via the admin API (`POST /api/admin/drafts`)
2. Set all metadata fields (title, slug, description, category, tags, cover_image, cover_image_alt, featured)
3. Set content as HTML (matching TipTap output format)
4. Publish via `POST /api/admin/publish` (triggers Vercel rebuild)

### Diagram approach
Build the workflow diagram as an inline SVG embedded in the blog post HTML content. Style it to match the site's dark theme and design tokens from `src/styles/tokens.css`.

### Files involved
- `src/pages/api/admin/drafts.ts` — API to create the draft
- `src/pages/api/admin/publish.ts` — API to publish
- `src/pages/blog/[slug].astro` — renders the post (existing, no changes needed)
- `src/layouts/Layout.astro` — handles SEO meta (existing, no changes needed)
- `src/lib/blog.ts` — fetches posts and processes HTML (existing, no changes needed)

### Internal linking
- CTA links to `/contact`
- Author bio links to `/about-me`
- Future posts can back-link to this as the foundational automation case study

## Verification

1. Create draft via API and verify it appears in admin dashboard (`/admin/`)
2. Check content renders correctly in the editor (`/admin/editor/[id]`)
3. Publish and verify:
   - Post appears at `/blog/how-ai-whatsapp-automation-transforms-small-ecommerce/`
   - Blog index shows it as featured
   - SVG diagram renders correctly
   - Meta tags and JSON-LD structured data are correct (check page source)
   - RSS feed includes the new post (`/rss.xml`)
   - Sitemap is updated
4. Test on mobile for responsive layout of the diagram
