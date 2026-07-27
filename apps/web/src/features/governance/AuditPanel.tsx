import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { DataTable } from '../../shared/DataTable';
import { Modal } from '../../shared/Modal';
import { matchesSearch } from '../../shared/search';

interface AuditRow {
  [key: string]: unknown;
  id: string; entityType: string; entityId?: string; action: string; actorId?: string; actorName?: string; actorEmail?: string;
  after?: unknown; reason?: string; ipAddress?: string; occurredAt: string;
}

const ACTION_LABELS: Record<string, string> = { create: 'Creación', update: 'Actualización', delete: 'Eliminación', publish: 'Publicación', unpublish: 'Volver a borrador', reset_password: 'Reset de clave', accept: 'Aceptación', send: 'Envío' };
const ENTITY_LABELS: Record<string, string> = { users: 'Usuarios', clients: 'Clientes', production: 'Producción', content: 'Contenido', meetings: 'Reuniones', catalog: 'Catálogo', contracts: 'Contratos', reporting: 'Reportes', workflows: 'Flujos', pods: 'Pods', settings: 'Configuración', auth: 'Acceso' };

export function AuditPanel() {
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState('');
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const query = useQuery<AuditRow[]>({ queryKey: ['audit-log'], queryFn: () => api.get('/audit?limit=300') });
  const all = query.data ?? [];
  const entities = [...new Set(all.map((row) => row.entityType))].sort();
  const rows = all.filter((row) => (!entity || row.entityType === entity) && matchesSearch(search, [row.actorName, row.actorEmail, row.entityType, row.action, row.entityId]));
  const payload = selected?.after == null ? null : typeof selected.after === 'string' ? (() => { try { return JSON.parse(selected.after); } catch { return selected.after; } })() : selected.after;

  return <section className="audit-workspace">
    <div className="section-toolbar"><div><span className="page-eyebrow">TRAZABILIDAD</span><h2>Bitácora de cambios</h2><p>Cada operación relevante queda asociada a persona, fecha, origen y datos no sensibles.</p></div><button className="btn btn-outline" onClick={() => query.refetch()} disabled={query.isFetching}>{query.isFetching ? 'Actualizando...' : 'Actualizar'}</button></div>
    <div className="audit-integrity-note"><span>✓</span><div><strong>Registro automático activo</strong><p>Contraseñas, tokens, secretos y credenciales se eliminan antes de guardar la evidencia.</p></div></div>
    <div className="filters"><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar actor, módulo, acción o identificador..." /><select className="input" value={entity} onChange={(event) => setEntity(event.target.value)}><option value="">Todos los módulos</option>{entities.map((value) => <option key={value} value={value}>{ENTITY_LABELS[value] ?? value}</option>)}</select></div>
    {query.error ? <div className="alert alert-error">No se pudo cargar la bitácora: {query.error.message}</div> : <DataTable<AuditRow> loading={query.isLoading} data={rows} keyExtractor={(row) => row.id} emptyMessage="Aún no existen cambios registrados para este filtro." columns={[
      { key: 'occurredAt', label: 'Fecha', sortable: true, render: (row) => new Date(row.occurredAt).toLocaleString('es-CL') },
      { key: 'actorName', label: 'Responsable', render: (row) => <span className="audit-actor"><strong>{row.actorName ?? 'Sistema'}</strong><small>{row.actorEmail}</small></span> },
      { key: 'entityType', label: 'Módulo', render: (row) => ENTITY_LABELS[row.entityType] ?? row.entityType },
      { key: 'action', label: 'Acción', render: (row) => <span className="audit-action">{ACTION_LABELS[row.action] ?? row.action.replaceAll('_', ' ')}</span> },
      { key: 'ipAddress', label: 'Origen', render: (row) => row.ipAddress ?? 'Interno' },
      { key: 'id', label: 'Evidencia', render: (row) => <button className="btn btn-sm btn-outline" onClick={() => setSelected(row)}>Ver detalle</button> },
    ]} />}
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Detalle de auditoría"><div className="audit-detail"><dl><div><dt>Responsable</dt><dd>{selected?.actorName ?? 'Sistema'}</dd></div><div><dt>Fecha</dt><dd>{selected ? new Date(selected.occurredAt).toLocaleString('es-CL') : ''}</dd></div><div><dt>Módulo</dt><dd>{selected ? ENTITY_LABELS[selected.entityType] ?? selected.entityType : ''}</dd></div><div><dt>Acción</dt><dd>{selected ? ACTION_LABELS[selected.action] ?? selected.action : ''}</dd></div><div><dt>Registro</dt><dd>{selected?.entityId ?? 'Operación global'}</dd></div><div><dt>IP</dt><dd>{selected?.ipAddress ?? 'No informada'}</dd></div></dl><h3>Datos asociados</h3><pre>{payload == null ? 'Sin datos adicionales' : JSON.stringify(payload, null, 2)}</pre></div></Modal>
  </section>;
}
