import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkRateLimit, type RateLimitClient } from './rate-limit';

function fakeClient(
  result: { data: unknown; error: { message: string } | null },
  calls: unknown[][] = [],
): RateLimitClient {
  return {
    rpc(fn: string, args: Record<string, unknown>) {
      calls.push([fn, args]);
      return Promise.resolve(result);
    },
  };
}

describe('checkRateLimit', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows when the database says the count is within the limit', async () => {
    const allowed = await checkRateLimit(
      { key: 'enquiries:1.2.3.4', limit: 5, windowMinutes: 60 },
      fakeClient({ data: true, error: null }),
    );
    expect(allowed).toBe(true);
  });

  it('blocks when the database says the limit is exceeded', async () => {
    const allowed = await checkRateLimit(
      { key: 'enquiries:1.2.3.4', limit: 5, windowMinutes: 60 },
      fakeClient({ data: false, error: null }),
    );
    expect(allowed).toBe(false);
  });

  it('fails open when the rpc errors', async () => {
    const allowed = await checkRateLimit(
      { key: 'chat:1.2.3.4', limit: 30, windowMinutes: 60 },
      fakeClient({ data: null, error: { message: 'connection refused' } }),
    );
    expect(allowed).toBe(true);
  });

  it('fails open when the client throws', async () => {
    const throwing: RateLimitClient = {
      rpc() {
        return Promise.reject(new Error('network down'));
      },
    };
    const allowed = await checkRateLimit(
      { key: 'subscribe:1.2.3.4', limit: 5, windowMinutes: 60 },
      throwing,
    );
    expect(allowed).toBe(true);
  });

  it('fails open when no client is injected and the service client cannot be constructed', async () => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    await expect(checkRateLimit({ key: 't', limit: 1, windowMinutes: 1 })).resolves.toBe(true);
  });

  it('passes the key, limit and window through to bump_rate_limit', async () => {
    const calls: unknown[][] = [];
    await checkRateLimit(
      { key: 'subscribe:9.9.9.9', limit: 5, windowMinutes: 60 },
      fakeClient({ data: true, error: null }, calls),
    );
    expect(calls).toEqual([
      ['bump_rate_limit', { p_key: 'subscribe:9.9.9.9', p_limit: 5, p_window_minutes: 60 }],
    ]);
  });
});
