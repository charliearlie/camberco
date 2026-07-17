export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { OPEN_PROJECT_STATUSES, sumOpenPipelinePence } from '../../../lib/crm';

// --- auth plumbing (copied per the house convention; see drafts.ts) ---------

const ADMIN_EMAIL = (import.meta.env.ADMIN_EMAIL ?? 'charlie@camberco.co.uk').toLowerCase();

function serverSupabase() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL ?? '';
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

type AuthResult = { ok: true; userId: string } | { ok: false; status: number; error: string };

async function verifyAuth(request: Request): Promise<AuthResult> {
  const token = (request.headers.get('Authorization') ?? '').replace('Bearer ', '').trim();
  if (!token) return { ok: false, status: 401, error: 'Unauthorized.' };

  const supabase = serverSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { ok: false, status: 401, error: 'Unauthorized.' };
  if ((data.user.email ?? '').toLowerCase() !== ADMIN_EMAIL) {
    return { ok: false, status: 403, error: 'Forbidden.' };
  }
  return { ok: true, userId: data.user.id };
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ----------------------------------------------------------------
// GET — overview KPIs + recent activity
// ----------------------------------------------------------------

export const GET: APIRoute = async ({ request }) => {
  const auth = await verifyAuth(request);
  if (!auth.ok) return jsonRes({ error: auth.error }, auth.status);

  const supabase = serverSupabase();
  const openStatuses = [...OPEN_PROJECT_STATUSES];

  const [
    newEnquiries,
    activeClients,
    openProjects,
    openPipelineRows,
    recentEnquiries,
    recentProjects,
  ] = await Promise.all([
    // New enquiries exclude any that have already been converted to a client.
    supabase
      .from('enquiries')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'new')
      .is('client_id', null),
    supabase.from('clients').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('projects').select('*', { count: 'exact', head: true }).in('status', openStatuses),
    supabase.from('projects').select('status, value_pence, currency').in('status', openStatuses),
    supabase
      .from('enquiries')
      .select('id, name, email, company, service, status, created_at, client_id')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('projects')
      .select('id, name, status, value_pence, currency, due_date, created_at, client:clients(id, name)')
      .in('status', openStatuses)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const firstError =
    newEnquiries.error ||
    activeClients.error ||
    openProjects.error ||
    openPipelineRows.error ||
    recentEnquiries.error ||
    recentProjects.error;
  if (firstError) return jsonRes({ error: 'Failed to load overview.' }, 500);

  const { pence, nonGbpOpenCount } = sumOpenPipelinePence(openPipelineRows.data ?? []);

  return jsonRes({
    kpis: {
      newEnquiries: newEnquiries.count ?? 0,
      activeClients: activeClients.count ?? 0,
      openProjects: openProjects.count ?? 0,
      openPipelinePence: pence,
      nonGbpOpenCount,
    },
    recentEnquiries: recentEnquiries.data ?? [],
    recentProjects: recentProjects.data ?? [],
  });
};
