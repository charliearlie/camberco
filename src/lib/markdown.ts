import TurndownService from 'turndown';

export interface PostMetadata {
  title: string;
  description: string;
  publishedAt: string;
  author: string;
  category:
    | 'ai-strategy'
    | 'automation'
    | 'case-study'
    | 'tools-and-workflows'
    | 'founder-journey'
    | 'industry-trends';
  tags: string[];
  coverImage?: string;
  coverImageAlt?: string;
  featured?: boolean;
}

function buildTurndownService(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    strongDelimiter: '**',
    emDelimiter: '_',
  });

  // Headings — already handled by atx style, but ensure clean output
  td.addRule('heading', {
    filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    replacement(content, node) {
      const level = Number((node as HTMLElement).tagName.charAt(1));
      const hashes = '#'.repeat(level);
      return `\n\n${hashes} ${content}\n\n`;
    },
  });

  // Fenced code blocks with language hint
  td.addRule('fencedCodeBlock', {
    filter(node) {
      return (
        node.nodeName === 'PRE' &&
        node.firstChild !== null &&
        node.firstChild.nodeName === 'CODE'
      );
    },
    replacement(_content, node) {
      const code = node.firstChild as HTMLElement;
      const langClass = code.getAttribute('class') || '';
      const langMatch = langClass.match(/language-(\S+)/);
      const lang = langMatch ? langMatch[1] : '';
      const raw = code.textContent || '';
      return `\n\n\`\`\`${lang}\n${raw}\n\`\`\`\n\n`;
    },
  });

  // Inline code
  td.addRule('inlineCode', {
    filter(node) {
      return (
        node.nodeName === 'CODE' &&
        node.parentNode !== null &&
        node.parentNode.nodeName !== 'PRE'
      );
    },
    replacement(_content, node) {
      return `\`${node.textContent}\``;
    },
  });

  // Bold
  td.addRule('bold', {
    filter: ['strong', 'b'],
    replacement(content) {
      return `**${content}**`;
    },
  });

  // Italic
  td.addRule('italic', {
    filter: ['em', 'i'],
    replacement(content) {
      return `_${content}_`;
    },
  });

  // Links
  td.addRule('links', {
    filter: 'a',
    replacement(content, node) {
      const el = node as HTMLAnchorElement;
      const href = el.getAttribute('href') || '';
      const title = el.getAttribute('title');
      return title ? `[${content}](${href} "${title}")` : `[${content}](${href})`;
    },
  });

  // Images
  td.addRule('images', {
    filter: 'img',
    replacement(_content, node) {
      const el = node as HTMLImageElement;
      const alt = el.getAttribute('alt') || '';
      const src = el.getAttribute('src') || '';
      const title = el.getAttribute('title');
      return title ? `![${alt}](${src} "${title}")` : `![${alt}](${src})`;
    },
  });

  // Blockquotes
  td.addRule('blockquote', {
    filter: 'blockquote',
    replacement(content) {
      const lines = content.trim().split('\n');
      return '\n\n' + lines.map((l) => `> ${l}`).join('\n') + '\n\n';
    },
  });

  // Horizontal rule
  td.addRule('horizontalRule', {
    filter: 'hr',
    replacement() {
      return '\n\n---\n\n';
    },
  });

  return td;
}

export function htmlToMarkdown(html: string): string {
  const td = buildTurndownService();
  return td.turndown(html).trim();
}

export function generateFrontmatter(metadata: PostMetadata): string {
  const lines: string[] = ['---'];

  lines.push(`title: "${metadata.title.replace(/"/g, '\\"')}"`);
  lines.push(`description: "${metadata.description.replace(/"/g, '\\"')}"`);
  lines.push(`publishedAt: ${metadata.publishedAt}`);
  lines.push(`author: ${metadata.author}`);
  lines.push(`category: ${metadata.category}`);

  if (metadata.tags && metadata.tags.length > 0) {
    lines.push('tags:');
    metadata.tags.forEach((tag) => lines.push(`  - ${tag}`));
  } else {
    lines.push('tags: []');
  }

  if (metadata.coverImage) {
    lines.push(`coverImage: "${metadata.coverImage}"`);
  }
  if (metadata.coverImageAlt) {
    lines.push(`coverImageAlt: "${metadata.coverImageAlt.replace(/"/g, '\\"')}"`);
  }
  if (metadata.featured !== undefined) {
    lines.push(`featured: ${metadata.featured}`);
  }

  lines.push('draft: false');
  lines.push('---');

  return lines.join('\n');
}

export function toPublishableMarkdown(html: string, metadata: PostMetadata): string {
  const frontmatter = generateFrontmatter(metadata);
  const body = htmlToMarkdown(html);
  return `${frontmatter}\n\n${body}\n`;
}
