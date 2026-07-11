export interface SitemapItem {
  url: string;
  lastmod?: string;
  changefreq?: string;
  priority?: number;
  links?: unknown[];
}

export function blogSlugFromUrl(url: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const normalised = pathname.replace(/\/+$/, '');
  const match = normalised.match(/^\/blog\/([^/]+)$/);
  if (!match || match[1] === 'category') return null;
  return match[1];
}

export function withLastmod(
  item: SitemapItem,
  lastmodBySlug: Map<string, string>,
): SitemapItem {
  const slug = blogSlugFromUrl(item.url);
  if (!slug) return item;
  const lastmod = lastmodBySlug.get(slug);
  if (!lastmod) return item;
  return { ...item, lastmod };
}
