import { describe, it, expect } from 'vitest';
import {
  OLD_HOST,
  NEW_HOST,
  parseRssItems,
  slugFromUrl,
  parseSitemapLastmod,
  extractFeaturedSlugs,
  extractArticleBody,
  extractJsonLdArticle,
  stripProcessingArtifacts,
  extractCoverImage,
  buildPostRow,
  collectOldStorageUrls,
  rewriteStorageHost,
  removeDeadImages,
  dollarQuote,
  buildSeedSql,
} from './recover-posts.mjs';

const IMG = `${OLD_HOST}/storage/v1/object/public/blog-images/aaaa-1111.png`;
const COVER = `${OLD_HOST}/storage/v1/object/public/blog-images/bbbb-2222.png`;

// Mirrors the rendered output of src/pages/blog/[slug].astro, including the
// data-astro-cid scoping attributes Astro adds to styled elements.
const PAGE = `<!DOCTYPE html><html><head>
<script type="application/ld+json">[{"@context":"https://schema.org","@type":"Article","headline":"Test Post","description":"A test description.","datePublished":"2026-04-14T08:00:00.000Z","dateModified":"2026-04-20T09:00:00.000Z","author":{"@type":"Person","name":"Charlie W"},"keywords":"seo, growth","articleSection":"Case Study","image":"${COVER}"},{"@context":"https://schema.org","@type":"BreadcrumbList"}]</script>
</head><body>
<nav class="breadcrumb" data-astro-cid-x><a href="/blog/category/case-study" class="bc-link">case-study</a></nav>
<div class="post-cover" data-astro-cid-x><img src="${COVER}" alt="Dashboard screenshot" loading="eager" decoding="async"></div>
<article class="post-content prose" data-astro-cid-x><h2 id="the-problem">The problem</h2><p>It&apos;s hard.</p><img loading="lazy" decoding="async" width="800" height="400" src="${IMG}" alt="chart"><h3 id="a-fix">A fix</h3><p>Done.</p></article>
<div class="post-content" data-astro-cid-x>footer bits</div>
</body></html>`;

const RSS = `<?xml version="1.0"?><rss version="2.0"><channel><title>Camber Co Blog</title>
<item><title>Meta&apos;s AI &amp; Chats</title><link>https://camberco.co.uk/blog/metas-ai-chats/</link><guid>x</guid><description>Meta&apos;s latest.</description><pubDate>Fri, 01 May 2026 07:35:30 GMT</pubDate><category>industry-trends</category><category>AI automation</category><category>Meta</category></item>
<item><title>Second</title><link>https://camberco.co.uk/blog/second-post/</link><guid>y</guid><description>Two.</description><pubDate>Sat, 02 May 2026 07:00:00 GMT</pubDate><category>case-study</category></item>
</channel></rss>`;

const SITEMAP = `<?xml version="1.0"?><urlset><url><loc>https://camberco.co.uk/</loc></url><url><loc>https://camberco.co.uk/blog/metas-ai-chats/</loc><lastmod>2026-05-03T10:00:00.000Z</lastmod></url></urlset>`;

const INDEX = `<section class="featured-section" data-astro-cid-y><p>Featured</p><a href="/blog/metas-ai-chats/">x</a><a href="/blog/category/case-study">cat</a></section><section><a href="/blog/second-post/">y</a></section>`;

describe('parseRssItems', () => {
  it('parses items with slug category first and tags after', () => {
    const items = parseRssItems(RSS);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Meta's AI & Chats");
    expect(items[0].link).toBe('https://camberco.co.uk/blog/metas-ai-chats/');
    expect(items[0].description).toBe("Meta's latest.");
    expect(items[0].category).toBe('industry-trends');
    expect(items[0].tags).toEqual(['AI automation', 'Meta']);
    expect(items[1].tags).toEqual([]);
  });
});

describe('slugFromUrl', () => {
  it('strips the /blog/ prefix and trailing slash', () => {
    expect(slugFromUrl('https://camberco.co.uk/blog/metas-ai-chats/')).toBe('metas-ai-chats');
    expect(slugFromUrl('https://camberco.co.uk/blog/no-slash')).toBe('no-slash');
  });
});

describe('parseSitemapLastmod', () => {
  it('maps trailing-slash-stripped locs to lastmod, skipping entries without one', () => {
    const map = parseSitemapLastmod(SITEMAP);
    expect(map.get('https://camberco.co.uk/blog/metas-ai-chats')).toBe('2026-05-03T10:00:00.000Z');
    expect(map.has('https://camberco.co.uk')).toBe(false);
  });
});

describe('extractFeaturedSlugs', () => {
  it('returns slugs only from the featured section, ignoring category links', () => {
    expect(extractFeaturedSlugs(INDEX)).toEqual(['metas-ai-chats']);
  });
  it('returns [] when there is no featured section', () => {
    expect(extractFeaturedSlugs('<main>no featured</main>')).toEqual([]);
  });
});

describe('extractArticleBody', () => {
  it('returns the inner HTML despite astro scoping attributes', () => {
    const body = extractArticleBody(PAGE);
    expect(body.startsWith('<h2 id="the-problem">')).toBe(true);
    expect(body.endsWith('<p>Done.</p>')).toBe(true);
    expect(body).not.toContain('footer bits');
  });
  it('throws when the marker is missing', () => {
    expect(() => extractArticleBody('<html></html>')).toThrow('article marker');
  });
});

