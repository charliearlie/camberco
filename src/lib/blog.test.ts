import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPublishedPosts, processHtml } from './blog';

const state = vi.hoisted(() => ({
  orderResult: { data: [] as unknown[] | null, error: null as { message: string } | null },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve(state.orderResult),
        }),
      }),
    }),
  }),
}));

const row = {
  slug: 'test-post',
  title: 'Test post',
  description: 'A test post.',
  published_at: '2026-01-05T09:00:00.000Z',
  updated_at: '2026-02-01T10:00:00.000Z',
  author: 'Charlie W',
  category: 'automation',
  tags: ['n8n'],
  cover_image: null,
  cover_image_alt: null,
  featured: false,
  content: '<p>Hello</p>',
};

describe('getPublishedPosts', () => {
  it('throws when Supabase returns an error', async () => {
    state.orderResult = { data: null, error: { message: 'connection refused' } };
    await expect(getPublishedPosts()).rejects.toThrow('connection refused');
  });

  it('returns mapped posts on success', async () => {
    state.orderResult = { data: [row], error: null };
    const posts = await getPublishedPosts();
    expect(posts).toHaveLength(1);
    expect(posts[0].slug).toBe('test-post');
    expect(posts[0].updatedAt?.toISOString()).toBe('2026-02-01T10:00:00.000Z');
  });
});

// 1x1 transparent PNG, 68 bytes.
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('processHtml', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(PNG_1X1, { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds ids to h2 and h3 headings', async () => {
    const { html, headings } = await processHtml('<h2>First Section</h2><p>text</p>');
    expect(html).toContain('<h2 id="first-section">First Section</h2>');
    expect(headings).toEqual([{ depth: 2, slug: 'first-section', text: 'First Section' }]);
  });

  it('adds loading, decoding and probed dimensions to images', async () => {
    const { html } = await processHtml('<p>Hi</p><img src="https://example.com/pic.png" alt="x">');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain('width="1"');
    expect(html).toContain('height="1"');
  });

  it('does not override existing loading attributes', async () => {
    const { html } = await processHtml('<img loading="eager" src="https://example.com/pic.png">');
    expect(html).not.toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
  });

  it('leaves images without a probe result usable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 404 })));
    const { html } = await processHtml('<img src="https://example.com/missing.png">');
    expect(html).toContain('loading="lazy"');
    expect(html).not.toContain('width=');
  });
});
