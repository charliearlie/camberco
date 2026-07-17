# Build prompt: Camber Co internal CRM dashboard

You are a senior full-stack engineer. Build a lightweight internal CRM dashboard for **Camber Co** (an AI automation consultancy) inside its existing website codebase. The owner, Charlie, will be the only user. Build it to a genuinely high standard: production quality, secure, accessible, tested, and visually consistent with the existing admin area.

You have the **Supabase MCP** connected to this project's database (you can inspect the schema, run SQL, and apply migrations). You also have full filesystem and shell access to the repo at `/Users/charlie/workspace/camber-co`.

---

## 0. Non-negotiable rules (read first, do not violate)

These are the invariants that matter most. The rest of the document elaborates, but if anything below conflicts with a convenience elsewhere, these win.

1. **Escape all user-controlled data before rendering.** Enquiry data comes from a **public** form, so `name`, `email`, `company`, `message`, and the entire `chat_transcript` are attacker-controlled. Client fields and note bodies are user-entered too. The admin pages build HTML with template strings and `innerHTML`. Every user-controlled value MUST be passed through `escapeHtml` (or set via `textContent`) before it touches `innerHTML`. The admin session token is stored in `localStorage` and in a **non-httpOnly** cookie, so a single unescaped field is a stored-XSS account takeover. Treat this as the top priority. Escape `chat_transcript` (nested JSON) field by field.
2. **Authenticate AND authorise.** A valid Supabase session is not enough — other auth users may exist. Every gate must also check the user is Charlie (see section 3).
3. **Never expose the service-role key client-side.** It lives only in API routes and middleware. Client code uses the anon client plus bearer-token calls. No `PUBLIC_`-prefixed copy, no import into any `<script>`.
4. **Mutations authenticate via the `Authorization: Bearer` header only** — never via the cookie. This keeps them CSRF-safe.
5. **Build DB update objects from an explicit per-table allowlist.** Never spread the raw request body into an `update()`/`insert()`.
6. **The new CRM tables have no `user_id` column.** Do not copy the `user_id` scoping from `drafts.ts` (see section 6).

---

## 1. Mission

Turn the current thin `/admin` area into a connected CRM with four surfaces:

- **Overview** (`/admin`) — an at-a-glance hub with KPIs and recent activity.
- **Enquiries** (`/admin/enquiries`) — already exists; extend it.
- **Clients** (`/admin/clients`) — new.
- **Projects** (`/admin/projects`) — new; a "project" is a **client engagement** (a piece of paid work), not a marketing portfolio item.

The three record types form a pipeline: **Enquiry → Client → Project**. It must feel like one connected tool, not three disconnected lists. An enquiry can be converted into a client in one click (prefilled from the enquiry); projects belong to clients; a client's page shows their enquiries, projects, and an activity timeline together.

> **Important distinction.** The marketing site has a portfolio in `src/data/projects.ts` (Football IQ, Jodz, etc.). That is Charlie's own product portfolio and is **out of scope**. Do not touch it, do not migrate it, do not merge it with the CRM `projects` table. The CRM `projects` table is client engagements only.

---

## 2. The codebase you are building into

- **Framework:** Astro 5. Output is **static by default** — `astro.config.mjs` sets the `@astrojs/vercel` adapter but no `output: 'server'`. Every dynamic page and API route opts into on-demand rendering with `export const prerender = false`. **Do not change the adapter or add `output: 'server'`;** just set `prerender = false` on each new dynamic page/route (as `login.astro`, `drafts.ts`, etc. already do).
- **UI:** Mostly `.astro` pages with vanilla `<script>` islands. React 19 (`@astrojs/react`) exists for the blog editor (Tiptap), but the admin list/detail pages are plain Astro + TypeScript `<script>`. **Match that pattern** (see the enquiries page); do not introduce a React app for these screens.
- **Data layer:** `@supabase/supabase-js` v2.
- **Tests:** Vitest. Test files live beside their source as `*.test.ts`.
- **Package manager:** pnpm. Dev: `pnpm dev`. Test: `pnpm test`. Build: `pnpm build`.
- **Env loading:** scripts run with `node --env-file=.env`. Never print env values.

**Read these files first to internalise the conventions before writing anything:**

