// Colocated tests for the CRM API routes. The filename is underscore-prefixed
// so Astro excludes it from route generation (everything under src/pages is
// otherwise treated as a page/endpoint); Vitest still discovers *.test.ts.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Shared, mutable mock state. vi.hoisted lets the (hoisted) vi.mock factory and
// the tests share the same object so we can capture DB writes and steer auth.
const h = vi.hoisted(() => ({
  user: { id: 'u1', email: 'charlie@camberco.co.uk' } as { id: string; email: string } | null,
  userError: null as { message: string } | null,
  // Canned response per table for select/single/maybeSingle calls.
  selectResponse: {} as Record<string, { data: unknown; error: unknown }>,
  inserted: [] as { table: string; payload: Record<string, unknown> }[],
  updated: [] as { table: string; payload: Record<string, unknown> }[],
  deleted: [] as { table: string }[],
}));

vi.mock('@supabase/supabase-js', () => {
  function makeBuilder(table: string) {
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: Record<string, unknown> = {};
    const resolve = () => {
      if (op === 'insert' || op === 'update') {
        const canned = h.selectResponse[table];
        if (canned?.error) return Promise.resolve({ data: null, error: canned.error });
        return Promise.resolve({ data: { id: 'generated-id', ...payload }, error: null });
      }
      return Promise.resolve(h.selectResponse[table] ?? { data: null, error: null });
    };
    const b: Record<string, unknown> = {
      select: () => b,
      insert: (p: Record<string, unknown>) => {
        op = 'insert';
        payload = p;
        h.inserted.push({ table, payload: p });
        return b;
      },
      update: (p: Record<string, unknown>) => {
        op = 'update';
        payload = p;
        h.updated.push({ table, payload: p });
        return b;
      },
      delete: () => {
        op = 'delete';
        h.deleted.push({ table });
        return b;
      },
      eq: () => b,
      is: () => b,
      in: () => b,
      order: () => b,
      limit: () => b,
      single: () => resolve(),
      maybeSingle: () => resolve(),
      then: (f: (v: unknown) => unknown, r?: (e: unknown) => unknown) => resolve().then(f, r),
    };
    return b;
  }
  return {
    createClient: () => ({
      auth: {
        getUser: async () => ({ data: { user: h.userError ? null : h.user }, error: h.userError }),
      },
      from: (table: string) => makeBuilder(table),
    }),
  };
});

import { DELETE as clientsDelete, POST as clientsPost, PUT as clientsPut } from './clients';
import { POST as projectsPost } from './projects';
import { POST as notesPost } from './notes';

const UUID = 'ed72a8bb-435a-4445-9064-6f0c388c4294';
const UUID2 = '11111111-2222-3333-4444-555555555555';

