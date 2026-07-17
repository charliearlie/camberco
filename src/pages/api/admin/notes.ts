export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { isUuid, parseNoteCreate } from '../../../lib/crm';

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

// ----------------------------------------------------------------
// POST — add a timeline note to a client (optionally scoped to a project)
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

  const parsed = parseNoteCreate(body);
  if (!parsed.ok) return jsonRes({ error: parsed.error }, 400);

  const supabase = serverSupabase();
  let clientId = parsed.value.client_id;
  const projectId = parsed.value.project_id;

  // When a project is supplied, derive the owning client from it server-side so
  // a note can never be attached to another client's project.
  if (projectId) {
    const { data: project, error } = await supabase
      .from('projects')
      .select('client_id')
      .eq('id', projectId)
      .single();

    // A genuine backend error must surface as 500; only a real zero-row / null
    // result is a 404. (.single() nulls data on any error, so check error first.)
    if (error && error.code !== 'PGRST116') return jsonRes({ error: 'Failed to load project.' }, 500);
    if (!project) return jsonRes({ error: 'Project not found.' }, 404);

    if (clientId && clientId !== project.client_id) {
      return jsonRes({ error: 'Project does not belong to that client.' }, 400);
    }
    clientId = project.client_id;
  }

  if (!clientId) return jsonRes({ error: 'A client_id or project_id is required.' }, 400);

  // Verify the client exists so a bad id is a clean 404, not a raw FK 500.
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('id')
    .eq('id', clientId)
    .single();
  if (clientErr && clientErr.code !== 'PGRST116') return jsonRes({ error: 'Failed to load client.' }, 500);
  if (!client) return jsonRes({ error: 'Client not found.' }, 404);

  const { data, error } = await supabase
    .from('client_notes')
    .insert({ client_id: clientId, project_id: projectId, body: parsed.value.body })
    .select('id, body, project_id, client_id, created_at')
    .single();

  if (error?.code === '23503') return jsonRes({ error: 'Client or project not found.' }, 400);
  if (error || !data) return jsonRes({ error: 'Failed to add note.' }, 500);
  return jsonRes({ note: data }, 201);
};

// ----------------------------------------------------------------
// DELETE — remove a timeline note
// ----------------------------------------------------------------

export const DELETE: APIRoute = async ({ request, url }) => {
  const auth = await verifyAuth(request);
  if (!auth.ok) return jsonRes({ error: auth.error }, auth.status);

  const id = url.searchParams.get('id');
  if (!isUuid(id)) return jsonRes({ error: 'Invalid note id.' }, 400);

  const supabase = serverSupabase();
  const { error } = await supabase.from('client_notes').delete().eq('id', id);
  if (error) return jsonRes({ error: 'Failed to delete note.' }, 500);
  return jsonRes({ ok: true });
};
