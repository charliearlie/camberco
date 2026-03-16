import rss from '@astrojs/rss';
import { getPublishedPosts } from '../lib/blog';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getPublishedPosts();
  return rss({
    title: 'Camber Co Blog',
    description: 'AI strategy, automation, and insights for founders and small teams.',
    site: context.site!,
    items: posts.map((post) => ({
      title: post.title,
      pubDate: post.publishedAt,
      description: post.description,
      link: `/blog/${post.slug}/`,
      categories: [post.category, ...post.tags],
    })),
    customData: `<language>en-gb</language>`,
  });
}
