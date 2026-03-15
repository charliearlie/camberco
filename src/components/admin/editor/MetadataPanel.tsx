import React from 'react';
import ImageUploader from './ImageUploader';

const CATEGORIES = [
  { value: 'ai-strategy', label: 'AI Strategy' },
  { value: 'automation', label: 'Automation' },
  { value: 'case-study', label: 'Case Study' },
  { value: 'tools-and-workflows', label: 'Tools & Workflows' },
  { value: 'founder-journey', label: 'Founder Journey' },
  { value: 'industry-trends', label: 'Industry Trends' },
] as const;

export interface Metadata {
  title: string;
  slug: string;
  description: string;
  category: string;
  tags: string;
  coverImage: string;
  coverImageAlt: string;
}

interface MetadataPanelProps {
  metadata: Metadata;
  onChange: (updates: Partial<Metadata>) => void;
  onImageUpload: (url: string) => void;
  supabaseUrl: string;
  supabaseAnonKey: string;
  session: { access_token: string } | null;
}

export default function MetadataPanel({
  metadata,
  onChange,
  onImageUpload,
  supabaseUrl,
  supabaseAnonKey,
  session,
}: MetadataPanelProps) {
  const descLen = metadata.description.length;
  const descWarn = descLen > 160;

  const handleUpload = (url: string) => {
    onChange({ coverImage: url });
    onImageUpload(url);
  };

  const handleRemoveCover = () => {
    onChange({ coverImage: '', coverImageAlt: '' });
  };

  return (
    <aside className="metadata-panel">
      <div className="metadata-panel-title">$ metadata</div>

      {/* Title */}
      <div className="metadata-field">
        <label htmlFor="meta-title">title</label>
        <input
          id="meta-title"
          type="text"
          value={metadata.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Post title"
        />
      </div>

      {/* Slug */}
      <div className="metadata-field">
        <label htmlFor="meta-slug">slug</label>
        <input
          id="meta-slug"
          type="text"
          value={metadata.slug}
          onChange={(e) => onChange({ slug: e.target.value })}
          placeholder="post-slug"
        />
        <span className="metadata-field-hint">auto-generated from title</span>
      </div>

      {/* Description */}
      <div className="metadata-field">
        <label htmlFor="meta-description">description</label>
        <textarea
          id="meta-description"
          value={metadata.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Brief post description (max 160 chars)"
          rows={3}
        />
        <span className={`metadata-field-hint${descWarn ? ' warn' : ''}`}>
          {descLen}/160 chars
        </span>
      </div>

      {/* Category */}
      <div className="metadata-field">
        <label htmlFor="meta-category">category</label>
        <select
          id="meta-category"
          value={metadata.category}
          onChange={(e) => onChange({ category: e.target.value })}
        >
          <option value="">-- select category --</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div className="metadata-field">
        <label htmlFor="meta-tags">tags</label>
        <input
          id="meta-tags"
          type="text"
          value={metadata.tags}
          onChange={(e) => onChange({ tags: e.target.value })}
          placeholder="tag-one, tag-two, tag-three"
        />
        <span className="metadata-field-hint">comma-separated</span>
      </div>

      {/* Cover Image */}
      <div className="metadata-field">
        <label>cover image</label>
        {metadata.coverImage ? (
          <div className="image-preview">
            <img src={metadata.coverImage} alt={metadata.coverImageAlt || 'Cover'} />
            <button
              type="button"
              className="image-preview-remove"
              onClick={handleRemoveCover}
            >
              remove
            </button>
          </div>
        ) : (
          <ImageUploader
            supabaseUrl={supabaseUrl}
            supabaseAnonKey={supabaseAnonKey}
            session={session}
            onUpload={handleUpload}
          />
        )}
      </div>

      {/* Cover Image Alt */}
      {metadata.coverImage && (
        <div className="metadata-field">
          <label htmlFor="meta-cover-alt">cover image alt</label>
          <input
            id="meta-cover-alt"
            type="text"
            value={metadata.coverImageAlt}
            onChange={(e) => onChange({ coverImageAlt: e.target.value })}
            placeholder="Describe the cover image"
          />
        </div>
      )}
    </aside>
  );
}
