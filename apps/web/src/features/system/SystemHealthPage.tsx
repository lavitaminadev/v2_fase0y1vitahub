import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { Link } from 'react-router-dom';

interface SystemHealth {
  status: 'ok' | 'degraded';
  version: string;
  timestamp: string;
  database: { status: string; connected: boolean; message?: string };
  disk: { status: string; writable: boolean; message?: string };
  memory: { status: string; usagePercent: number };
  redis?: { status: string; connected: boolean | null };
}

interface CapiStats { total: number; pending: number; retry: number; failed: number; processed: number }

function serviceState(ok: boolean, warning = false): { label: string; className: string } {
  if (ok) return { label: 'Operativo', className: 'is-ok' };
  if (warning) return { label: 'Atencion', className: 'is-warn' };
  return { label: 'Bloqueado', className: 'is-error' };
}

export function SystemHealthPage() {
  const healthQuery = useQuery<SystemHealth>({ queryKey: ['system-health-details'], queryFn: () => api.get('/health/details') });
  const capiQuery = useQuery<CapiStats>({ queryKey: ['meta-events-stats-health'], queryFn: () => api.get('/integrations/meta/events/stats') });
  if (healthQuery.isLoading) return <LoadingSpinner text="Revisando sistema..." />;
  if (healthQuery.error) return <QueryErrorState title="No pudimos revisar el sistema" message={healthQuery.error.message} />;

  const health = healthQuery.data!;
  const apiState = serviceState(health.status === 'ok', health.status === 'degraded');
  const dbState = serviceState(health.database.connected);
  const diskState = serviceState(health.disk.writable);
  const memoryState = serviceState(health.memory.status === 'ok', health.memory.status !== 'ok');
  const capiState = serviceState((capiQuery.data?.failed ?? 0) === 0, (capiQuery.data?.retry ?? 0) > 0 || (capiQuery.data?.pending ?? 0) > 0);

  return (
    <div className="page system-health-page">
      <section className="compact-page-head">
        <div><span className="page-eyebrow">SALUD DEL SISTEMA</span><h1>Estado operativo</h1><p>API, base de datos, escritura local y cola de conversiones.</p></div>
        <Link className="btn btn-primary btn-sm" to="/integrations/meta/events">Eventos CAPI</Link>
      </section>
      <section className="health-grid-premium">
        {[['API', apiState, health.version], ['Base de datos', dbState, health.database.message ?? 'Conexion disponible'], ['Disco', diskState, health.disk.message ?? 'Escritura local disponible'], ['Memoria', memoryState, `${Math.round(health.memory.usagePercent)}% uso`], ['Meta CAPI', capiState, `${capiQuery.data?.failed ?? 0} fallos`]].map(([label, state, detail]) => (
          <article className={`health-card-premium ${(state as { className: string }).className}`} key={label as string}>
            <span>{label as string}</span>
            <strong>{(state as { label: string }).label}</strong>
            <small>{detail as string}</small>
          </article>
        ))}
      </section>
      <section className="system-diagnostics">
        <article><span>Actualizado</span><strong>{new Date(health.timestamp).toLocaleString('es-CL')}</strong></article>
        <article><span>CAPI procesados</span><strong>{capiQuery.data?.processed ?? 0}</strong></article>
        <article><span>CAPI pendientes</span><strong>{(capiQuery.data?.pending ?? 0) + (capiQuery.data?.retry ?? 0)}</strong></article>
        <article><span>Redis</span><strong>{health.redis?.status ?? 'No configurado'}</strong></article>
      </section>
    </div>
  );
}