- `src/middleware.ts` — server-side gate for `/admin/*`.
- `src/lib/admin-guard.ts` — admin path rules + the session cookie name.
- `src/lib/supabase.ts` — the browser (anon) client.
- `src/pages/admin/login.astro` — the login flow.
- `src/components/admin/AdminLayout.astro` — the shared admin shell (top bar, theme toggle, fonts).
- `src/pages/admin/index.astro` — current dashboard home (blog drafts list). You will restructure this.
- `src/pages/admin/enquiries.astro` — **the reference for a list + detail + status pipeline. Copy its structure and its inline-style conventions.** Note its `statusBadge` is a pill (use that one, not the plain-span version in `index.astro`).
- `src/pages/api/enquiries.ts` — **the reference for a DB-backed API route on a non-owned table** (no `user_id` scoping). Follow this for CRM data access.
- `src/pages/api/admin/drafts.ts` — the reference **only** for the auth plumbing (`verifyAuth`, `jsonRes`, the service-role client) and the multi-verb route shape. **Do not** copy its `.eq('user_id', userId)` scoping — that exists because `blog_drafts` has a `user_id` column and the CRM tables do not.
- `src/styles/tokens.css` — the full design-token system.
- `supabase/migrations/20260710090001_create_blog_drafts.sql` — the **current** migration style to follow (idempotent `create table if not exists public.x`, `create index if not exists`, 14-digit `YYYYMMDDHHMMSS` filename). Do not copy the older `20260317_create_enquiries.sql` style (non-idempotent, 8-digit name).

---

## 3. Auth model (reuse exactly — do NOT reinvent)

There is a **single admin user** in Supabase Auth (email/password). You are extending this model, not replacing it.

- **Browser side:** `src/lib/supabase.ts` exports an anon-key client. Login calls `supabase.auth.signInWithPassword`, persists a session in `localStorage`, and writes the access token into a cookie named `camber-admin-token` (`ADMIN_SESSION_COOKIE`).
- **Page gating:** `src/middleware.ts` intercepts every `/admin/*` request (except `/admin/login` and `/admin/auth/callback`), reads the cookie, and validates it with a **service-role** client via `supabase.auth.getUser(token)`. Any new page under `/admin` is gated automatically.
- **API gating:** authenticated API routes read `Authorization: Bearer <token>`, validate with a service-role `supabase.auth.getUser(token)`, and return the user id (the `verifyAuth` helper in `drafts.ts`). Every new admin API route must call this and return `401` before touching the DB.
- **Client → API pattern:** a page's `<script>` gets the token via `supabase.auth.getSession()` and sends it as a bearer header. The API route uses the **service-role client** for all DB work.

### Add authorisation, not just authentication

`verifyAuth` and the middleware currently accept **any** valid Supabase user. Because other auth users may exist, add an **admin allowlist check**: after `getUser`, verify the user's email equals the configured admin email (`charlie@camberco.co.uk`), otherwise return `401`/`403`. Pin the admin identity to an env var (reuse/add e.g. `ADMIN_EMAIL`) rather than hardcoding a string in many places. Apply this in the shared `verifyAuth` used by the new CRM routes (and, ideally, in the middleware). Authentication alone is insufficient.

### Create the single sign-in

Ensure exactly one admin login exists for **`charlie@camberco.co.uk`** with a strong password, and deliver the password to Charlie safely.

Write a one-off script `scripts/ensure-admin-user.mjs` using `@supabase/supabase-js` with the **service-role key** (`process.env.SUPABASE_SERVICE_ROLE_KEY`, `process.env.PUBLIC_SUPABASE_URL`) and the auth admin API:

- **Reliable lookup:** paginate `auth.admin.listUsers` until you find `charlie@camberco.co.uk` (do not assume it is on page 1). As a safety net, if `createUser` returns an "email already registered" error, fall back to update so a duplicate can never be created.
- **Idempotent by default (no silent rotation):** if the user does **not** exist, `createUser({ email, password, email_confirm: true })` with a freshly generated strong password (20+ chars, mixed classes). If the user **already** exists, do **not** change the password unless the script is run with an explicit `--rotate` flag; re-running without `--rotate` should be a no-op that reports "user already exists". (Rotating silently on every run would invalidate a password already delivered and lock Charlie out.)
- **Deliver the secret safely:** when a password is generated, write it to a **git-ignored** file (e.g. `.admin-credentials.local`) with restricted permissions, and print only a line telling Charlie where to find it. Do **not** print the password to stdout (it would land in the agent transcript / shell scrollback / logs). Confirm the file is covered by `.gitignore`. Never print or commit the service-role key.
- **Preserve the blog author link.** `blog_drafts.user_id` references the admin user's id, and the DB was recently rebuilt. If you have to **create** the user fresh (rather than update an existing one), any existing `blog_drafts` rows will have a stale `user_id` and the blog list will render empty. In that case, reassign existing `blog_drafts.user_id` to the new user id (report how many rows you updated). Prefer updating an existing user so the id is preserved.
- If you find **other** auth users besides Charlie's, do not delete them silently — list their emails and ask Charlie first.

