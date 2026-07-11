import { describe, expect, it } from 'vitest';
import { blogSlugFromUrl, withLastmod } from './sitemap';

describe('blogSlugFromUrl', () => {
  it('extracts the slug from a blog post URL with or without trailing slash', () => {
    expect(blogSlugFromUrl('https://camberco.co.uk/blog/my-post')).toBe('my-post');
    expect(blogSlugFromUrl('https://camberco.co.uk/blog/my-post/')).toBe('my-post');
  });

  it('returns null for non-post URLs', () => {
    expect(blogSlugFromUrl('https://camberco.co.uk/blog')).toBeNull();
    expect(blogSlugFromUrl('https://camberco.co.uk/blog/category/automation')).toBeNull();
    expect(blogSlugFromUrl('https://camberco.co.uk/contact')).toBeNull();
    expect(blogSlugFromUrl('not a url')).toBeNull();
  });
});

describe('withLastmod', () => {
  const map = new Map([['my-post', '2026-02-01T10:00:00.000Z']]);

  it('adds lastmod for known blog posts', () => {
    const item = withLastmod({ url: 'https://camberco.co.uk/blog/my-post' }, map);
    expect(item.lastmod).toBe('2026-02-01T10:00:00.000Z');
  });

  it('leaves other URLs untouched', () => {
    const item = withLastmod({ url: 'https://camberco.co.uk/contact' }, map);
    expect(item.lastmod).toBeUndefined();
  });
});
