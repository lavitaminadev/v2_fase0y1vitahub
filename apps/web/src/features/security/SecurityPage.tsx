/**
 * @fileoverview Pantalla de seguridad y privacidad: estado del sistema, política de
 * retención/anonimización de datos personales y bitácora de auditoría.
 *
 * Cada sección solo se muestra si hay un endpoint real que la respalde. No hay
 * datos simulados: si el backend no expone algo (por ejemplo solicitudes ARCO/GDPR
 * con flujo propio), la sección simplemente no existe acá.
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { EmptyState } from '../../shared/EmptyState';
import { PageHero } from '../../shared/PageHero';
import { AuditPanel } from '../governance/AuditPanel';

interface HealthCheckResult {
  status: string;
  connected?: boolean;
  writable?: boolean;
  message?: string;
  usagePercent?: string;
  freeMb?: number;
  totalMb?: number;
}

interface HealthDetails {
  status: string;
  uptime: number;
  timestamp: string;
  version: string;
  database: HealthCheckResult;
  memory: HealthCheckResult;
  disk: HealthCheckResult;
  redis: HealthCheckResult;
}

interface AnonymizationRow {
  id: string;
  entityType: string;
  entityId?: string;
  actorId?: string;
  actorName?: string;
  actorEmail?: string;
  reason?: string;
  occurredAt: string;
}

const ENTITY_LABELS: Record<string, string> = {
  User: 'Usuario', Lead: 'Lead', Contact: 'Contacto de campaña', Reservation: 'Reserva',
};

const STATUS_LABELS: Record<string, string> = {
  ok: 'Operativo', degraded: 'Degradado', error: 'Con errores', warning: 'Advertencia',
  not_configured: 'No configurado', configured_unverified: 'Configurado, sin verificar',
};

function statusColor(status: string): string {
  if (status === 'ok') return 'var(--success)';
  if (status === 'error') return 'var(--error)';
  if (status === 'not_configured') return 'var(--txt-muted)';
  return 'var(--warning)';
}

function StatusPill({ status }: { status: string }) {
  return <span style={{ color: statusColor(status), fontWeight: 600 }}>● {STATUS_LABELS[status] ?? status}</span>;
}

function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours >= 24) return `${Math.floor(hours / 24)} d ${hours % 24} h`;
  return `${hours} h ${minutes} min`;
}

export function SecurityPage() {
  const healthQuery = useQuery<HealthDetails>({
    queryKey: ['security-health'],
    queryFn: () => api.get('/health/details'),
    refetchInterval: 60_000,
  });
  const anonymizationsQuery = useQuery<AnonymizationRow[]>({
    queryKey: ['security-anonymizations'],
    queryFn: () => api.get('/audit?action=anonymize&limit=100'),
  });

  return <div className="page security-page">
    <PageHero
      eyebrow="SEGURIDAD Y PRIVACIDAD"
      title="Qué se protege y qué queda registrado."
      subtitle="Estado del sistema, retención de datos personales y bitácora de auditoría."
    />

    <section>
      <div className="section-toolbar">
        <div><span className="page-eyebrow">RESUMEN</span><h2>Estado del sistema</h2><p>Base de datos, memoria, disco e integraciones, verificados en tiempo real.</p></div>
        <button className="btn btn-outline" onClick={() => healthQuery.refetch()} disabled={healthQuery.isFetching}>{healthQuery.isFetching ? 'Actualizando...' : 'Actualizar'}</button>
      </div>
      {healthQuery.isLoading ? <LoadingSpinner text="Consultando estado del sistema..." /> :
        healthQuery.error ? <QueryErrorState title="No pudimos consultar el estado del sistema" message={healthQuery.error.message} onRetry={() => healthQuery.refetch()} retrying={healthQuery.isFetching} /> :
        healthQuery.data && <div className="security-health-grid">
          <article><span className="page-eyebrow">GENERAL</span><StatusPill status={healthQuery.data.status} /><p>Versión {healthQuery.data.version} · activo hace {formatUptime(healthQuery.data.uptime)}</p></article>
          <article><span className="page-eyebrow">BASE DE DATOS</span><StatusPill status={healthQuery.data.database.status} /><p>{healthQuery.data.database.connected ? 'Conexión activa' : (healthQuery.data.database.message ?? 'Sin conexión')}</p></article>
          <article><span className="page-eyebrow">MEMORIA</span><StatusPill status={healthQuery.data.memory.status} /><p>{healthQuery.data.memory.usagePercent} en uso ({healthQuery.data.memory.freeMb} MB libres de {healthQuery.data.memory.totalMb} MB)</p></article>
          <article><span className="page-eyebrow">DISCO</span><StatusPill status={healthQuery.data.disk.status} /><p>{healthQuery.data.disk.writable ? 'Escritura verificada' : (healthQuery.data.disk.message ?? 'No verificable')}</p></article>
          <article><span className="page-eyebrow">REDIS</span><StatusPill status={healthQuery.data.redis.status} /><p>{healthQuery.data.redis.status === 'not_configured' ? 'No configurado en este entorno' : 'Configurado; sin verificación de ping activa'}</p></article>
        </div>}
    </section>

    <section>
      <div className="section-toolbar">
        <div><span className="page-eyebrow">RETENCIÓN Y ANONIMIZACIÓN</span><h2>Política de datos personales</h2><p>Qué se conserva, por cuánto tiempo y qué se anonimiza al vencer el plazo.</p></div>
      </div>
      <div className="security-policy-grid">
        <article>
          <h3>Reservas</h3>
          <p>Los datos del comensal (nombre, email, teléfono, identificadores de Meta y respuestas del formulario) se anonimizan automáticamente <strong>180 días</strong> después de la fecha de la reserva. Fecha, estado y formulario se conservan para que la analítica de asistencia siga siendo correcta.</p>
        </article>
        <article>
          <h3>Leads (pipeline propio)</h3>
          <p>Los leads descartados se revisan según <code>retentionReviewAt</code> (configurable por <code>CRM_LEAD_RETENTION_DAYS</code>) y se anonimizan automáticamente al vencer: se borra nombre, email, teléfono, empresa y origen detallado.</p>
        </article>
        <article>
          <h3>Contactos de campaña</h3>
          <p>No hay job automático hoy. La anonimización de un contacto (nombre, email, teléfono) es manual, a petición del titular, vía <code>DELETE /data-protection/contacts/:id/anonymize</code>.</p>
        </article>
        <article>
          <h3>Cuenta de usuario</h3>
          <p>Cualquier usuario puede exportar (<code>GET /data-protection/export</code>) o anonimizar (<code>DELETE /data-protection/anonymize</code>) sus propios datos en cualquier momento, conforme a la Ley 19.628.</p>
        </article>
      </div>

      <div className="section-toolbar" style={{ marginTop: '1.5rem' }}>
        <div><h3>Últimas anonimizaciones</h3><p>Registro real tomado de la bitácora de auditoría, filtrado por acción de anonimización.</p></div>
        <button className="btn btn-outline" onClick={() => anonymizationsQuery.refetch()} disabled={anonymizationsQuery.isFetching}>{anonymizationsQuery.isFetching ? 'Actualizando...' : 'Actualizar'}</button>
      </div>
      {anonymizationsQuery.isLoading ? <LoadingSpinner text="Cargando bitácora de anonimizaciones..." /> :
        anonymizationsQuery.error ? <QueryErrorState title="No pudimos cargar la bitácora" message={anonymizationsQuery.error.message} onRetry={() => anonymizationsQuery.refetch()} retrying={anonymizationsQuery.isFetching} /> :
        !anonymizationsQuery.data?.length ? <EmptyState icon="🔒" title="Sin anonimizaciones registradas" description="Todavía no se ha anonimizado ningún dato personal en esta organización." /> :
        <table className="table security-anonymization-table">
          <thead><tr><th>Fecha</th><th>Responsable</th><th>Entidad</th><th>Registro</th><th>Motivo</th></tr></thead>
          <tbody>{anonymizationsQuery.data.map((row) => <tr key={row.id}>
            <td>{new Date(row.occurredAt).toLocaleString('es-CL')}</td>
            <td>{row.actorName ?? 'Sistema (job automático)'}</td>
            <td>{ENTITY_LABELS[row.entityType] ?? row.entityType}</td>
            <td>{row.entityId ? `${row.entityId.slice(0, 8)}…` : '—'}</td>
            <td>{row.reason ?? '—'}</td>
          </tr>)}</tbody>
        </table>}
    </section>

    <section>
      <div className="section-toolbar"><div><span className="page-eyebrow">AUDITORÍA</span><h2>Bitácora de cambios</h2></div></div>
      <AuditPanel />
    </section>
  </div>;
}
