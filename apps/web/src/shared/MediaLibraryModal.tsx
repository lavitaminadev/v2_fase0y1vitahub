import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../core/api';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { LoadingSpinner } from './LoadingSpinner';

interface CloudinaryResource {
  publicId: string;
  url: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  createdAt: string;
}

interface MediaLibraryProps {
  open: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
}

function thumbnailUrl(resource: CloudinaryResource): string {
  const base = resource.url.replace(/\/upload\//, '/upload/c_fill,w_300,h_200,g_auto,f_auto,q_auto/');
  return base;
}

export function MediaLibraryModal({ open, onClose, onSelect }: MediaLibraryProps) {
  const [deleteTarget, setDeleteTarget] = useState<CloudinaryResource | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['cloudinary-resources'],
    queryFn: () => api.get<{ resources: CloudinaryResource[]; nextCursor?: string }>('/cloudinary/resources'),
    enabled: open,
  });

  const deleteMutation = useMutation({
    mutationFn: (publicId: string) => api.delete(`/uploads/images/cloudinary/${encodeURIComponent(publicId)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cloudinary-resources'] });
      setDeleteTarget(null);
    },
  });

  const handleSelect = (url: string) => {
    onSelect(url);
    onClose();
  };

  const handleCopy = async (url: string, publicId: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedId(publicId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const resources = data?.resources ?? [];

  return (
    <Modal open={open} onClose={onClose} title="Biblioteca de imágenes">
      <div className="media-library">
        {isLoading && <LoadingSpinner text="Cargando imágenes..." />}
        {isError && <div className="alert alert-error">{error instanceof Error ? error.message : 'Error al cargar imágenes'}</div>}
        {!isLoading && !isError && resources.length === 0 && (
          <div className="media-library-empty">
            <span>🖼</span>
            <strong>No hay imágenes subidas</strong>
            <small>Usa el botón "Subir imagen" para agregar la primera.</small>
          </div>
        )}
        <div className="media-library-grid">
          {resources.map((resource) => (
            <div className="media-card" key={resource.publicId}>
              <img
                src={thumbnailUrl(resource)}
                alt={resource.publicId}
                loading="lazy"
                onClick={() => handleSelect(resource.url)}
              />
              <div className="media-card-info">
                <span className="media-card-name">{resource.publicId.split('/').pop()}</span>
                <small>{resource.format?.toUpperCase()} · {(resource.bytes / 1024).toFixed(0)} KB · {resource.width}×{resource.height}</small>
              </div>
              <div className="media-card-actions">
                <button type="button" className="btn btn-sm btn-outline" onClick={() => handleSelect(resource.url)} title="Usar esta imagen">Usar</button>
                <button type="button" className="btn btn-sm btn-outline" onClick={() => handleCopy(resource.url, resource.publicId)} title="Copiar URL">
                  {copiedId === resource.publicId ? '✓ Copiado' : 'Copiar'}
                </button>
                <button type="button" className="btn btn-sm btn-outline btn-danger" onClick={() => setDeleteTarget(resource)} title="Eliminar">🗑</button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Eliminar imagen"
        description={`¿Eliminar ${deleteTarget?.publicId?.split('/').pop()}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        pending={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.publicId)}
      />
    </Modal>
  );
}