Run with `node --env-file=.env scripts/ensure-admin-user.mjs`.

---

## 4. Database

**Existing tables** (do not break): `blog_drafts`, `enquiries`, `subscribers`, `rate_limits`. All have **RLS enabled with no policies** — access is service-role only. `enquiries` columns: `id, name, email, company, service, message, source ('form'|'bot'), chat_transcript jsonb, status ('new'|'contacted'|'booked'|'closed'), created_at, updated_at`.

**Migration conventions:** idempotent plain-SQL files in `supabase/migrations/`, named `YYYYMMDDHHMMSS_description.sql`, applied via the Supabase MCP. Use `create table if not exists public.x`, `create index if not exists`, `check` constraints for enums, then `alter table ... enable row level security` (no policies — service-role only). Follow `20260710090001_create_blog_drafts.sql`.

Create the following. **Index every foreign key.** Enable RLS on every new table with no public policies.

### `clients`
| column | type | notes |
|---|---|---|
| `id` | uuid pk | `default gen_random_uuid()` |
| `name` | text not null | contact person |
| `company` | text | business name |
| `email` | text | store **lowercased**; validate format on write |
| `phone` | text | |
| `website` | text | |
| `status` | text not null default `'lead'` | check in (`'lead'`,`'active'`,`'past'`,`'archived'`) |
| `source` | text not null default `'direct'` | check in (`'enquiry'`,`'referral'`,`'direct'`) |
| `summary` | text | freeform one-line summary (this is NOT the activity timeline) |
| `created_at` | timestamptz | `default now()` |
| `updated_at` | timestamptz | `default now()` |

Indexes: `status`; and a **case-insensitive unique** email index: `create unique index if not exists clients_email_unique on public.clients (lower(email)) where email is not null;` (prevents duplicate clients on conversion).

### `projects` (client engagements)
| column | type | notes |
|---|---|---|
| `id` | uuid pk | `default gen_random_uuid()` |
| `client_id` | uuid not null | `references clients(id) on delete cascade` |
| `name` | text not null | |
| `description` | text | |
| `status` | text not null default `'lead'` | check in (`'lead'`,`'proposal'`,`'active'`,`'on_hold'`,`'completed'`,`'cancelled'`) |
| `value_pence` | integer | contract value in **pence** (avoid floats); nullable; non-negative |
| `currency` | text not null default `'GBP'` | |
| `start_date` | date | nullable |
| `due_date` | date | nullable |
| `completed_at` | timestamptz | nullable; set **server-side** when status becomes `completed` |
| `notes` | text | freeform |
| `created_at` | timestamptz | `default now()` |
| `updated_at` | timestamptz | `default now()` |

Indexes: `client_id`, `status`.

### `client_notes` (activity timeline)
Named `client_notes` (not `notes`) to avoid confusion with the freeform `summary`/`notes` columns above.
| column | type | notes |
|---|---|---|
| `id` | uuid pk | `default gen_random_uuid()` |
| `client_id` | uuid not null | `references clients(id) on delete cascade` |
| `project_id` | uuid | `references projects(id) on delete set null`; nullable (a deleted project keeps its notes on the client timeline) |
| `body` | text not null | |
| `created_at` | timestamptz | `default now()` |

Indexes: `client_id`, `project_id`, `created_at`.

### `enquiries` change
Add `client_id uuid references clients(id) on delete set null` (nullable) — links an enquiry to the client it was converted into. Deleting a client nulls this, it does not delete enquiries. **Index `enquiries.client_id`.**

Do **not** add a new enquiry status value. Use `client_id IS NOT NULL` as the "converted" marker (see KPIs below).

### `updated_at` maintenance
Add a shared trigger function and `BEFORE UPDATE` triggers on `clients` and `projects` so `updated_at` is always current:
```sql
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger clients_set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
```
`client_notes` is append-only and needs no trigger.

---

## 5. Pages and behaviour

Use `AdminLayout` for every page. Follow the enquiries page's structure for lists, detail panels, filter tabs, status badges, empty/loading/error states, and responsive column collapsing. Headings follow the terminal style (`$ camber admin --clients`, etc.).

