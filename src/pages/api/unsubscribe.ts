export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

function serverSupabase() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL ?? '';
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function page(title: string, heading: string, bodyHtml: string, status = 200): Response {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="robots" content="noindex"/>
  <title>${title} | Camber Co</title>
  <style>
    body { margin: 0; background: #000; color: #f0f0f0; font-family: 'JetBrains Mono', monospace; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #0a0a0a; border: 1px solid #1f1f1f; border-radius: 12px; padding: 48px; text-align: center; max-width: 420px; }
    h1 { color: #f0f0f0; font-size: 20px; margin: 0 0 12px 0; }
    p { color: #d0d0d0; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; }
    p:last-child { margin-bottom: 0; }
    button { background: transparent; color: #f0f0f0; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 10px 20px; border-radius: 4px; border: 1px solid #3a3a3a; cursor: pointer; }
    button:hover { border-color: #f0f0f0; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${heading}</h1>
    ${bodyHtml}
  </div>
</body>
</html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

// GET renders an unsubscribe button. It never mutates, so inbox scanners that
// prefetch links cannot unsubscribe people by accident.
export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');
  if (!token) {
    return new Response('Missing token.', { status: 400 });
  }

  return page(
    'Unsubscribe',
    '$ unsubscribe',
    `<p>Stop receiving new post emails from Camber Co?</p>
     <form method="POST" action="/api/unsubscribe">
       <input type="hidden" name="token" value="${escapeAttr(token)}"/>
       <button type="submit">&gt; Unsubscribe</button>
     </form>`,
  );
};

// POST performs a soft delete. The token may arrive as a query param
// (RFC 8058 one-click unsubscribe posts to the List-Unsubscribe URL)
// or as a form field (the button above).
export const POST: APIRoute = async ({ request, url }) => {
  let token = url.searchParams.get('token') ?? '';
  if (!token) {
    try {
      const form = await request.formData();
      token = String(form.get('token') ?? '');
    } catch {
      // no parseable body; fall through
    }
  }
  if (!token) {
    return new Response('Missing token.', { status: 400 });
  }

  const supabase = serverSupabase();
  const { error } = await supabase
    .from('subscribers')
    .update({ status: 'unsubscribed', unsubscribed_at: new Date().toISOString() })
    .eq('unsubscribe_token', token);

  if (error) {
    console.error('Unsubscribe error:', error);
  }

  return page(
    'Unsubscribed',
    '$ unsubscribed',
    `<p>You have been removed from the mailing list. You will not receive further emails.</p>`,
  );
};