describe('extractJsonLdArticle', () => {
  it('finds the Article object inside the JSON-LD array', () => {
    const a = extractJsonLdArticle(PAGE);
    expect(a.headline).toBe('Test Post');
    expect(a.datePublished).toBe('2026-04-14T08:00:00.000Z');
  });
  it('returns null when absent', () => {
    expect(extractJsonLdArticle('<html></html>')).toBeNull();
  });
});

describe('stripProcessingArtifacts', () => {
  it('removes heading ids and img loading/decoding/width/height', () => {
    const out = stripProcessingArtifacts(extractArticleBody(PAGE));
    expect(out).toContain('<h2>The problem</h2>');
    expect(out).toContain('<h3>A fix</h3>');
    expect(out).toContain(`<img src="${IMG}" alt="chart">`);
    expect(out).not.toContain('loading=');
    expect(out).not.toContain('width=');
  });
});

describe('extractCoverImage', () => {
  it('reads src and alt from the post-cover img', () => {
    expect(extractCoverImage(PAGE)).toEqual({ coverImage: COVER, coverImageAlt: 'Dashboard screenshot' });
  });
  it('returns nulls when there is no cover', () => {
    expect(extractCoverImage('<html></html>')).toEqual({ coverImage: null, coverImageAlt: null });
  });
});

describe('buildPostRow', () => {
  const row = buildPostRow({
    pageHtml: PAGE,
    url: 'https://camberco.co.uk/blog/test-post/',
    rssItem: { description: 'rss desc', category: 'case-study', tags: ['seo', 'growth'] },
    lastmod: '2026-05-03T10:00:00.000Z',
    featuredSlugs: ['test-post'],
  });
  it('assembles the row from JSON-LD, page and rss', () => {
    expect(row.slug).toBe('test-post');
    expect(row.title).toBe('Test Post');
    expect(row.description).toBe('A test description.');
    expect(row.author).toBe('Charlie W');
    expect(row.category).toBe('case-study');
    expect(row.tags).toEqual(['seo', 'growth']);
    expect(row.cover_image).toBe(COVER);
    expect(row.cover_image_alt).toBe('Dashboard screenshot');
    expect(row.featured).toBe(true);
    expect(row.published_at).toBe('2026-04-14T08:00:00.000Z');
    expect(row.updated_at).toBe('2026-05-03T10:00:00.000Z');
    expect(row.content).toContain('<h2>The problem</h2>');
  });
  it('nulls the cover alt when it just repeats the title', () => {
    const page = PAGE.replace('alt="Dashboard screenshot"', 'alt="Test Post"');
    const r = buildPostRow({ pageHtml: page, url: 'https://camberco.co.uk/blog/t/', rssItem: null, lastmod: null, featuredSlugs: [] });
    expect(r.cover_image_alt).toBeNull();
    expect(r.updated_at).toBe('2026-04-20T09:00:00.000Z');
  });
});

describe('image helpers', () => {
  const rows = [{ content: `<p>x</p><img src="${IMG}" alt="chart">`, cover_image: COVER }];
  it('collects unique old-host storage urls from content and cover', () => {
    expect(collectOldStorageUrls(rows).sort()).toEqual([IMG, COVER].sort());
  });
  it('rewrites the storage host', () => {
    expect(rewriteStorageHost(`<img src="${IMG}">`)).toBe(`<img src="${IMG.replace(OLD_HOST, NEW_HOST)}">`);
  });
  it('removes dead imgs and figures that only wrapped a dead img', () => {
    const html = `<p>a</p><img src="${IMG}" alt="chart"><figure><img src="${COVER}"><figcaption>cap</figcaption></figure><figure><img src="https://elsewhere.example/x.png"></figure>`;
    const out = removeDeadImages(html, [IMG, COVER]);
    expect(out).not.toContain(IMG);
    expect(out).not.toContain('figcaption');
    expect(out).toContain('elsewhere.example');
  });
});

describe('seed sql', () => {
  it('dollar-quotes and avoids tag collisions', () => {
    expect(dollarQuote('abc')).toBe('$seed$abc$seed$');
    expect(dollarQuote('x $seed$ y')).toBe('$seed1$x $seed$ y$seed1$');
  });
  it('builds guarded idempotent inserts', () => {
    const sql = buildSeedSql([
      {
        slug: 's-one', title: "It's one", description: 'd', author: 'Charlie W',
        category: 'case-study', tags: ['a', 'b'], cover_image: null, cover_image_alt: null,
        content: '<p>hi</p>', featured: true,
        published_at: '2026-04-14T08:00:00.000Z', updated_at: '2026-04-20T09:00:00.000Z',
      },
    ]);
    expect(sql).toContain('from auth.users) <> 1');
    expect(sql).toContain("'It''s one'");
    expect(sql).toContain('$seed$<p>hi</p>$seed$');
    expect(sql).toContain(`'["a","b"]'::jsonb`);
    expect(sql).toContain("on conflict (slug) where status = 'published' do nothing");
    expect(sql).toContain('select (select id from auth.users)');
  });
});
