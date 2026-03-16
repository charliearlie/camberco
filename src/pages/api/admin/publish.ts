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

export const POST: APIRoute = async ({ request }) => {
  const userId = await verifyAuth(request);
  if (!userId) {
    return jsonRes({ error: 'Unauthorized.' }, 401);
  }

  let body: { draftId?: string } = {};
  try {
    body = (await request.json()) as { draftId?: string };
  } catch {
    return jsonRes({ error: 'Invalid JSON body.' }, 400);
  }

  const { draftId } = body;
  if (!draftId) return jsonRes({ error: 'draftId required.' }, 400);

  const supabase = serverSupabase();

  // Fetch draft
  const { data: draft, error: draftErr } = await supabase
    .from('blog_drafts')
    .select('*')
    .eq('id', draftId)
    .eq('user_id', userId)
    .single();

  if (draftErr || !draft) {
    return jsonRes({ error: 'Draft not found.' }, 404);
  }

  const title = (draft.title as string || '').trim();
  if (!title) {
    return jsonRes({ error: 'Cannot publish without a title.' }, 400);
  }

  const slug = (draft.slug as string || '').trim()
    || title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/^-+|-+$/g, '');

  // Update status + ensure slug is persisted
  const { error: updateErr } = await supabase
    .from('blog_drafts')
    .update({ status: 'published', slug, published_at: new Date().toISOString() })
    .eq('id', draftId)
    .eq('user_id', userId);

  if (updateErr) {
    return jsonRes({ error: 'Failed to update draft status.' }, 500);
  }

  // Trigger Vercel deploy hook (fire-and-forget)
  const deployHook = import.meta.env.VERCEL_DEPLOY_HOOK ?? '';
  if (deployHook) {
    fetch(deployHook, { method: 'POST' }).catch(() => {});
  }

  return jsonRes({ ok: true, slug });
};
