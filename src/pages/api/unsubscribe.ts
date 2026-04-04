export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

function serverSupabase() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL ?? '';
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');
  if (!token) {
    return new Response('Missing token.', { status: 400 });
  }

  const supabase = serverSupabase();

  const { error } = await supabase
    .from('subscribers')
    .delete()
    .eq('unsubscribe_token', token);

  if (error) {
    console.error('Unsubscribe error:', error);
  }

  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Unsubscribed | Camber Co</title>
  <style>
    body { margin: 0; background: #000; color: #f0f0f0; font-family: 'JetBrains Mono', monospace; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #0a0a0a; border: 1px solid #1f1f1f; border-radius: 12px; padding: 48px; text-align: center; max-width: 420px; }
    h1 { color: #f0f0f0; font-size: 20px; margin: 0 0 12px 0; }
    p { color: #d0d0d0; font-size: 14px; line-height: 1.6; margin: 0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>$ unsubscribed</h1>
    <p>You have been removed from the mailing list. You will not receive further emails.</p>
  </div>
</body>
</html>`,
    { status: 200, headers: { 'Content-Type': 'text/html' } },
  );
};
