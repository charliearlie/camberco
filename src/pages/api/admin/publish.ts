export const prerender = false;

import type { APIRoute } from 'astro';
import { serverSupabase } from '../../../lib/blog';

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
    .single();

  if (draftErr || !draft) {
    return jsonRes({ error: 'Draft not found.' }, 404);
  }

  const slug = draft.slug || (draft.title as string).toLowerCase().replace(/\s+/g, '-');

  // Update status to published
  const { error: updateErr } = await supabase
    .from('blog_drafts')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', draftId);

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
