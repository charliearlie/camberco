export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { waitUntil } from '@vercel/functions';
import { sendSubscriberAlert, sendWelcomeEmail } from '../../lib/email';

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
    h1 { color: #22c55e; font-size: 20px; margin: 0 0 12px 0; }
    p { color: #d0d0d0; font-size: 14px; line-height: 1.6; margin: 0 0 24px 0; }
    a { color: #22c55e; text-decoration: none; font-size: 13px; }
    a:hover { color: #4ade80; }
    button { background: #22c55e; color: #000; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 10px 20px; border-radius: 4px; border: none; cursor: pointer; }
    button:hover { background: #4ade80; }
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

// GET renders a confirm button. It never mutates, so inbox scanners that
// prefetch links cannot corrupt subscription state.
export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get('token');
  if (!token) {
    return new Response('Missing token.', { status: 400 });
  }

  const supabase = serverSupabase();
  const { data: sub } = await supabase
    .from('subscribers')
    .select('email, confirmed, status')
    .eq('unsubscribe_token', token)
    .maybeSingle();

  if (!sub) {
    return page(
      'Invalid link',
      '$ invalid link',
      `<p>This confirmation link is invalid or has expired.</p><a href="/blog/">Back to blog</a>`,
      404,
    );
  }

  if (sub.confirmed && sub.status === 'active') {
    return page(
      'Subscribed',
      '$ already confirmed',
      `<p>You are already subscribed. New posts will land in your inbox.</p><a href="/blog/">Back to blog</a>`,
    );
  }

  return page(
    'Confirm subscription',
    '$ confirm your subscription',
    `<p>One click and you are in. New posts from Camber Co, straight to your inbox.</p>
     <form method="POST" action="/api/confirm-subscription">
       <input type="hidden" name="token" value="${escapeAttr(token)}"/>
       <button type="submit">&gt; Confirm Subscription</button>
     </form>`,
  );
};

// POST performs the state change, then sends the welcome email and owner alert.
export const POST: APIRoute = async ({ request }) => {
  let token = '';
  try {
    const form = await request.formData();
    token = String(form.get('token') ?? '');
  } catch {
    // fall through to the missing-token response
  }
  if (!token) {
    return new Response('Missing token.', { status: 400 });
  }

  const supabase = serverSupabase();

  // Matches first-time confirmations (confirmed=false) and lapsed subscribers
  // reactivating from their old confirmation link (confirmed=true, status!='active').
  const { data: updated, error } = await supabase
    .from('subscribers')
    .update({ confirmed: true, status: 'active', unsubscribed_at: null })
    .eq('unsubscribe_token', token)
    .or('confirmed.eq.false,status.neq.active')
    .select('email')
    .maybeSingle();

  if (error) {
    console.error('Confirm subscription error:', error);
    return page(
      'Something went wrong',
      '$ something went wrong',
      `<p>We could not confirm your subscription. Please try the link again in a minute.</p>`,
      500,
    );
  }

  if (!updated) {
    // Either an invalid token, or a re-click on an already active subscription.
    const { data: existing } = await supabase
      .from('subscribers')
      .select('email, confirmed, status')
      .eq('unsubscribe_token', token)
      .maybeSingle();

    if (!existing) {
      return page(
        'Invalid link',
        '$ invalid link',
        `<p>This confirmation link is invalid or has expired.</p><a href="/blog/">Back to blog</a>`,
        404,
      );
    }

    if (existing.confirmed && existing.status === 'active') {
      return page(
        'Subscribed',
        '$ already confirmed',
        `<p>You are already subscribed. New posts will land in your inbox.</p><a href="/blog/">Back to blog</a>`,
      );
    }

    // Row exists but is not active and the update did not match it: a concurrent
    // state change. Ask the user to retry; the next POST will hit the update path.
    return page(
      'Something went wrong',
      '$ something went wrong',
      `<p>We could not confirm your subscription. Please try the link again in a minute.</p>`,
      500,
    );
  }

  // Owner alert + welcome email, kept alive past the response.
  waitUntil(
    Promise.allSettled([
      sendWelcomeEmail(updated.email, token),
      sendSubscriberAlert(updated.email),
    ]).then((results) => {
      for (const r of results) {
        if (r.status === 'rejected') console.error('Post-confirmation email failed:', r.reason);
      }
    }),
  );

  return page(
    'Subscribed',
    '$ subscription confirmed',
    `<p>You will receive new posts from Camber Co in your inbox. A welcome email is on its way.</p><a href="/blog/">Back to blog</a>`,
  );
};