**Top-bar nav.** Update `AdminLayout` so every admin page shows this persistent link set, in order: **overview, enquiries, clients, projects, blog, settings, back to site.** Preserve the existing `settings` link — that page handles logout. Do not drop any existing link.

### 5.1 Overview (`/admin`)
Restructure the current home (which lists blog drafts) into a proper overview:

- **KPI tiles:**
  - **New enquiries** = count where `status = 'new' AND client_id IS NULL` (converted enquiries must not count as new).
  - **Active clients** = count where `status = 'active'`.
  - **Open projects** = count where `status IN ('lead','proposal','active')`. (Label it "open projects", matching the pipeline metric — not "active", since it includes leads/proposals.)
  - **Open pipeline value** = sum of `value_pence` for projects where `status IN ('lead','proposal','active')`. supabase-js cannot `SUM` directly: select the `value_pence` values, `COALESCE` null to 0, and sum in JS (or use a small Postgres view/RPC). Sum only `currency = 'GBP'` rows and render as GBP; if any non-GBP projects exist, note that they are excluded rather than summing mixed currencies.
- **Recent enquiries** — the 5 most recent by `created_at desc`, linking into the enquiries page. Show a "converted → client" badge on any with `client_id` set.
- **Active/open projects** — the 5 most recent by `created_at desc`, linking into project detail.
- Clear links to Clients, Projects, Enquiries, and Blog.

**Preserve the blog admin.** The drafts list + "new post" flow currently on `/admin` must move to a new **`/admin/blog`** page (move its markup and script verbatim — they already work), update the "+ new post" link and references, and leave `/admin/editor` and `/admin/editor/[id]` untouched. The blog editor must still work exactly as before.

### 5.2 Enquiries (`/admin/enquiries`) — extend
- Keep the existing list, detail panel, status pipeline, and chat-transcript view. **Ensure every rendered enquiry field and every transcript message is `escapeHtml`-ed** (verify the existing code does this; if any path uses `textContent` keep it, if it uses `innerHTML` it must escape).
- Add a **"Convert to client"** action in the detail panel with this exact flow:
  1. If the enquiry already has `client_id`, skip creation and just navigate to that client (idempotent — re-clicking never duplicates).
  2. Otherwise call `POST /api/admin/clients` with `{ from_enquiry_id }`. The route: looks up an existing client by `lower(email)`; if found, links the enquiry to it and returns that client; if not, creates a client prefilled from the enquiry (`name`, `company`, lowercased `email`, `source = 'enquiry'`), sets `enquiries.client_id`, and returns the new client. Response returns `{ client, created: boolean }` so the UI can navigate deterministically.
  3. Offer, as a separate optional step after the client resolves, to create a first project via `POST /api/admin/projects` (prefilled `client_id`).
- Show the linked-client link in the enquiry detail once set.

### 5.3 Clients (`/admin/clients`) — new
- List with search (name/company/email) and a status filter (lead/active/past/archived), matching the enquiries filter-tab pattern.
- Create and edit via a form (validate + lowercase email, trim, sensible length caps).
- **Client detail** shows the client's fields (editable), their **linked enquiries**, their **projects** (status + value), and the **activity timeline** from `client_notes` (add a note; newest first). All rendered values escaped.
- Delete with a confirmation that clearly states it will also delete the client's projects and timeline notes (cascade) and unlink its enquiries.

### 5.4 Projects (`/admin/projects`) — new
- List with a status filter and a client filter. Show client name, status, value (GBP), due date.
- Create/edit: pick a client, name, description, status, value (**entered in pounds in the UI, stored as `value_pence`**), currency (default GBP), start/due dates, notes.
- Detail shows everything plus the parent-client link and project-scoped timeline notes.
- Setting status to `completed` sets `completed_at` **server-side** (do not accept it from the client).

---

## 6. API routes

Create authenticated routes. Borrow **only** `verifyAuth`, `jsonRes`, and the service-role client from `drafts.ts`; for DB access follow **`enquiries.ts`**, which queries **without** any `user_id` filter (single-admin model; these tables have no `user_id` column). Set `export const prerender = false`.

- `src/pages/api/admin/clients.ts` — `GET` (list; `?id=` returns one client **with** its enquiries, projects, and timeline notes), `POST` (create; supports `from_enquiry_id` for the conversion flow in 5.2), `PUT` (update), `DELETE`.
- `src/pages/api/admin/projects.ts` — `GET` (list; `?id=` single; `?client_id=` filter), `POST`, `PUT`, `DELETE`.
- `src/pages/api/admin/notes.ts` — `POST` (add a timeline note to a client, optionally scoped to a project), `DELETE`.

