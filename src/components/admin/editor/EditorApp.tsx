import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import CharacterCount from '@tiptap/extension-character-count';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import { createLowlight, common } from 'lowlight';

import EditorToolbar from './EditorToolbar';
import MetadataPanel from './MetadataPanel';
import SlashCommandExtension from './SlashCommandMenu';
import ImageDropPaste from './ImageDropPaste';
import { uploadImage } from './uploadImage';
import type { Metadata } from './MetadataPanel';

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

const lowlight = createLowlight(common);

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function wordsFrom(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

function readingTime(words: number): number {
  return Math.max(1, Math.ceil(words / 200));
}

type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

// ----------------------------------------------------------------
// Default metadata
// ----------------------------------------------------------------

const defaultMetadata = (): Metadata => ({
  title: '',
  slug: '',
  description: '',
  category: '',
  tags: '',
  coverImage: '',
  coverImageAlt: '',
});

// ----------------------------------------------------------------
// Component
// ----------------------------------------------------------------

interface EditorAppProps {
  draftId?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
}

export default function EditorApp({ draftId, supabaseUrl, supabaseAnonKey }: EditorAppProps) {
  const supabaseRef = useRef(supabase);
  const [session, setSession] = useState<Session | null>(null);
  const [metadata, setMetadata] = useState<Metadata>(defaultMetadata());
  const [slugLocked, setSlugLocked] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [panelOpen, setPanelOpen] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentDraftId = useRef<string | null>(draftId ?? null);

  // ----------------------------------------------------------------
  // Auth
  // ----------------------------------------------------------------

  useEffect(() => {
    supabaseRef.current.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabaseRef.current.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) window.location.href = '/admin/login';
    });
    return () => subscription.unsubscribe();
  }, []);

  // ----------------------------------------------------------------
  // TipTap editor
  // ----------------------------------------------------------------

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false, // replaced by CodeBlockLowlight
      }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      Image.configure({ inline: false, allowBase64: false }),
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({ placeholder: 'Start writing… or type / for commands' }),
      Typography,
      CharacterCount,
      SlashCommandExtension.configure({
        onImageCommand: () => handleImageUploadFromPicker(),
      }),
      ImageDropPaste.configure({
        onUploadStart: () => setUploading(true),
        onUploadEnd: () => setUploading(false),
        onUploadError: (err: Error) => console.error('Image upload failed:', err.message),
      }),
    ],
    autofocus: true,
    editorProps: {
      attributes: { class: 'tiptap' },
    },
    onUpdate: ({ editor: e }) => {
      // Backup to localStorage immediately on every change
      try {
        const key = `camber-draft-backup-${currentDraftId.current ?? draftId ?? 'new'}`;
        localStorage.setItem(key, JSON.stringify({
          content: e.getHTML(),
          title: metadata.title,
          slug: metadata.slug,
          description: metadata.description,
          category: metadata.category,
          tags: metadata.tags,
          coverImage: metadata.coverImage,
          coverImageAlt: metadata.coverImageAlt,
          savedAt: new Date().toISOString(),
        }));
      } catch { /* storage full */ }
      scheduleSave();
    },
  });

  // ----------------------------------------------------------------
  // Image upload via file picker (toolbar + slash command)
  // ----------------------------------------------------------------

  const handleImageUploadFromPicker = useCallback((): Promise<string> => {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return reject(new Error('No file selected'));
        setUploading(true);
        try {
          const url = await uploadImage(file);
          if (editor) {
            editor.chain().focus().setImage({ src: url }).run();
          }
          resolve(url);
        } catch (err) {
          reject(err);
        } finally {
          setUploading(false);
        }
      };
      input.click();
    });
  }, [editor, session, supabaseUrl, supabaseAnonKey]);

  // ----------------------------------------------------------------
  // Load existing draft
  // ----------------------------------------------------------------

  useEffect(() => {
    if (!draftId || !editor) return;

    (async () => {
      const { data: { session: s } } = await supabaseRef.current.auth.getSession();
      if (!s) return;

      const res = await fetch(`/api/admin/drafts?id=${draftId}`, {
        headers: { Authorization: `Bearer ${s.access_token}` },
      });
      if (!res.ok) return;
      const { draft: data } = await res.json() as { draft: Record<string, unknown> | null };
      if (!data) return;

      editor.commands.setContent((data.content as string) ?? '');
      setMetadata({
        title: (data.title as string) ?? '',
        slug: (data.slug as string) ?? '',
        description: (data.description as string) ?? '',
        category: (data.category as string) ?? '',
        tags: Array.isArray(data.tags) ? (data.tags as string[]).join(', ') : ((data.tags as string) ?? ''),
        coverImage: (data.cover_image as string) ?? '',
        coverImageAlt: (data.cover_image_alt as string) ?? '',
      });
      if (data.slug) setSlugLocked(true);
    })();
  }, [draftId, editor]);

  // Recover from localStorage backup if editor is empty (e.g. after hot reload)
  useEffect(() => {
    if (!editor) return;
    // Only recover if editor has no content yet
    if (editor.getText().trim()) return;

    const key = `camber-draft-backup-${draftId ?? 'new'}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const backup = JSON.parse(raw) as Record<string, string>;
      if (backup.content) {
        editor.commands.setContent(backup.content);
        setMetadata({
          title: backup.title ?? '',
          slug: backup.slug ?? '',
          description: backup.description ?? '',
          category: backup.category ?? '',
          tags: backup.tags ?? '',
          coverImage: backup.coverImage ?? '',
          coverImageAlt: backup.coverImageAlt ?? '',
        });
        if (backup.slug) setSlugLocked(true);
        console.info('[editor] Restored content from localStorage backup');
      }
    } catch { /* ignore parse errors */ }
  }, [editor, draftId]);

  // ----------------------------------------------------------------
  // Auto-generate slug from title
  // ----------------------------------------------------------------

  const handleMetadataChange = useCallback(
    (updates: Partial<Metadata>) => {
      setMetadata((prev) => {
        const next = { ...prev, ...updates };

        // Auto-slug from title unless user has manually overridden
        if ('title' in updates && !slugLocked) {
          next.slug = toSlug(updates.title ?? '');
        }

        // If slug is manually changed, lock it
        if ('slug' in updates) {
          setSlugLocked(true);
        }

        return next;
      });
      scheduleSave();
    },
    [slugLocked]
  );

  // ----------------------------------------------------------------
  // Save
  // ----------------------------------------------------------------

  // Ref so scheduleSave (stable) always calls the latest persistDraft
  const persistDraftRef = useRef<() => Promise<void>>();

  const scheduleSave = useCallback(() => {
    setSaveStatus('unsaved');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persistDraftRef.current?.(), 5_000);
  }, []);

  const saveToLocalStorage = useCallback((html: string) => {
    try {
      const key = `camber-draft-backup-${currentDraftId.current ?? 'new'}`;
      localStorage.setItem(key, JSON.stringify({
        content: html,
        title: metadata.title,
        slug: metadata.slug,
        description: metadata.description,
        category: metadata.category,
        tags: metadata.tags,
        coverImage: metadata.coverImage,
        coverImageAlt: metadata.coverImageAlt,
        savedAt: new Date().toISOString(),
      }));
    } catch { /* storage full — ignore */ }
  }, [metadata]);

  const persistDraft = useCallback(async () => {
    if (!editor) return;
    setSaveStatus('saving');

    const html = editor.getHTML();

    // Always save to localStorage as backup first
    saveToLocalStorage(html);

    const { data: { session: currentSession } } = await supabaseRef.current.auth.getSession();
    const token = currentSession?.access_token;
    if (!token) {
      console.error('[save] No session/token — content backed up to localStorage');
      setSaveStatus('error');
      return;
    }

    const payload: Record<string, unknown> = {
      title: metadata.title,
      slug: metadata.slug,
      description: metadata.description,
      category: metadata.category || 'ai-strategy',
      tags: metadata.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      cover_image: metadata.coverImage || null,
      cover_image_alt: metadata.coverImageAlt || null,
      content: html,
    };

    try {
      if (currentDraftId.current) {
        payload.id = currentDraftId.current;
        const res = await fetch('/api/admin/drafts', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (res.status === 404) {
          // Draft doesn't exist in DB — re-create it
          console.warn('[save] Draft not found in DB, re-creating…');
          currentDraftId.current = null;
          delete payload.id;
          const createRes = await fetch('/api/admin/drafts', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
          if (createRes.ok) {
            const json = await createRes.json() as { id?: string };
            if (json.id) {
              currentDraftId.current = json.id;
              window.history.replaceState({}, '', `/admin/editor/${json.id}`);
            }
            setSaveStatus('saved');
          } else {
            console.error(`[save] Re-create failed: ${createRes.status}`);
            setSaveStatus('error');
          }
          return;
        }
        if (!res.ok) {
          const body = await res.text();
          console.error(`[save] PUT ${res.status}: ${body}`);
        }
        setSaveStatus(res.ok ? 'saved' : 'error');
      } else {
        const res = await fetch('/api/admin/drafts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const body = await res.text();
          console.error(`[save] POST ${res.status}: ${body}`);
          setSaveStatus('error');
          return;
        }
        const json = await res.json() as { id?: string };
        if (json.id) {
          currentDraftId.current = json.id;
          window.history.replaceState({}, '', `/admin/editor/${json.id}`);
        }
        setSaveStatus('saved');
      }
    } catch (err) {
      console.error('[save] Network error:', err);
      setSaveStatus('error');
    }
  }, [editor, metadata]);

  // Keep ref in sync so scheduleSave always calls the latest version
  persistDraftRef.current = persistDraft;

  // Manual save on Cmd/Ctrl+S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        void persistDraft();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [persistDraft]);

  // ----------------------------------------------------------------
  // Publish
  // ----------------------------------------------------------------

  const handlePublish = async () => {
    // Always save latest content before publishing
    await persistDraft();
    if (!currentDraftId.current) {
      setPublishError('Save the draft first.');
      return;
    }

    setPublishing(true);
    setPublishError(null);

    try {
      const { data: { session: s } } = await supabaseRef.current.auth.getSession();
      if (!s) {
        setPublishError('Not authenticated — please log in again.');
        setPublishing(false);
        return;
      }

      const res = await fetch('/api/admin/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${s.access_token}`,
        },
        body: JSON.stringify({ draftId: currentDraftId.current }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setPublishError(json.error ?? 'Publish failed.');
      } else {
        setSaveStatus('saved');
      }
    } catch (err) {
      setPublishError('Network error during publish.');
    } finally {
      setPublishing(false);
    }
  };

  // ----------------------------------------------------------------
  // Derived
  // ----------------------------------------------------------------

  const charCount = editor?.storage?.characterCount?.characters?.() ?? 0;
  const wordCount = editor ? wordsFrom(editor.getText()) : 0;
  const readTime = readingTime(wordCount);

  const saveLabel =
    saveStatus === 'saved'
      ? '✓ saved'
      : saveStatus === 'saving'
        ? '⋯ saving'
        : saveStatus === 'error'
          ? '✗ error'
          : '● unsaved';

  // ----------------------------------------------------------------
  // Redirect if no session after load
  // ----------------------------------------------------------------

  if (session === null) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-text-muted)',
        }}
      >
        checking auth...
      </div>
    );
  }

  return (
    <div className="editor-container">
      {/* Top toolbar row */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--color-border-subtle)' }}>
        {editor && <EditorToolbar editor={editor} onImageUpload={handleImageUploadFromPicker} />}

        {/* Right-side actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: '0 var(--space-4)',
            marginLeft: 'auto',
            flexShrink: 0,
          }}
        >
          <span className={`save-status ${saveStatus}`}>{saveLabel}</span>
          {uploading && <span className="upload-indicator">uploading image…</span>}

          <button
            type="button"
            className={`panel-toggle-btn${panelOpen ? ' is-open' : ''}`}
            onClick={() => setPanelOpen((v) => !v)}
          >
            meta
          </button>

          <button
            type="button"
            className={`btn-publish${publishing ? ' publishing' : ''}`}
            onClick={() => void handlePublish()}
            disabled={publishing}
          >
            {publishing ? 'publishing…' : '$ publish'}
          </button>
        </div>
      </div>

      {publishError && (
        <div
          style={{
            padding: 'var(--space-2) var(--space-6)',
            background: 'rgba(239,68,68,0.1)',
            borderBottom: '1px solid rgba(239,68,68,0.3)',
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'var(--color-error)',
          }}
        >
          error: {publishError}
        </div>
      )}

      {/* Main content + sidebar */}
      <div className="editor-main">
        <div className="editor-content">
          <EditorContent editor={editor} />
        </div>

        {panelOpen && (
          <MetadataPanel
            metadata={metadata}
            onChange={handleMetadataChange}
            onImageUpload={(url) => handleMetadataChange({ coverImage: url })}
          />
        )}
      </div>

      {/* Status bar */}
      <div className="editor-statusbar">
        <span className="word-count">{wordCount} words</span>
        <span className="word-count">·</span>
        <span className="word-count">{readTime} min read</span>
        <span className="word-count">·</span>
        <span className="word-count">{charCount} chars</span>
      </div>
    </div>
  );
}
