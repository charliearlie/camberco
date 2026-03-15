import React, { useRef, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

interface ImageUploaderProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
  session: { access_token: string } | null;
  onUpload: (url: string) => void;
}

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const BUCKET = 'blog-images';

function generateFilename(original: string): string {
  const ext = original.split('.').pop() ?? 'jpg';
  const uuid = crypto.randomUUID();
  return `${uuid}.${ext}`;
}

export default function ImageUploader({
  supabaseUrl,
  supabaseAnonKey,
  session,
  onUpload,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);

      if (!file.type.startsWith('image/')) {
        setError('Only image files are accepted.');
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError('File exceeds 5 MB limit.');
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      // Attach user JWT so RLS policies allow the upload
      if (session?.access_token) {
        // @ts-expect-error — internal header injection
        supabase.auth.setSession({ access_token: session.access_token, refresh_token: '' });
      }

      const filename = generateFilename(file.name);
      setProgress(0);

      const { data, error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filename, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        setError(uploadError.message);
        setProgress(null);
        return;
      }

      setProgress(100);

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(data.path);
      onUpload(urlData.publicUrl);
      setProgress(null);
    },
    [supabaseUrl, supabaseAnonKey, session, onUpload]
  );

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    uploadFile(files[0]);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [uploadFile]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const handleClick = () => inputRef.current?.click();

  const isUploading = progress !== null;

  return (
    <div>
      <div
        className={[
          'image-upload-zone',
          dragOver ? 'drag-over' : '',
          isUploading ? 'uploading' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleClick()}
        aria-label="Upload cover image"
      >
        {isUploading ? (
          <span>uploading...</span>
        ) : (
          <span>drag & drop or click to upload</span>
        )}
        <br />
        <span style={{ fontSize: '11px', opacity: 0.6 }}>image/* · max 5 MB</span>
      </div>

      {isUploading && (
        <div className="upload-progress">
          <div
            className="upload-progress-bar"
            style={{ width: `${progress ?? 0}%` }}
          />
        </div>
      )}

      {error && (
        <span
          className="metadata-field-hint warn"
          style={{ color: 'var(--color-error)' }}
        >
          {error}
        </span>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
        aria-hidden="true"
      />
    </div>
  );
}
