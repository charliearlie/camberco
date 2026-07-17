// ---------------------------------------------------------------------------
// Pure CRM domain logic: enum/email/uuid validators, money conversion, KPI
// maths, enquiry -> client prefill, and the per-table write allowlists used by
// the admin API routes.
//
// This module has NO Supabase client, NO secrets and NO side effects, so it is
// safe to import from both server API routes and client <script> islands, and
// it is fully unit-testable (see crm.test.ts). The write-allowlist parsers are
// the mass-assignment guard: routes build DB objects only from what these
// return, never from the raw request body.
// ---------------------------------------------------------------------------

// ----- Enums ---------------------------------------------------------------

export const CLIENT_STATUSES = ['lead', 'active', 'past', 'archived'] as const;
export const CLIENT_SOURCES = ['enquiry', 'referral', 'direct'] as const;
export const PROJECT_STATUSES = [
  'lead',
  'proposal',
  'active',
  'on_hold',
  'completed',
  'cancelled',
] as const;
// The "open pipeline" set: leads, proposals and active engagements.
export const OPEN_PROJECT_STATUSES = ['lead', 'proposal', 'active'] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export type ClientSource = (typeof CLIENT_SOURCES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export function isClientStatus(v: unknown): v is ClientStatus {
  return typeof v === 'string' && (CLIENT_STATUSES as readonly string[]).includes(v);
}
export function isClientSource(v: unknown): v is ClientSource {
  return typeof v === 'string' && (CLIENT_SOURCES as readonly string[]).includes(v);
}
export function isProjectStatus(v: unknown): v is ProjectStatus {
  return typeof v === 'string' && (PROJECT_STATUSES as readonly string[]).includes(v);
}
export function isOpenProjectStatus(status: unknown): boolean {
  return typeof status === 'string' && (OPEN_PROJECT_STATUSES as readonly string[]).includes(status);
}

// ----- Length caps ---------------------------------------------------------

export const LIMITS = {
  name: 200,
  company: 200,
  email: 320,
  phone: 50,
  website: 500,
  summary: 500,
  projectName: 200,
  description: 5000,
  notes: 20000,
  noteBody: 20000,
} as const;

// Largest value we will store, in pence. 21 million pounds is comfortably above
// any realistic engagement and safely inside a 32-bit signed integer column.
export const MAX_VALUE_PENCE = 2_100_000_000;

// ----- Primitive validators ------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidEmail(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length <= LIMITS.email && EMAIL_RE.test(v.trim());
}

export function normaliseEmail(v: string): string {
  return v.trim().toLowerCase();
}

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

export function isIsoDate(v: unknown): boolean {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  // Reject impossible dates that JS would roll over (e.g. 2026-02-31).
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// ----- Money ---------------------------------------------------------------

// Parse a user-entered pounds amount (from a form field) into integer pence.
// Accepts numbers or strings such as "1,234.50" / "£1234". Returns null for an
// empty/absent value and clamps negatives to 0. Used by the UI before POST.
export function poundsToPence(pounds: unknown): number | null {
  if (pounds === '' || pounds === null || pounds === undefined) return null;
  const n =
    typeof pounds === 'number' ? pounds : parseFloat(String(pounds).replace(/[£,\s]/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n * 100));
}

export function penceToPounds(pence: number | null | undefined): number | null {
  return pence === null || pence === undefined ? null : pence / 100;
}

// Format integer pence as a currency string. GBP renders with a £ symbol and
// grouped thousands ("£1,234.50"); other currencies render as "USD 1,234.50".
// Deterministic (no Intl/ICU dependency) so it is stable across environments.
export function penceToGBP(pence: number | null | undefined, currency = 'GBP'): string {
  if (pence === null || pence === undefined) return '—';
  const negative = pence < 0;
  const abs = Math.abs(pence);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = (abs % 100).toString().padStart(2, '0');
  const body = currency === 'GBP' ? `£${whole}.${cents}` : `${currency} ${whole}.${cents}`;
  return negative ? `-${body}` : body;
}

// ----- KPI maths -----------------------------------------------------------

export interface PipelineProject {
  status: string;
  value_pence: number | null;
  currency: string | null;
}

// Sum the value of open projects (lead/proposal/active). Null values count as
// 0. Only GBP rows are summed; any open non-GBP project is counted separately
// so the UI can note that it was excluded rather than mixing currencies.
export function sumOpenPipelinePence(projects: PipelineProject[]): {
  pence: number;
  nonGbpOpenCount: number;
} {
  let pence = 0;
  let nonGbpOpenCount = 0;
  for (const p of projects) {
    if (!isOpenProjectStatus(p.status)) continue;
    if ((p.currency ?? 'GBP') !== 'GBP') {
      nonGbpOpenCount++;
      continue;
    }
    pence += p.value_pence ?? 0;
  }
  return { pence, nonGbpOpenCount };
}

// ----- Enquiry -> Client prefill -------------------------------------------

export interface EnquiryLike {
  name?: string | null;
  company?: string | null;
  email?: string | null;
}

// Map an enquiry onto the fields used to seed a new client. Email is lowercased
// (the dedupe key); source is fixed to 'enquiry'.
export function enquiryToClientPrefill(enq: EnquiryLike): {
  name: string;
  company: string | null;
  email: string | null;
  source: ClientSource;
} {
  const name = (enq.name ?? '').trim();
  const company = enq.company ? String(enq.company).trim() || null : null;
  const rawEmail = enq.email ? String(enq.email).trim() : '';
  return {
    name: name || 'Unknown',
    company,
    email: rawEmail ? normaliseEmail(rawEmail) : null,
    source: 'enquiry',
  };
}

// ----- Server-owned derivation ---------------------------------------------

// completed_at is derived from status server-side, never accepted from the
// client. Returns undefined when status is absent (leave the column untouched),
// an ISO timestamp when status is 'completed', or null otherwise (clears it).
export function deriveCompletedAt(
  status: string | undefined,
  now: Date = new Date(),
): string | null | undefined {
  if (status === undefined) return undefined;
  return status === 'completed' ? now.toISOString() : null;
}

// ----- Write allowlists (mass-assignment guard) ----------------------------

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}
function fail(error: string): ParseResult<never> {
  return { ok: false, error };
}

