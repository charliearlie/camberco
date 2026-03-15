export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'blog-images';
const MAX_BYTES = 5 * 1024 * 1024;

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
  if (!userId) return jsonRes({ error: 'Unauthorized.' }, 401);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonRes({ error: 'Expected multipart/form-data.' }, 400);
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return jsonRes({ error: 'No file uploaded.' }, 400);
  }

  if (!file.type.startsWith('image/')) {
    return jsonRes({ error: 'Only image files are accepted.' }, 400);
  }

  if (file.size > MAX_BYTES) {
    return jsonRes({ error: 'File exceeds 5 MB limit.' }, 400);
  }

  const ext = file.name.split('.').pop() ?? 'jpg';
  const filename = `${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const supabase = serverSupabase();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(filename, buffer, { contentType: file.type, upsert: false });

  if (error) return jsonRes({ error: error.message }, 500);

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);

  return jsonRes({ url: urlData.publicUrl });
};
