export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

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

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW = 60 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async ({ request }) => {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  if (!checkRateLimit(ip)) {
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

  // Check if already confirmed
  const { data: existing } = await supabase
    .from('subscribers')
    .select('confirmed')
    .eq('email', email)
    .single();

  if (existing?.confirmed) {
    return jsonRes({ success: true, message: 'Already subscribed.' });
  }

  // Upsert subscriber
  const { data: subscriber, error } = await supabase
    .from('subscribers')
    .upsert({ email }, { onConflict: 'email' })
    .select('unsubscribe_token')
    .single();

  if (error || !subscriber) {
    console.error('Subscribe error:', error);
    return jsonRes({ error: 'Something went wrong.' }, 500);
  }

  // Send confirmation email
  const confirmUrl = `https://camberco.co.uk/api/confirm-subscription?token=${subscriber.unsubscribe_token}`;
  const resend = new Resend(import.meta.env.RESEND_API_KEY ?? '');

  const html = `
    <div style="font-family: 'JetBrains Mono', 'Courier New', monospace; background: #0a0a0a; color: #f0f0f0; padding: 32px; border-radius: 8px;">
      <h2 style="color: #22c55e; font-size: 18px; margin: 0 0 16px 0;">$ confirm your subscription</h2>

      <p style="color: #d0d0d0; line-height: 1.6; margin: 0 0 24px 0;">
        You asked to receive new posts from Camber Co. Click below to confirm.
      </p>

      <a href="${confirmUrl}" style="display: inline-block; background: #22c55e; color: #000; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; padding: 10px 20px; border-radius: 4px; text-decoration: none;">
        &gt; Confirm Subscription
      </a>

      <p style="color: #8a8a8a; font-size: 13px; margin: 24px 0 0 0;">
        If you didn't request this, just ignore this email.
      </p>
    </div>
  `;

  resend.emails.send({
    from: 'noreply@camberco.co.uk',
    to: email,
    subject: 'Confirm your Camber Co subscription',
    html,
  }).catch((err) => console.error('Confirmation email failed:', err));

  return jsonRes({ success: true });
};
