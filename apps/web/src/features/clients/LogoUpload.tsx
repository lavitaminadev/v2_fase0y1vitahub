import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../core/api';
import './LogoUpload.css';

interface LogoUploadProps {
  currentLogoUrl?: string;
  clientId: string;
  onSuccess: (logoUrl: string, logoPublicId: string) => void;
  onError?: (error: string) => void;
}

export function LogoUpload({ currentLogoUrl, clientId, onSuccess, onError }: LogoUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(currentLogoUrl || '');
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append('file', file);
      // Call uploads/images endpoint which organizes logos by clientId in Cloudinary
      // The URL query parameter clientId tells the server to organize in vitahub/{orgId}/{clientId}/
      return api.post<{ url: string; publicId: string; width?: number; height?: number }>(
        `/uploads/images?clientId=${encodeURIComponent(clientId)}`,
        body as any,
      );
    },
    onSuccess: (res) => {
      setPreview(res.url);
      setValidationError(null);
      onSuccess(res.url, res.publicId);
    },
    onError: (error: Error) => {
      const msg = error.message || 'Error al subir el logo';
      setValidationError(msg);
      onError?.(msg);
    },
  });

  const validate = (file: File): string | null => {
    const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
    const MAX_SIZE_MB = 2;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Formato no soportado. Usa JPG, PNG, GIF, WebP o AVIF.';
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `El archivo supera los ${MAX_SIZE_MB} MB.`;
    }
    return null;
  };

  const handleFileChange = (file: File | null | undefined) => {
    if (!file) return;
    const error = validate(file);
    if (error) {
      setValidationError(error);
      return;
    }
    setValidationError(null);
    uploadMutation.mutate(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    handleFileChange(e.dataTransfer.files[0]);
  };

  const removeLogo = () => {
    setPreview('');
    setValidationError(null);
    uploadMutation.reset();
    onSuccess('', '');
  };

  const isBusy = uploadMutation.isPending;

  return (
    <div className="logo-upload">
      <div
        className={`logo-preview ${dragOver ? 'drag-over' : ''} ${isBusy ? 'uploading' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,image/avif"
          onChange={(e) => handleFileChange(e.target.files?.[0])}
          style={{ display: 'none' }}
        />
        {preview ? (
          <div className="logo-preview-content">
            <img src={preview} alt="Logo preview" />
          </div>
        ) : (
          <div className="logo-empty-state">
            <span className="logo-icon">🏢</span>
            <strong>{uploadMutation.isPending ? 'Subiendo logo...' : 'Arrastra o haz clic'}</strong>
            <small>PNG, JPG, GIF, WebP o AVIF. Max 2MB</small>
          </div>
        )}
      </div>

      <div className="logo-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => fileInputRef.current?.click()}
          disabled={isBusy}
        >
          {uploadMutation.isPending ? 'Subiendo...' : preview ? 'Cambiar logo' : '+ Subir logo'}
        </button>
        {preview && (
          <button
            type="button"
            className="btn btn-outline btn-danger"
            onClick={removeLogo}
            disabled={isBusy}
          >
            Eliminar
          </button>
        )}
      </div>

      {validationError && (
        <div className="alert alert-error" role="alert">
          {validationError}
        </div>
      )}
    </div>
  );
}
