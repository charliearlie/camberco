import { createClient } from '@supabase/supabase-js';

// Minimal surface so tests can inject a fake without a real Supabase client.
export interface RateLimitClient {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

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
