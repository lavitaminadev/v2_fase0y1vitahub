import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { CloudinaryConfigModal } from '../settings/CloudinaryConfigModal';
import { MetaConnectCard } from './MetaConnectCard';

interface Integration {
  id: string;
  name: string;
  provider: string;
  status: string;
  lastSyncAt?: string;
  config: Record<string, unknown>;
  health?: string;
}

export function IntegrationsPage() {
  const [cloudinaryOpen, setCloudinaryOpen] = useState(false);

  const { data: integrations, isLoading, error } = useQuery<Integration[]>({
    queryKey: ['integrations'],
    queryFn: () => api.get('/integrations'),
  });

  if (isLoading) return <LoadingSpinner text="Cargando integraciones..." />;
  if (error) return <div className="alert alert-error">Error al cargar integraciones</div>;

  const metaIntegration = integrations?.find((item) => item.provider === 'meta');

  return (
    <div className="page">
      <h1>Integraciones de conversiones</h1>
      <p className="page-subtitle">
        En Fase 1 dejamos visible solo lo que conecta campaña, reserva y conversión real: Meta Pixel + CAPI por empresa y Cloudinary global para assets.
      </p>

      <h2>Meta Pixel y Conversions API</h2>
      <MetaConnectCard integration={metaIntegration} />

      <h2>Cloudinary global</h2>
      <section className="integration-card">
        <div className="integration-header">
          <span className="integration-icon">C</span>
          <div className="integration-info">
            <div className="integration-name">Assets visuales de reservas</div>
            <div className="integration-provider">Logos, fondos e imágenes de formularios públicos</div>
          </div>
        </div>
        <p className="page-subtitle">
          Cloudinary se configura una sola vez para VitaHub. Cada formulario guarda sus URLs públicas y, si falla una imagen, la experiencia pública debe seguir funcionando con colores o degradado.
        </p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setCloudinaryOpen(true)}>
          Configurar Cloudinary
        </button>
      </section>

      <div className="alert alert-info">
        Google Ads, Analytics, Calendar, Drive y otras integraciones quedan fuera del flujo visible de Fase 1. La medición activa por ahora vive en Pixel + CAPI.
      </div>

      <CloudinaryConfigModal open={cloudinaryOpen} onClose={() => setCloudinaryOpen(false)} />
    </div>
  );
}