function has(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key);
}
function cleanStr(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : raw === null || raw === undefined ? '' : String(raw).trim();
}

function parseEmail(raw: unknown, errors: string[]): string | null {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (s === '') return null;
  if (!isValidEmail(s)) {
    errors.push('A valid email is required.');
    return null;
  }
  return normaliseEmail(s);
}

function parseEnum<T extends string>(
  raw: unknown,
  guard: (v: unknown) => v is T,
  dflt: T,
  label: string,
  errors: string[],
): T {
  if (raw === undefined || raw === null || raw === '') return dflt;
  if (guard(raw)) return raw;
  errors.push(`Invalid ${label}.`);
  return dflt;
}

function parseCurrency(raw: unknown, errors: string[]): string {
  if (raw === undefined || raw === null || raw === '') return 'GBP';
  const s = String(raw).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(s)) {
    errors.push('Invalid currency code (expected a 3-letter code).');
    return 'GBP';
  }
  return s;
}

function parseDate(raw: unknown, label: string, errors: string[]): string | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const s = String(raw).trim();
  if (!isIsoDate(s)) {
    errors.push(`Invalid ${label} (expected YYYY-MM-DD).`);
    return null;
  }
  return s;
}

// Coerce an incoming value_pence (already pence from the UI) to a non-negative
// integer or null. Rejects non-numbers, non-integers, negatives and overflow.
export function coerceValuePence(raw: unknown): ParseResult<number | null> {
  if (raw === undefined || raw === null || raw === '') return ok(null);
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return fail('value_pence must be a number.');
  if (!Number.isInteger(n)) return fail('value_pence must be a whole number of pence.');
  if (n < 0) return fail('value_pence must be non-negative.');
  if (n > MAX_VALUE_PENCE) return fail('value_pence is too large.');
  return ok(n);
}

function capped(value: string | null, cap: number, label: string, errors: string[]): string | null {
  if (value !== null && value.length > cap) errors.push(`${label} exceeds ${cap} characters.`);
  return value;
}

// --- clients ---

export interface ClientInsert {
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  status: ClientStatus;
  source: ClientSource;
  summary: string | null;
}

export function parseClientCreate(body: Record<string, unknown>): ParseResult<ClientInsert> {
  const errors: string[] = [];

  const name = cleanStr(body.name);
  if (!name) return fail('Name is required.');
  if (name.length > LIMITS.name) return fail(`Name exceeds ${LIMITS.name} characters.`);

  const email = parseEmail(body.email, errors);
  const status = parseEnum(body.status, isClientStatus, 'lead', 'status', errors);
  const source = parseEnum(body.source, isClientSource, 'direct', 'source', errors);
  const company = capped(cleanStr(body.company) || null, LIMITS.company, 'Company', errors);
  const phone = capped(cleanStr(body.phone) || null, LIMITS.phone, 'Phone', errors);
  const website = capped(cleanStr(body.website) || null, LIMITS.website, 'Website', errors);
  const summary = capped(cleanStr(body.summary) || null, LIMITS.summary, 'Summary', errors);

  if (errors.length) return fail(errors[0]);
  return ok({ name, company, email, phone, website, status, source, summary });
}

