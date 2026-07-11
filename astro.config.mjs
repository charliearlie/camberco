import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import { loadEnv } from 'vite';
import { withLastmod } from './src/lib/sitemap.ts';

const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');

let lastmodPromise;

async function fetchBlogLastmod() {
  const url = env.PUBLIC_SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new Map();
  try {
    const res = await fetch(
      `${url}/rest/v1/blog_drafts?status=eq.published&select=slug,updated_at,published_at`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );
    if (!res.ok) return new Map();
    const rows = await res.json();
    return new Map(rows.map((row) => [row.slug, row.updated_at ?? row.published_at]));
  } catch {
    return new Map();
  }
}

export default defineConfig({
  site: 'https://camberco.co.uk',
  trailingSlash: 'never',
  integrations: [
    sitemap({
      filter: (page) => !new URL(page).pathname.startsWith('/admin'),
      serialize: async (item) => withLastmod(item, await (lastmodPromise ??= fetchBlogLastmod())),
    }),
    react(),
  ],
  adapter: vercel(),
});