Requirements for **every** route:
- Call `verifyAuth` (with the admin allowlist check from section 3) and return `401` before any DB access.
- **Authenticate via the `Authorization: Bearer` header only** — never the cookie.
- **Explicit column allowlist.** Build the `insert`/`update` object by picking only the columns that table exposes (e.g. clients: `name, company, email, phone, website, status, source, summary`). **Never** spread the raw body. Never accept `id`, `created_at`, `updated_at`, `completed_at`, or (on update) `client_id` from the body. Derive `completed_at` from `status` server-side.
- **Validate input:** trim strings, enforce length caps, validate enum values (reject unknown `status`/`source` with `400`), validate + lowercase email, coerce `value_pence` to a non-negative integer, and validate that any incoming `id`/foreign-key param (`from_enquiry_id`, `client_id`, `project_id`) is a well-formed UUID (`400` if malformed). Map FK-violation / not-found DB errors to a clean `400`/`404`, not a raw `500`.
- For `notes`: verify the supplied `project_id` (if any) belongs to the supplied `client_id` — or derive `client_id` from the project server-side — so a note can't attach to another client's project.
- Use the service-role client (server-side only). Return typed JSON matching the existing routes' shape.

---

## 7. Design and UX bar

- **Aesthetic:** the established terminal style — dark surfaces, green primary (`--color-green-500`), pink secondary, `JetBrains Mono` for labels/headings, `Inter` for body, lowercase `small-caps` column labels, `$ camber admin --x` headings. Study the enquiries page and match it.
- **Resolving tokens vs copied markup:** when you copy reference markup from the enquiries page (error banner, table, detail panel), **copy it as-is including its inline styles** — do not get blocked trying to tokenise working reference code. The **tokens-only** rule (`src/styles/tokens.css` for every colour/space/radius/font/timing, no new hardcoded hex/px) applies to **new** styles you author. Existing values that already have a token equivalent may stay as copied; new code must use tokens.
- **Both themes:** the admin supports light and dark via `data-theme`. Using tokens makes this automatic — verify both themes (contrast, borders, badges).
- **Status colours:** give each status enum a consistent badge colour (reuse the enquiries pill `statusBadge`). Never rely on colour alone — always include the status text.
- **States:** every list has loading, empty, and error states (reuse the existing error-banner markup). Forms show inline validation errors and disable submit while saving.
- **Accessibility:** semantic headings, `<label>` per input, `aria-label` on icon-only buttons, visible keyboard focus, full keyboard operability, respect `prefers-reduced-motion`. Detail panels/dialogs are keyboard-reachable and dismissible.
- **Responsive:** collapse columns like the enquiries table on mobile; detail grids stack; no horizontal scroll.
- **Copy:** British English. **No em dashes** in any UI copy (house rule). Plain, clear labels.
- **Forgiving UX:** confirm destructive actions, update the UI on success, surface failures rather than swallowing them.

---

## 8. Engineering standards

- **TypeScript**, following the existing style. **Note the helper convention:** `formatDate`, `escapeHtml`, and `statusBadge` are **duplicated inline** in each page's `<script>` (there is no shared module), and `verifyAuth`/`jsonRes`/`serverSupabase` are copied per API file. Follow that convention — copy the implementations from `enquiries.astro` (use its pill `statusBadge`) and `drafts.ts` into each new file. Do **not** hunt for a shared lib and do **not** refactor the existing files into one (out of scope).
- **Escaping (restating rule 0.1):** every user-controlled value rendered into `innerHTML` must be `escapeHtml`-ed or set via `textContent`. This includes all enquiry fields, the full chat transcript, all client fields, project fields, and note bodies.
- **Tests (Vitest, colocated `*.test.ts`).** Cover the risky logic:
  - money formatting (pence ↔ GBP), pipeline-value summation (null → 0, GBP-only), enquiry→client prefill + email-lowercasing/dedupe mapping, enum validators, email validation, UUID validation.
  - API input handling: unknown enum → 400, missing required field → 400, absent/invalid token → 401, a **forbidden/unexpected body field is ignored, not written** (mass-assignment guard), malformed UUID → 400.
  - Keep tests meaningful; no assertion-free tests.
