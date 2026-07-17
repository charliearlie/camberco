export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import {
  enquiryToClientPrefill,
  isUuid,
  parseClientCreate,
  parseClientUpdate,
} from '../../../lib/crm';

// --- auth plumbing (copied per the house convention; see drafts.ts) ---------
// verifyAuth authenticates the bearer token AND authorises it against the admin
// allowlist: a valid Supabase session is not enough, the user must be Charlie.

const ADMIN_EMAIL = (import.meta.env.ADMIN_EMAIL ?? 'charlie@camberco.co.uk').toLowerCase();

function serverSupabase() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL ?? '';
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

type AuthResult = { ok: true; userId: string } | { ok: false; status: number; error: string };

async function verifyAuth(request: Request): Promise<AuthResult> {
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!token) return { ok: false, status: 401, error: 'Unauthorized.' };

  const supabase = serverSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401, error: 'Unauthorized.' };
  if ((data.user.email ?? '').toLowerCase() !== ADMIN_EMAIL) {
    return { ok: false, status: 403, error: 'Forbidden.' };
  }
  return { ok: true, userId: data.user.id };
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ----------------------------------------------------------------
// GET — list clients, or ?id= for one client with related records
// ----------------------------------------------------------------

export const GET: APIRoute = async ({ request, url }) => {
  const auth = await verifyAuth(request);
  if (!auth.ok) return jsonRes({ error: auth.error }, auth.status);

  const supabase = serverSupabase();
  const id = url.searchParams.get('id');

  if (id) {
    if (!isUuid(id)) return jsonRes({ error: 'Invalid client id.' }, 400);

    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (error?.code === 'PGRST116') return jsonRes({ error: 'Client not found.' }, 404);
    if (error) return jsonRes({ error: 'Failed to fetch client.' }, 500);

    const [enquiriesRes, projectsRes, notesRes] = await Promise.all([
      supabase
        .from('enquiries')
        .select('id, name, email, service, status, created_at')
        .eq('client_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('projects')
        .select('id, name, status, value_pence, currency, due_date, created_at')
        .eq('client_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('client_notes')
        .select('id, body, project_id, created_at')
        .eq('client_id', id)
        .order('created_at', { ascending: false }),
    ]);

    return jsonRes({
      client,
      enquiries: enquiriesRes.data ?? [],
      projects: projectsRes.data ?? [],
      notes: notesRes.data ?? [],
    });
  }

  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return jsonRes({ error: 'Failed to fetch clients.' }, 500);
  return jsonRes({ clients: data ?? [] });
};

// ----------------------------------------------------------------
// POST — create a client, or convert an enquiry (from_enquiry_id)
// ----------------------------------------------------------------

export const POST: APIRoute = async ({ request }) => {
  const auth = await verifyAuth(request);
  if (!auth.ok) return jsonRes({ error: auth.error }, auth.status);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonRes({ error: 'Invalid JSON.' }, 400);
  }

  const supabase = serverSupabase();

  // --- Conversion flow: create/link a client from an enquiry ---
  if (body.from_enquiry_id !== undefined) {
    if (!isUuid(body.from_enquiry_id)) return jsonRes({ error: 'Invalid enquiry id.' }, 400);
    const enquiryId = body.from_enquiry_id as string;

    const { data: enquiry, error: enqErr } = await supabase
      .from('enquiries')
      .select('id, name, email, company, client_id')
      .eq('id', enquiryId)
      .single();

    if (enqErr?.code === 'PGRST116') return jsonRes({ error: 'Enquiry not found.' }, 404);
    if (enqErr || !enquiry) return jsonRes({ error: 'Failed to load enquiry.' }, 500);

    // Already converted — return the linked client (idempotent, no duplicate).
    if (enquiry.client_id) {
      const { data: existing } = await supabase
        .from('clients')
        .select('*')
        .eq('id', enquiry.client_id)
        .single();
      if (existing) return jsonRes({ client: existing, created: false });
      // The linked client was deleted; fall through and re-create below.
    }

    const prefill = enquiryToClientPrefill(enquiry);

    // Reuse an existing client on a case-insensitive email match.
    if (prefill.email) {
      const { data: match } = await supabase
        .from('clients')
        .select('*')
        .eq('email', prefill.email)
        .maybeSingle();
      if (match) {
        await supabase.from('enquiries').update({ client_id: match.id }).eq('id', enquiryId);
        return jsonRes({ client: match, created: false });
      }
    }

    const { data: created, error: createErr } = await supabase
      .from('clients')
      .insert(prefill)
      .select('*')
      .single();

    // Lost a race on the unique email index: re-fetch and link instead.
    if (createErr?.code === '23505' && prefill.email) {
      const { data: match } = await supabase
        .from('clients')
        .select('*')
        .eq('email', prefill.email)
        .maybeSingle();
      if (match) {
        await supabase.from('enquiries').update({ client_id: match.id }).eq('id', enquiryId);
        return jsonRes({ client: match, created: false });
      }
    }
    if (createErr || !created) return jsonRes({ error: 'Failed to create client.' }, 500);

    await supabase.from('enquiries').update({ client_id: created.id }).eq('id', enquiryId);
    return jsonRes({ client: created, created: true }, 201);
  }

  // --- Direct create ---
  const parsed = parseClientCreate(body);
  if (!parsed.ok) return jsonRes({ error: parsed.error }, 400);

  const { data, error } = await supabase.from('clients').insert(parsed.value).select('*').single();

  if (error?.code === '23505') {
    return jsonRes({ error: 'A client with this email already exists.' }, 409);
  }
  if (error || !data) return jsonRes({ error: 'Failed to create client.' }, 500);
  return jsonRes({ client: data, created: true }, 201);
};

// ----------------------------------------------------------------
// PUT — update a client
// ----------------------------------------------------------------

export const PUT: APIRoute = async ({ request }) => {
  const auth = await verifyAuth(request);
  if (!auth.ok) return jsonRes({ error: auth.error }, auth.status);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonRes({ error: 'Invalid JSON.' }, 400);
  }

  if (!isUuid(body.id)) return jsonRes({ error: 'Invalid client id.' }, 400);
  const id = body.id as string;

  const parsed = parseClientUpdate(body);
  if (!parsed.ok) return jsonRes({ error: parsed.error }, 400);

  const supabase = serverSupabase();
  const { data, error } = await supabase
    .from('clients')
    .update(parsed.value)
    .eq('id', id)
    .select('*')
    .single();

  if (error?.code === '23505') {
    return jsonRes({ error: 'A client with this email already exists.' }, 409);
  }
  if (error?.code === 'PGRST116') return jsonRes({ error: 'Client not found.' }, 404);
  if (error || !data) return jsonRes({ error: 'Failed to update client.' }, 500);
  return jsonRes({ client: data });
};

// ----------------------------------------------------------------
// DELETE — remove a client (cascades projects + notes, nulls enquiries)
// ----------------------------------------------------------------

export const DELETE: APIRoute = async ({ request, url }) => {
  const auth = await verifyAuth(request);
  if (!auth.ok) return jsonRes({ error: auth.error }, auth.status);

  const id = url.searchParams.get('id');
  if (!isUuid(id)) return jsonRes({ error: 'Invalid client id.' }, 400);

  const supabase = serverSupabase();
  const { error } = await supabase.from('clients').delete().eq('id', id);
  if (error) return jsonRes({ error: 'Failed to delete client.' }, 500);
  return jsonRes({ ok: true });
};
