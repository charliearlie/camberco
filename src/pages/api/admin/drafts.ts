export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

function serverSupabase() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL ?? '';
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function verifyAuth(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  const supabase = serverSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ----------------------------------------------------------------
// GET — list drafts
// ----------------------------------------------------------------

export const GET: APIRoute = async ({ request, url }) => {
  const userId = await verifyAuth(request);
  if (!userId) return jsonRes({ error: 'Unauthorized.' }, 401);

  const supabase = serverSupabase();
  const id = url.searchParams.get('id');

  if (id) {
    // Single draft with all fields
    const { data, error } = await supabase
      .from('blog_drafts')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) return jsonRes({ error: error.message }, error.code === 'PGRST116' ? 404 : 500);
    return jsonRes({ draft: data });
  }

  const { data, error } = await supabase
    .from('blog_drafts')
    .select('id, title, slug, status, category, updated_at, created_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) return jsonRes({ error: error.message }, 500);
  return jsonRes({ drafts: data });
};

// ----------------------------------------------------------------
// POST — create draft
// ----------------------------------------------------------------

export const POST: APIRoute = async ({ request }) => {
  const userId = await verifyAuth(request);
  if (!userId) return jsonRes({ error: 'Unauthorized.' }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // empty body is fine for a blank new draft
  }

  const supabase = serverSupabase();
  const { data, error } = await supabase
    .from('blog_drafts')
    .insert({
      user_id: userId,
      title: body.title ?? 'Untitled',
      slug: body.slug ?? '',
      description: body.description ?? '',
      category: body.category || 'ai-strategy',
      tags: body.tags ?? [],
      cover_image: body.cover_image ?? null,
      cover_image_alt: body.cover_image_alt ?? null,
      content: body.content ?? '',
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) return jsonRes({ error: error.message }, 500);
  return jsonRes({ id: data.id }, 201);
};

// ----------------------------------------------------------------
// PUT — update draft
// ----------------------------------------------------------------

export const PUT: APIRoute = async ({ request }) => {
  const userId = await verifyAuth(request);
  if (!userId) return jsonRes({ error: 'Unauthorized.' }, 401);

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonRes({ error: 'Invalid JSON body.' }, 400);
  }

  const { id, ...updates } = body as { id?: string } & Record<string, unknown>;
  if (!id) return jsonRes({ error: 'Draft id required.' }, 400);

  const supabase = serverSupabase();
  const { data, error } = await supabase
    .from('blog_drafts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .single();

  if (error?.code === 'PGRST116') return jsonRes({ error: 'Draft not found.' }, 404);
  if (error) return jsonRes({ error: error.message }, 500);

  // Trigger redeploy if the saved post is published
  const { data: post } = await supabase
    .from('blog_drafts')
    .select('status')
    .eq('id', id)
    .single();

  if (post?.status === 'published') {
    const deployHook = import.meta.env.VERCEL_DEPLOY_HOOK ?? '';
    if (deployHook) {
      fetch(deployHook, { method: 'POST' }).catch(() => {});
    }
  }

  return jsonRes({ ok: true });
};

// ----------------------------------------------------------------
// DELETE — remove draft
// ----------------------------------------------------------------

export const DELETE: APIRoute = async ({ request, url }) => {
  const userId = await verifyAuth(request);
  if (!userId) return jsonRes({ error: 'Unauthorized.' }, 401);

  const id = url.searchParams.get('id');
  if (!id) return jsonRes({ error: 'Draft id required.' }, 400);

  const supabase = serverSupabase();
  const { error } = await supabase
    .from('blog_drafts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) return jsonRes({ error: error.message }, 500);
  return jsonRes({ ok: true });
};
