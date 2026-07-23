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
      <p className="page-subtitle">Conecta tus campañas de Meta con las reservas para medir conversiones reales.</p>

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
        <p className="page-subtitle">Configura Cloudinary para subir logos e imágenes de fondo. Las credenciales son tuyas.</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setCloudinaryOpen(true)}>
          Configurar Cloudinary
        </button>
      </section>

      <div className="alert alert-info">
        Google Ads, Analytics, Calendar y Drive estarán disponibles en futuras fases.
      </div>

      <CloudinaryConfigModal open={cloudinaryOpen} onClose={() => setCloudinaryOpen(false)} />
    </div>
  );
}