function ctx(method: string, body?: unknown, opts: { auth?: boolean; query?: string } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.auth !== false) headers.Authorization = 'Bearer test-token';
  const request = new Request(`https://camberco.co.uk/api/admin/x${opts.query ?? ''}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { request, url: new URL(request.url) } as never;
}

beforeEach(() => {
  h.user = { id: 'u1', email: 'charlie@camberco.co.uk' };
  h.userError = null;
  h.selectResponse = {};
  h.inserted.length = 0;
  h.updated.length = 0;
  h.deleted.length = 0;
});

describe('auth gate (shared verifyAuth)', () => {
  it('returns 401 with no bearer token, before any DB access', async () => {
    const res = await clientsPost(ctx('POST', { name: 'Ada' }, { auth: false }));
    expect(res.status).toBe(401);
    expect(h.inserted).toHaveLength(0);
  });

  it('returns 401 when the token is invalid', async () => {
    h.userError = { message: 'bad jwt' };
    h.user = null;
    const res = await clientsPost(ctx('POST', { name: 'Ada' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 for a valid but non-admin user (allowlist)', async () => {
    h.user = { id: 'u2', email: 'intruder@example.com' };
    const res = await clientsPost(ctx('POST', { name: 'Ada' }));
    expect(res.status).toBe(403);
    expect(h.inserted).toHaveLength(0);
  });
});

describe('clients route input handling', () => {
  it('rejects an unknown status enum with 400 and writes nothing', async () => {
    const res = await clientsPost(ctx('POST', { name: 'Ada', status: 'vip' }));
    expect(res.status).toBe(400);
    expect(h.inserted).toHaveLength(0);
  });

  it('rejects a missing required name with 400', async () => {
    const res = await clientsPost(ctx('POST', {}));
    expect(res.status).toBe(400);
  });

  it('ignores unexpected/server-owned body fields (mass-assignment guard)', async () => {
    h.selectResponse.clients = { data: { id: 'generated-id' }, error: null };
    const res = await clientsPost(
      ctx('POST', {
        name: 'Ada',
        email: 'ADA@EXAMPLE.com',
        id: 'attacker-id',
        is_admin: true,
        created_at: '1999-01-01',
      }),
    );
    expect(res.status).toBe(201);
    expect(h.inserted).toHaveLength(1);
    const payload = h.inserted[0].payload;
    expect(payload.id).toBeUndefined();
    expect(payload.is_admin).toBeUndefined();
    expect(payload.created_at).toBeUndefined();
    expect(payload.email).toBe('ada@example.com'); // lowercased
  });

  it('maps a duplicate-email unique violation to 409', async () => {
    h.selectResponse.clients = { data: null, error: { code: '23505' } };
    const res = await clientsPost(ctx('POST', { name: 'Ada', email: 'a@b.co' }));
    expect(res.status).toBe(409);
  });

  it('PUT rejects a malformed uuid with 400', async () => {
    const res = await clientsPut(ctx('PUT', { id: 'not-a-uuid', name: 'X' }));
    expect(res.status).toBe(400);
    expect(h.updated).toHaveLength(0);
  });

  it('PUT never writes id/created_at even if supplied', async () => {
    h.selectResponse.clients = { data: { id: UUID }, error: null };
    const res = await clientsPut(ctx('PUT', { id: UUID, name: 'New', created_at: 'x', source: 'referral' }));
    expect(res.status).toBe(200);
    const payload = h.updated[0].payload;
    expect(payload).toEqual({ name: 'New', source: 'referral' });
  });

  it('DELETE rejects a malformed uuid with 400', async () => {
    const res = await clientsDelete(ctx('DELETE', undefined, { query: '?id=nope' }));
    expect(res.status).toBe(400);
    expect(h.deleted).toHaveLength(0);
  });
});

describe('projects route', () => {
  it('rejects a malformed client_id uuid with 400', async () => {
    const res = await projectsPost(ctx('POST', { client_id: 'nope', name: 'Site' }));
    expect(res.status).toBe(400);
    expect(h.inserted).toHaveLength(0);
  });

  it('derives completed_at server-side and ignores a client-supplied one', async () => {
    h.selectResponse.projects = { data: { id: 'generated-id' }, error: null };
    const res = await projectsPost(
      ctx('POST', { client_id: UUID, name: 'Site', status: 'completed', completed_at: '2000-01-01' }),
    );
    expect(res.status).toBe(201);
    const payload = h.inserted[0].payload;
    expect(typeof payload.completed_at).toBe('string');
    expect(payload.completed_at).not.toBe('2000-01-01T00:00:00.000Z');
    expect(payload.completed_at).not.toBe('2000-01-01');
  });

  it('leaves completed_at null for a non-completed status', async () => {
    h.selectResponse.projects = { data: { id: 'generated-id' }, error: null };
    await projectsPost(ctx('POST', { client_id: UUID, name: 'Site', status: 'active' }));
    expect(h.inserted[0].payload.completed_at).toBeNull();
  });

  it('maps a foreign-key violation (missing client) to 400', async () => {
    h.selectResponse.projects = { data: null, error: { code: '23503' } };
    const res = await projectsPost(ctx('POST', { client_id: UUID, name: 'Site' }));
    expect(res.status).toBe(400);
  });
});

describe('notes route', () => {
  it('rejects a missing body with 400', async () => {
    const res = await notesPost(ctx('POST', { client_id: UUID }));
    expect(res.status).toBe(400);
    expect(h.inserted).toHaveLength(0);
  });

  it('adds a client-scoped note when the client exists', async () => {
    h.selectResponse.clients = { data: { id: UUID }, error: null };
    h.selectResponse.client_notes = { data: { id: 'generated-id' }, error: null };
    const res = await notesPost(ctx('POST', { client_id: UUID, body: 'Called them' }));
    expect(res.status).toBe(201);
    const payload = h.inserted[0].payload;
    expect(payload.client_id).toBe(UUID);
    expect(payload.project_id).toBeNull();
    expect(payload.body).toBe('Called them');
  });

  it('rejects a note whose project belongs to another client with 400', async () => {
    h.selectResponse.projects = { data: { client_id: 'someone-else' }, error: null };
    const res = await notesPost(ctx('POST', { client_id: UUID2, project_id: UUID, body: 'x' }));
    expect(res.status).toBe(400);
    expect(h.inserted).toHaveLength(0);
  });

  it('returns 404 when the scoped project does not exist', async () => {
    h.selectResponse.projects = { data: null, error: { code: 'PGRST116' } };
    const res = await notesPost(ctx('POST', { project_id: UUID, body: 'x' }));
    expect(res.status).toBe(404);
  });

  it('surfaces a genuine backend error as 500, not a masked 404', async () => {
    h.selectResponse.projects = { data: null, error: { code: 'XX000' } };
    const res = await notesPost(ctx('POST', { project_id: UUID, body: 'x' }));
    expect(res.status).toBe(500);
  });
});
