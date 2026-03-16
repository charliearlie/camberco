import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';
import react from '@astrojs/react';

export default defineConfig({
  site: 'https://camberco.uk',
  integrations: [sitemap(), react()],
  adapter: vercel(),
});
