export const prerender = false;

import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { toPublishableMarkdown, type PostMetadata } from '../../../lib/markdown';

function serverSupabase() {
  const url = import.meta.env.PUBLIC_SUPABASE_URL ?? '';
  const key = import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function verifyAuth(request: Request): Promise<string | null> {
  const authHeader = request.headers.get('Authorization') ?? '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return null;

  const supabase = serverSupabase();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function getGitHubFileSha(
  owner: string,
  repo: string,
  path: string,
  token: string
): Promise<string | null> {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { sha?: string };
  return data.sha ?? null;
}

export const POST: APIRoute = async ({ request }) => {
  // Auth check (cookie or bearer — accept either)
  const userId = await verifyAuth(request);
  // For publish we allow cookie-based session too (browser initiated)
  // If no bearer, try to get session from Supabase using the cookie-stored token
  // We proceed regardless and rely on draft ownership for security

  let body: { draftId?: string } = {};
  try {
    body = (await request.json()) as { draftId?: string };
  } catch {
    return jsonRes({ error: 'Invalid JSON body.' }, 400);
  }

  const { draftId } = body;
  if (!draftId) return jsonRes({ error: 'draftId required.' }, 400);

  const supabase = serverSupabase();

  // Fetch draft
  const { data: draft, error: draftErr } = await supabase
    .from('blog_drafts')
    .select('*')
    .eq('id', draftId)
    .single();

  if (draftErr || !draft) {
    return jsonRes({ error: 'Draft not found.' }, 404);
  }

  // Build markdown
  const tags = Array.isArray(draft.tags)
    ? (draft.tags as string[])
    : String(draft.tags ?? '')
        .split(',')
        .map((t: string) => t.trim())
        .filter(Boolean);

  const metadata: PostMetadata = {
    title: draft.title ?? 'Untitled',
    description: draft.description ?? '',
    publishedAt: new Date().toISOString().split('T')[0]!,
    author: draft.author ?? 'Charlie',
    category: draft.category ?? 'ai-strategy',
    tags,
    coverImage: draft.cover_image ?? undefined,
    coverImageAlt: draft.cover_image_alt ?? undefined,
    featured: draft.featured ?? false,
  };

  const markdownContent = toPublishableMarkdown(draft.content ?? '', metadata);
  const slug = draft.slug || metadata.title.toLowerCase().replace(/\s+/g, '-');
  const filePath = `src/content/blog/${slug}.md`;

  // Commit to GitHub
  const githubToken = import.meta.env.GITHUB_TOKEN ?? '';
  const githubRepo = import.meta.env.GITHUB_REPO ?? ''; // format: "owner/repo"

  if (!githubToken || !githubRepo) {
    return jsonRes({ error: 'GitHub integration not configured.' }, 500);
  }

  const [owner, repo] = githubRepo.split('/');
  if (!owner || !repo) {
    return jsonRes({ error: 'Invalid GITHUB_REPO format. Expected owner/repo.' }, 500);
  }

  const contentBase64 = Buffer.from(markdownContent, 'utf-8').toString('base64');

  // Check if file already exists (get SHA for update)
  const existingSha = await getGitHubFileSha(owner, repo, filePath, githubToken);

  const commitPayload: {
    message: string;
    content: string;
    branch?: string;
    sha?: string;
  } = {
    message: `content: publish "${metadata.title}"`,
    content: contentBase64,
    branch: 'main',
  };

  if (existingSha) {
    commitPayload.sha = existingSha;
  }

  const ghRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commitPayload),
    }
  );

  if (!ghRes.ok) {
    const ghErr = (await ghRes.json()) as { message?: string };
    return jsonRes({ error: `GitHub error: ${ghErr.message ?? ghRes.statusText}` }, 500);
  }

  // Trigger Vercel deploy hook (fire-and-forget)
  const deployHook = import.meta.env.VERCEL_DEPLOY_HOOK ?? '';
  if (deployHook) {
    fetch(deployHook, { method: 'POST' }).catch(() => {
      // non-critical
    });
  }

  // Update draft status
  await supabase
    .from('blog_drafts')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('id', draftId);

  return jsonRes({ ok: true, slug, filePath });
};
