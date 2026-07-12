export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { waitUntil } from '@vercel/functions';
import { sendAdminNotification, sendSenderConfirmation } from '../../lib/email';
import { checkRateLimit } from '../../lib/rate-limit';

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ----------------------------------------------------------------
// POST — create enquiry
// ----------------------------------------------------------------

export const POST: APIRoute = async ({ request }) => {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const allowed = await checkRateLimit({ key: `enquiries:${ip}`, limit: 5, windowMinutes: 60 });
  if (!allowed) {
    return jsonRes({ error: 'Too many submissions. Please try again later.' }, 429);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonRes({ error: 'Invalid JSON' }, 400);
  }

  // Honeypot check
  if (body.website) {
    return jsonRes({ success: true }); // silently reject
  }

  const name = String(body.name ?? '').trim();
  const email = String(body.email ?? '').trim();
  const company = body.company ? String(body.company).trim() : null;
  const service = String(body.service ?? '').trim();
  const message = String(body.message ?? '').trim();
  const source = body.source === 'bot' ? 'bot' : 'form';
  const chatTranscript = body.chat_transcript ?? null;

  // Validation
  if (!name) return jsonRes({ error: 'Name is required.' }, 400);
  if (!email || !EMAIL_RE.test(email)) return jsonRes({ error: 'Valid email is required.' }, 400);
  if (!service) return jsonRes({ error: 'Service is required.' }, 400);
  if (!message) return jsonRes({ error: 'Message is required.' }, 400);

  const supabase = serverSupabase();

  const { error } = await supabase.from('enquiries').insert({
    name,
    email,
    company,
    service,
    message,
    source,
    chat_transcript: chatTranscript,
  });

  if (error) {
    console.error('Supabase insert error:', error);
    return jsonRes({ error: 'Failed to submit enquiry.' }, 500);
  }

  // Emails must survive the response: waitUntil keeps the function alive until they settle.
  const enquiryData = { name, email, company: company ?? undefined, service, message, source: source as 'form' | 'bot' };
  waitUntil(
    Promise.allSettled([
      sendAdminNotification(enquiryData),
      sendSenderConfirmation(enquiryData),
    ]).then((results) => {
      for (const r of results) {
        if (r.status === 'rejected') console.error('Enquiry email failed:', r.reason);
      }
    }),
  );

  return jsonRes({ success: true });
};

// ----------------------------------------------------------------
// GET — list enquiries (admin, auth required)
// ----------------------------------------------------------------

export const GET: APIRoute = async ({ request, url }) => {
  const userId = await verifyAuth(request);
  if (!userId) return jsonRes({ error: 'Unauthorized.' }, 401);

  const supabase = serverSupabase();
  const status = url.searchParams.get('status');

  let query = supabase
    .from('enquiries')
    .select('*')
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Supabase query error:', error);
    return jsonRes({ error: 'Failed to fetch enquiries.' }, 500);
  }

  return jsonRes({ enquiries: data });
};

// ----------------------------------------------------------------
// PATCH — update status (admin, auth required)
// ----------------------------------------------------------------

export const PATCH: APIRoute = async ({ request }) => {
  const userId = await verifyAuth(request);
  if (!userId) return jsonRes({ error: 'Unauthorized.' }, 401);

  let body: { id?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return jsonRes({ error: 'Invalid JSON' }, 400);
  }

  const id = body.id;
  const status = body.status;

  if (!id || !status) return jsonRes({ error: 'id and status are required.' }, 400);

  const validStatuses = ['new', 'contacted', 'booked', 'closed'];
  if (!validStatuses.includes(status)) return jsonRes({ error: 'Invalid status.' }, 400);

  const supabase = serverSupabase();

  const { error } = await supabase
    .from('enquiries')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Supabase update error:', error);
    return jsonRes({ error: 'Failed to update enquiry.' }, 500);
  }

  return jsonRes({ success: true });
};
