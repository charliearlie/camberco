export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { waitUntil } from '@vercel/functions';
import { checkRateLimit } from '../../lib/rate-limit';
import { sendSubscribeConfirmation } from '../../lib/email';

function serverSupabase() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL ?? '';
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request }) => {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const allowed = await checkRateLimit({ key: `subscribe:${ip}`, limit: 5, windowMinutes: 60 });
  if (!allowed) {
    return jsonRes({ error: 'Too many requests. Please try again later.' }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonRes({ error: 'Invalid JSON' }, 400);
  }

  // Honeypot
  if (body.website) {
    return jsonRes({ success: true });
  }

  const email = String(body.email ?? '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return jsonRes({ error: 'Valid email is required.' }, 400);
  }

  const supabase = serverSupabase();

  // Check if already confirmed and active
  const { data: existing } = await supabase
    .from('subscribers')
    .select('confirmed, status')
    .eq('email', email)
    .maybeSingle();

  if (existing?.confirmed && existing?.status === 'active') {
    return jsonRes({ success: true, message: 'Already subscribed.' });
  }

  // Upsert subscriber; re-subscribing after an unsubscribe reactivates the row
  const { data: subscriber, error } = await supabase
    .from('subscribers')
    .upsert({ email, status: 'active', unsubscribed_at: null }, { onConflict: 'email' })
    .select('unsubscribe_token')
    .single();

  if (error || !subscriber) {
    console.error('Subscribe error:', error);
    return jsonRes({ error: 'Something went wrong.' }, 500);
  }

  waitUntil(
    sendSubscribeConfirmation(email, subscriber.unsubscribe_token).catch((err) =>
      console.error('Confirmation email failed:', err),
    ),
  );

  return jsonRes({ success: true });
};
