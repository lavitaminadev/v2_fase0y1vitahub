import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { CloudinaryConfigModal } from '../settings/CloudinaryConfigModal';
import { MetaConnectCard } from './MetaConnectCard';
import { MeasurementCenter } from './MeasurementCenter';

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
      <p className="page-subtitle">Conexion Meta y reservas para conversiones.</p>

      <h2>Centro de medicion</h2>
      <MeasurementCenter />

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
        <p className="page-subtitle">Sube logos e imágenes con tus credenciales.</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setCloudinaryOpen(true)}>
          Configurar Cloudinary
        </button>
      </section>

      <div className="alert alert-info">
        Google estará disponible en futuras fases.
      </div>

      <CloudinaryConfigModal open={cloudinaryOpen} onClose={() => setCloudinaryOpen(false)} />
    </div>
  );
}
