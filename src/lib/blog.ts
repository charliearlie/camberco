import { createClient } from '@supabase/supabase-js';

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

  if (error || !data) return [];

  return data.map(mapRow);
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

export function processHtml(html: string): { html: string; headings: Heading[] } {
  const headings: Heading[] = [];

  const processed = html.replace(
    /<(h[23])>([\s\S]*?)<\/\1>/gi,
    (_match, tag: string, inner: string) => {
      const depth = parseInt(tag.charAt(1), 10);
      const text = inner.replace(/<[^>]+>/g, '').trim();
      const slug = slugify(text);
      headings.push({ depth, slug, text });
      return `<${tag} id="${slug}">${inner}</${tag}>`;
    },
  );

  return { html: processed, headings };
}