- **Security (see section 0):** service-role key server-only; every admin route authenticates + authorises first; new tables RLS-enabled, no public policies; no secrets logged or committed. Keep server-only helpers (`serverSupabase`, `verifyAuth`) out of any file imported by a client `<script>`. As a guardrail, add a check (test or a `pnpm build` post-step) that greps the built client output for `SUPABASE_SERVICE_ROLE_KEY` / the key value and fails if found.
- **Env:** do not rename existing env vars (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_*`, `RESEND_API_KEY`, `VERCEL_DEPLOY_HOOK`); add `ADMIN_EMAIL` if you use it for the allowlist. This Supabase project accepts **legacy JWT keys only** (new-format `sb_publishable_`/`sb_secret_` keys are rejected) — do not swap key formats.
- **Migrations** forward-only, idempotent, via the Supabase MCP, in `supabase/migrations/` with 14-digit timestamps.
- Run `pnpm test` and `pnpm build`; both must be green before you are done.

---

## 9. Suggested build order

1. Read the reference files in section 2. Confirm you understand the auth flow, the enquiries page pattern, and the `user_id` caveat.
2. Write and apply the migrations (clients, projects, client_notes, enquiries.client_id, updated_at triggers, indexes). Verify with the Supabase MCP.
3. Build the API routes with allowlist + validation + tests.
4. Build Clients, then Projects, then the enquiry conversion flow, then the Overview restructure (and the `/admin/blog` move). Update the `AdminLayout` nav.
5. Add the admin allowlist to `verifyAuth`. Write `ensure-admin-user.mjs` and create Charlie's login.
6. Self-verify against the acceptance checklist. Run tests and build.

---

## 10. Acceptance criteria

- [ ] Login at `/admin/login` as `charlie@camberco.co.uk` works; logged-out `/admin/*` redirects to login; a non-admin auth user is rejected by the allowlist.
- [ ] Overview KPIs correct: new enquiries exclude converted ones; "open projects" and "open pipeline value" (GBP) use the `lead`/`proposal`/`active` set; recent enquiries show a converted badge.
- [ ] Blog drafts list and editor still work, now under `/admin/blog`, linked from the top bar; existing drafts still appear (author id preserved or reassigned).
- [ ] Top bar shows overview, enquiries, clients, projects, blog, settings, back to site — nothing dropped.
- [ ] Clients: list + search + status filter + create + edit + delete; detail shows linked enquiries, projects, and the timeline; email stored lowercase; duplicate email blocked.
- [ ] Projects: list + filters + create/edit/delete; value entered in pounds, stored as pence, shown as GBP; `completed` sets `completed_at` server-side.
- [ ] Convert to client: prefills + links, reuses an existing client on email match, is idempotent on re-click, and can spin up a first project.
- [ ] Deleting a client cascades projects + timeline notes and nulls enquiries' `client_id`, with a confirmation that says so; deleting a project keeps its notes on the client timeline.
- [ ] Every admin API route returns 401 without a valid admin token; enum/field/UUID validation returns 400; unexpected body fields are ignored (no mass assignment); mutations use the bearer header only.
- [ ] All user-controlled data (enquiry fields, chat transcript, client/project/note text) is escaped in every render.
- [ ] No service-role key in any client bundle (guard check passes); new tables RLS-enabled with no public policies.
- [ ] Both themes render correctly; keyboard nav and focus states work; no horizontal scroll on mobile.
- [ ] `pnpm test` and `pnpm build` are green.
- [ ] Charlie's admin password delivered via the git-ignored credentials file; no secrets printed or committed.

## 11. Deliverables

- The migrations, API routes, pages, nav updates, and tests described above.
- A short summary of what you built, how to run it, the acceptance-checklist results, and any decisions/follow-ups.
- The admin password for `charlie@camberco.co.uk`, delivered once via the git-ignored file, out of version control.

## 12. Do NOT

- Rebuild the auth system, the middleware, or the design tokens. Reuse them.
- Copy `drafts.ts`'s `user_id` scoping onto the CRM tables (they have no `user_id`).
- Spread the raw request body into DB writes, or accept server-owned fields (`id`, timestamps, `completed_at`, `client_id` on update) from the client.
- Render any user-controlled data without escaping.
- Touch the marketing site or `src/data/projects.ts` (the product portfolio is separate from CRM projects).
- Put the service-role key anywhere client-side; print or commit the admin password / any secret.
- Rename env vars or switch Supabase key formats.
- Break the existing enquiries page or blog editor — extend them.
- Add public RLS policies to the new tables, or add external services / send emails without asking.
