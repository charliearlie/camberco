import React, { useRef, useState, useCallback } from 'react';
import { uploadImage } from './uploadImage';

interface ImageUploaderProps {
  supabaseUrl: string;
  supabaseAnonKey: string;
  session: { access_token: string } | null;
  onUpload: (url: string) => void;
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
      setProgress(0);

      try {
        const url = await uploadImage(file, {
          supabaseUrl,
          supabaseAnonKey,
          accessToken: session?.access_token ?? '',
        });
        setProgress(100);
        onUpload(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed.');
      } finally {
        setProgress(null);
      }
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
