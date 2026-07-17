export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { deriveCompletedAt, isUuid, parseProjectCreate, parseProjectUpdate } from '../../../lib/crm';

// --- auth plumbing (copied per the house convention; see drafts.ts) ---------

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

const CLIENT_JOIN = '*, client:clients(id, name, company, email, status)';

// ----------------------------------------------------------------
// GET — list projects (?client_id= filter), or ?id= for one project
// ----------------------------------------------------------------

export const GET: APIRoute = async ({ request, url }) => {
  const auth = await verifyAuth(request);
  if (!auth.ok) return jsonRes({ error: auth.error }, auth.status);

  const supabase = serverSupabase();
  const id = url.searchParams.get('id');
  const clientId = url.searchParams.get('client_id');

  if (id) {
    if (!isUuid(id)) return jsonRes({ error: 'Invalid project id.' }, 400);

    const { data: project, error } = await supabase
      .from('projects')
      .select(CLIENT_JOIN)
      .eq('id', id)
      .single();

    if (error?.code === 'PGRST116') return jsonRes({ error: 'Project not found.' }, 404);
    if (error) return jsonRes({ error: 'Failed to fetch project.' }, 500);

    const { data: notes } = await supabase
      .from('client_notes')
      .select('id, body, created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: false });

    return jsonRes({ project, notes: notes ?? [] });
  }

  let query = supabase.from('projects').select(CLIENT_JOIN).order('created_at', { ascending: false });

  if (clientId) {
    if (!isUuid(clientId)) return jsonRes({ error: 'Invalid client id.' }, 400);
    query = query.eq('client_id', clientId);
  }

  const { data, error } = await query;
  if (error) return jsonRes({ error: 'Failed to fetch projects.' }, 500);
  return jsonRes({ projects: data ?? [] });
};

// ----------------------------------------------------------------
// POST — create a project
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

  const parsed = parseProjectCreate(body);
  if (!parsed.ok) return jsonRes({ error: parsed.error }, 400);

  // completed_at is derived from status server-side, never taken from the body.
  const insert = { ...parsed.value, completed_at: deriveCompletedAt(parsed.value.status) ?? null };

  const supabase = serverSupabase();
  const { data, error } = await supabase.from('projects').insert(insert).select(CLIENT_JOIN).single();

  // Foreign-key violation → the client_id does not exist.
  if (error?.code === '23503') return jsonRes({ error: 'Client not found.' }, 400);
  if (error || !data) return jsonRes({ error: 'Failed to create project.' }, 500);
  return jsonRes({ project: data }, 201);
};

// ----------------------------------------------------------------
// PUT — update a project
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

  if (!isUuid(body.id)) return jsonRes({ error: 'Invalid project id.' }, 400);
  const id = body.id as string;

  const parsed = parseProjectUpdate(body);
  if (!parsed.ok) return jsonRes({ error: parsed.error }, 400);

  const update: Record<string, unknown> = { ...parsed.value };
  // When status changes, derive completed_at server-side (set or clear).
  const completedAt = deriveCompletedAt(parsed.value.status);
  if (completedAt !== undefined) update.completed_at = completedAt;

  const supabase = serverSupabase();
  const { data, error } = await supabase
    .from('projects')
    .update(update)
    .eq('id', id)
    .select(CLIENT_JOIN)
    .single();

  if (error?.code === 'PGRST116') return jsonRes({ error: 'Project not found.' }, 404);
  if (error || !data) return jsonRes({ error: 'Failed to update project.' }, 500);
  return jsonRes({ project: data });
};

// ----------------------------------------------------------------
// DELETE — remove a project (its timeline notes stay on the client)
// ----------------------------------------------------------------

export const DELETE: APIRoute = async ({ request, url }) => {
  const auth = await verifyAuth(request);
  if (!auth.ok) return jsonRes({ error: auth.error }, auth.status);

  const id = url.searchParams.get('id');
  if (!isUuid(id)) return jsonRes({ error: 'Invalid project id.' }, 400);

  const supabase = serverSupabase();
  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) return jsonRes({ error: 'Failed to delete project.' }, 500);
  return jsonRes({ ok: true });
};
