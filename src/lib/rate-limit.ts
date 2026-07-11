import { createClient } from '@supabase/supabase-js';

// Minimal surface so tests can inject a fake without a real Supabase client.
export interface RateLimitClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
  from(table: string): {
    delete(): {
      lt(
        column: string,
        value: string,
      ): PromiseLike<{ error: { message: string } | null }>;
    };
  };
}

// Rows whose window ended this long ago are stale and eligible for deletion.
const CLEANUP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Fraction of requests that also sweep stale rows. Keeps the table small
// without a cron job while adding no measurable cost to any single request.
const CLEANUP_PROBABILITY = 0.02;

let cachedClient: RateLimitClient | null = null;

function serviceClient(): RateLimitClient {
  if (!cachedClient) {
    const url = import.meta.env.PUBLIC_SUPABASE_URL ?? '';
    const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
    cachedClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return cachedClient;
}

/**
 * Durable rate limit backed by public.rate_limits (see
 * supabase/migrations/20260710090002_create_rate_limits.sql).
 * Returns true when the request is allowed.
 * Fails OPEN on any database error: availability beats strictness here.
 *
 * Callers: /api/enquiries (5/60min), /api/subscribe (5/60min), /api/chat (30/60min).
 */
export async function checkRateLimit(
  opts: { key: string; limit: number; windowMinutes: number },
  client?: RateLimitClient,
): Promise<boolean> {
  try {
    const rpcClient = client ?? serviceClient();
    const { data, error } = await rpcClient.rpc('bump_rate_limit', {
      p_key: opts.key,
      p_limit: opts.limit,
      p_window_minutes: opts.windowMinutes,
    });

    // Opportunistic cleanup: a small fraction of requests deletes rows whose
    // window started more than 24 hours ago. Fire-and-forget: never awaited,
    // so it cannot slow the request path, and failures are swallowed because
    // the next gated request will sweep instead. Isolated in its own
    // try/catch so even a synchronous throw while building the delete chain
    // cannot reach the outer catch and flip a "blocked" verdict to "allowed".
    try {
      if (Math.random() < CLEANUP_PROBABILITY) {
        const cutoff = new Date(Date.now() - CLEANUP_MAX_AGE_MS).toISOString();
        void rpcClient
          .from('rate_limits')
          .delete()
          .lt('window_started_at', cutoff)
          .then(undefined, () => {});
      }
    } catch {
      // cleanup must never affect the verdict
    }

    if (error) {
      console.error('Rate limit check failed:', error.message);
      return true;
    }
    return data === true;
  } catch (err) {
    console.error('Rate limit check failed:', err);
    return true;
  }
}
