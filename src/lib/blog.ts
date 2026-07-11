import { createClient } from '@supabase/supabase-js';
import { imageSize } from 'image-size';

export function serverSupabase() {
  const url = import.meta.env.SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL ?? '';
  const key = import.meta.env.SUPABASE_SECRET_KEY ?? import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: Date;
  updatedAt: Date | null;
  author: string;
  category: string;
  tags: string[];
  coverImage: string | null;
  coverImageAlt: string | null;
  featured: boolean;
  content: string;
}

interface Heading {
  depth: number;
  slug: string;
  text: string;
}

export async function getPublishedPosts(): Promise<BlogPost[]> {
  const supabase = serverSupabase();
  const { data, error } = await supabase
    .from('blog_drafts')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  // Fail the build loudly instead of silently publishing an empty blog.
  if (error) {
    throw new Error(`getPublishedPosts: Supabase error: ${error.message}`);
  }

  return (data ?? []).map(mapRow);
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const supabase = serverSupabase();
  const { data, error } = await supabase
    .from('blog_drafts')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();

  if (error || !data) return null;

  return mapRow(data);
}

function mapRow(row: Record<string, unknown>): BlogPost {
  return {
    slug: row.slug as string,
    title: row.title as string,
    description: row.description as string,
    publishedAt: new Date(row.published_at as string),
    updatedAt: row.updated_at ? new Date(row.updated_at as string) : null,
    author: row.author as string,
    category: row.category as string,
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    coverImage: (row.cover_image as string) ?? null,
    coverImageAlt: (row.cover_image_alt as string) ?? null,
    featured: (row.featured as boolean) ?? false,
    content: row.content as string,
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const imageSizeCache = new Map<string, { width: number; height: number } | null>();

async function probeImageSize(src: string): Promise<{ width: number; height: number } | null> {
  const cached = imageSizeCache.get(src);
  if (cached !== undefined) return cached;

  let result: { width: number; height: number } | null = null;
  try {
    const res = await fetch(src, {
      headers: { Range: 'bytes=0-131071' },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok || res.status === 206) {
      const bytes = new Uint8Array(await res.arrayBuffer());
      const size = imageSize(bytes);
      if (size.width && size.height) {
        result = { width: size.width, height: size.height };
      }
    }
  } catch {
    result = null;
  }
  imageSizeCache.set(src, result);
  return result;
}

export async function processHtml(html: string): Promise<{ html: string; headings: Heading[] }> {
  const headings: Heading[] = [];

  const withIds = html.replace(
    /<(h[23])>([\s\S]*?)<\/\1>/gi,
    (_match, tag: string, inner: string) => {
      const depth = parseInt(tag.charAt(1), 10);
      const text = inner.replace(/<[^>]+>/g, '').trim();
      const slug = slugify(text);
      headings.push({ depth, slug, text });
      return `<${tag} id="${slug}">${inner}</${tag}>`;
    },
  );

  // In-article images: lazy-load, async decode, and add intrinsic
  // dimensions (probed at build time) to prevent layout shift.
  const imgTags = Array.from(new Set(withIds.match(/<img\b[^>]*>/gi) ?? []));
  let processed = withIds;
  for (const tag of imgTags) {
    let updated = tag;
    if (!/\bloading=/i.test(updated)) {
      updated = updated.replace(/^<img/i, '<img loading="lazy"');
    }
    if (!/\bdecoding=/i.test(updated)) {
      updated = updated.replace(/^<img/i, '<img decoding="async"');
    }
    const srcMatch = updated.match(/\bsrc="([^"]+)"/i);
    const hasDims = /\bwidth=/i.test(updated) && /\bheight=/i.test(updated);
    if (srcMatch && !hasDims && /^https?:\/\//i.test(srcMatch[1])) {
      const size = await probeImageSize(srcMatch[1]);
      if (size) {
        updated = updated.replace(/^<img/i, `<img width="${size.width}" height="${size.height}"`);
      }
    }
    processed = processed.split(tag).join(updated);
  }

  return { html: processed, headings };
}
