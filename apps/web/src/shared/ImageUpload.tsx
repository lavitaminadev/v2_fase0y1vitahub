import { useState, useRef, useCallback, useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../core/api';
import { MediaLibraryModal } from './MediaLibraryModal';

interface ImageUploadProps {
  label: string;
  value?: string;
  onChange: (url: string) => void;
  accept?: string;
  maxSizeMB?: number;
  helperText?: string;
  placeholder?: string;
}

interface UploadResponse {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];

function extractPublicId(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    // Cloudinary URLs: /image/upload/v1234567890/folder/public_id.ext
    const match = path.match(/\/image\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
    if (!match) return undefined;
    return match[1];
  } catch {
    return undefined;
  }
}

function optimizedUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/');
    const uploadIndex = pathParts.indexOf('upload');
    if (uploadIndex === -1) return url;
    pathParts.splice(uploadIndex + 1, 0, 'f_auto,q_auto');
    parsed.pathname = pathParts.join('/');
    return parsed.toString();
  } catch {
    return url;
  }
}

export function ImageUpload({
  label,
  value,
  onChange,
  accept = 'image/jpeg,image/png,image/gif,image/webp,image/avif',
  maxSizeMB = 5,
  helperText = `JPG, PNG, GIF, WebP o AVIF. Máximo ${maxSizeMB} MB.`,
  placeholder = 'https://...',
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [lastPublicId, setLastPublicId] = useState<string | undefined>();
  const [mediaLibraryOpen, setMediaLibraryOpen] = useState(false);

  const upload = useMutation({
    mutationFn: (file: File) => api.upload<UploadResponse>('/uploads/images', file),
    onSuccess: (data) => {
      setValidationError(null);
      setLastPublicId(data.publicId);
      onChange(data.url);
    },
    onError: (error: Error) => setValidationError(error.message),
  });

  const remove = useMutation({
    mutationFn: async (publicId: string) => api.delete(`/uploads/images/cloudinary/${encodeURIComponent(publicId)}`),
    onSuccess: () => {
      setLastPublicId(undefined);
      onChange('');
    },
    onError: () => {
      // Even if Cloudinary deletion fails, clear the local selection so the user can continue.
      setLastPublicId(undefined);
      onChange('');
    },
  });

  const validate = useCallback(
    (file: File): string | null => {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        return 'Formato no soportado. Usa JPG, PNG, GIF, WebP o AVIF.';
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        return `El archivo supera los ${maxSizeMB} MB.`;
      }
      return null;
    },
    [maxSizeMB],
  );

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    const error = validate(file);
    if (error) {
      setValidationError(error);
      upload.reset();
      return;
    }
    setValidationError(null);
    upload.mutate(file);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    handleFile(event.dataTransfer.files[0]);
  };

  const handleRemove = (event: React.MouseEvent) => {
    event.stopPropagation();
    const publicId = lastPublicId || extractPublicId(value);
    if (publicId) {
      remove.mutate(publicId);
    } else {
      onChange('');
    }
  };

  const previewUrl = useMemo(() => optimizedUrl(value), [value]);
  const isBusy = upload.isPending || remove.isPending;
  const errorMessage = validationError || upload.error?.message || remove.error?.message;

  return (
    <div className="image-upload">
      <label>{label}</label>
      <div
        className={`image-upload-zone ${dragOver ? 'drag-over' : ''} ${isBusy ? 'uploading' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label={`Subir ${label}`}
        onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click(); }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          hidden
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        {value ? (
          <div className="image-upload-preview">
            <img
              src={previewUrl}
              alt={label}
              onLoad={() => setValidationError(null)}
              onError={() => setValidationError('La URL guardada no apunta a una imagen accesible. Sube un archivo o usa el enlace directo de una imagen.')}
            />
            <div className="image-upload-actions">
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={(event) => { event.stopPropagation(); inputRef.current?.click(); }}
                disabled={isBusy}
              >
                {upload.isPending ? 'Subiendo...' : 'Cambiar'}
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm btn-danger"
                onClick={handleRemove}
                disabled={isBusy}
              >
                {remove.isPending ? 'Eliminando...' : 'Quitar'}
              </button>
            </div>
          </div>
        ) : (
          <div className="image-upload-placeholder">
            <span>📷</span>
            <strong>{upload.isPending ? 'Subiendo imagen...' : 'Arrastra una imagen o haz clic'}</strong>
            <small>{helperText}</small>
          </div>
        )}
      </div>
      {errorMessage && <div className="alert alert-error" role="alert">{errorMessage}</div>}
      <div className="image-upload-url">
        <small>O usa una URL externa</small>
        <div className="image-upload-url-row">
          <input
            className="input"
            type="url"
            value={value || ''}
            onChange={(event) => { setValidationError(null); onChange(event.target.value.trim()); }}
            placeholder={placeholder}
          />
          <button type="button" className="btn btn-outline btn-sm" onClick={(e) => { e.stopPropagation(); setMediaLibraryOpen(true); }} title="Elegir de la biblioteca">
            📁
          </button>
        </div>
      </div>
      <MediaLibraryModal open={mediaLibraryOpen} onClose={() => setMediaLibraryOpen(false)} onSelect={(url) => { onChange(url); setMediaLibraryOpen(false); }} />
    </div>
  );
}
