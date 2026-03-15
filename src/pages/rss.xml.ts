import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return rss({
    title: 'Camber Co Blog',
    description: 'AI strategy, automation, and insights for founders and small teams.',
    site: context.site!,
    items: posts
      .sort((a, b) => b.data.publishedAt.valueOf() - a.data.publishedAt.valueOf())
      .map((post) => ({
        title: post.data.title,
        pubDate: post.data.publishedAt,
        description: post.data.description,
        link: `/blog/${post.slug}/`,
        categories: [post.data.category, ...post.data.tags],
      })),
    customData: `<language>en-gb</language>`,
  });
}