export function parseClientUpdate(
  body: Record<string, unknown>,
): ParseResult<Partial<ClientInsert>> {
  const errors: string[] = [];
  const out: Partial<ClientInsert> = {};

  if (has(body, 'name')) {
    const name = cleanStr(body.name);
    if (!name) return fail('Name cannot be empty.');
    if (name.length > LIMITS.name) return fail(`Name exceeds ${LIMITS.name} characters.`);
    out.name = name;
  }
  if (has(body, 'email')) out.email = parseEmail(body.email, errors);
  if (has(body, 'status')) {
    if (!isClientStatus(body.status)) return fail('Invalid status.');
    out.status = body.status;
  }
  if (has(body, 'source')) {
    if (!isClientSource(body.source)) return fail('Invalid source.');
    out.source = body.source;
  }
  if (has(body, 'company')) out.company = capped(cleanStr(body.company) || null, LIMITS.company, 'Company', errors);
  if (has(body, 'phone')) out.phone = capped(cleanStr(body.phone) || null, LIMITS.phone, 'Phone', errors);
  if (has(body, 'website')) out.website = capped(cleanStr(body.website) || null, LIMITS.website, 'Website', errors);
  if (has(body, 'summary')) out.summary = capped(cleanStr(body.summary) || null, LIMITS.summary, 'Summary', errors);

  if (errors.length) return fail(errors[0]);
  if (Object.keys(out).length === 0) return fail('No updatable fields provided.');
  return ok(out);
}

// --- projects ---

export interface ProjectInsert {
  client_id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  value_pence: number | null;
  currency: string;
  start_date: string | null;
  due_date: string | null;
  notes: string | null;
}

export function parseProjectCreate(body: Record<string, unknown>): ParseResult<ProjectInsert> {
  const errors: string[] = [];

  if (!isUuid(body.client_id)) return fail('A valid client_id is required.');
  const client_id = body.client_id as string;

  const name = cleanStr(body.name);
  if (!name) return fail('Project name is required.');
  if (name.length > LIMITS.projectName) return fail(`Project name exceeds ${LIMITS.projectName} characters.`);

  const status = parseEnum(body.status, isProjectStatus, 'lead', 'status', errors);
  const currency = parseCurrency(body.currency, errors);
  const start_date = parseDate(body.start_date, 'start_date', errors);
  const due_date = parseDate(body.due_date, 'due_date', errors);
  const description = capped(cleanStr(body.description) || null, LIMITS.description, 'Description', errors);
  const notes = capped(cleanStr(body.notes) || null, LIMITS.notes, 'Notes', errors);
  const value = coerceValuePence(body.value_pence);
  if (!value.ok) errors.push(value.error);

  if (errors.length) return fail(errors[0]);
  return ok({
    client_id,
    name,
    description,
    status,
    value_pence: value.ok ? value.value : null,
    currency,
    start_date,
    due_date,
    notes,
  });
}

// Update never accepts client_id (a project cannot be reparented via the API).
export function parseProjectUpdate(
  body: Record<string, unknown>,
): ParseResult<Partial<Omit<ProjectInsert, 'client_id'>>> {
  const errors: string[] = [];
  const out: Partial<Omit<ProjectInsert, 'client_id'>> = {};

  if (has(body, 'name')) {
    const name = cleanStr(body.name);
    if (!name) return fail('Project name cannot be empty.');
    if (name.length > LIMITS.projectName) return fail(`Project name exceeds ${LIMITS.projectName} characters.`);
    out.name = name;
  }
  if (has(body, 'status')) {
    if (!isProjectStatus(body.status)) return fail('Invalid status.');
    out.status = body.status;
  }
  if (has(body, 'currency')) out.currency = parseCurrency(body.currency, errors);
  if (has(body, 'start_date')) out.start_date = parseDate(body.start_date, 'start_date', errors);
  if (has(body, 'due_date')) out.due_date = parseDate(body.due_date, 'due_date', errors);
  if (has(body, 'description')) out.description = capped(cleanStr(body.description) || null, LIMITS.description, 'Description', errors);
  if (has(body, 'notes')) out.notes = capped(cleanStr(body.notes) || null, LIMITS.notes, 'Notes', errors);
  if (has(body, 'value_pence')) {
    const value = coerceValuePence(body.value_pence);
    if (!value.ok) errors.push(value.error);
    else out.value_pence = value.value;
  }

  if (errors.length) return fail(errors[0]);
  if (Object.keys(out).length === 0) return fail('No updatable fields provided.');
  return ok(out);
}

// --- notes ---

export interface NoteCreate {
  body: string;
  client_id: string | null;
  project_id: string | null;
}

export function parseNoteCreate(body: Record<string, unknown>): ParseResult<NoteCreate> {
  const text = cleanStr(body.body);
  if (!text) return fail('Note body is required.');
  if (text.length > LIMITS.noteBody) return fail(`Note exceeds ${LIMITS.noteBody} characters.`);

  let client_id: string | null = null;
  if (body.client_id !== undefined && body.client_id !== null && body.client_id !== '') {
    if (!isUuid(body.client_id)) return fail('A valid client_id is required.');
    client_id = body.client_id as string;
  }

  let project_id: string | null = null;
  if (body.project_id !== undefined && body.project_id !== null && body.project_id !== '') {
    if (!isUuid(body.project_id)) return fail('A valid project_id is required.');
    project_id = body.project_id as string;
  }

  if (!client_id && !project_id) return fail('A client_id or project_id is required.');
  return ok({ body: text, client_id, project_id });
}
