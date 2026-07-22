import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { Card } from '../../shared/Card';
import { StatusBadge } from '../../shared/StatusBadge';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { useAuth } from '../../core/auth';
import { Modal } from '../../shared/Modal';
import { statusLabel } from '../../shared/status-labels';

interface Pod {
  id: string;
  name: string;
  memberCount: number;
  capacity: number;
  currentLoad: number;
  status: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  currentPieces: number;
  capacity: number;
}

interface OperationsData {
  pods: Pod[];
  team: TeamMember[];
  totalCapacity: number;
  usedCapacity: number;
}

interface AccountCycle {
  id: string;
  clientId: string;
  client?: { name: string };
  year: number;
  month: number;
  status: string;
  gridStatus: string;
  productionStatus: string;
  weeklyMeetingsDue: number;
  weeklyMeetingsCompleted: number;
  strategyMeetingStatus: string;
  reportStatus: string;
}
interface Objective { id: string; title: string; category: string; status: string; progress: number; dueAt?: string; ownerId?: string }
interface UserOption { id: string; name: string; role: string }
interface ClientOption { id: string; name: string }

const PROCESS_STATUSES = ['pending', 'in_progress', 'completed', 'blocked'];
const EMPTY_OBJECTIVE = {
  title: '', category: 'operaciones', description: '', ownerId: '', clientId: '', dueAt: '', progress: 0,
};

export function OperationsPage() {
  const { user } = useAuth();
  const canManageObjectives = ['admin', 'operations_director'].includes(user?.role ?? '');
  const queryClient = useQueryClient();
  const [objectiveOpen, setObjectiveOpen] = useState(false);
  const [objectiveForm, setObjectiveForm] = useState(EMPTY_OBJECTIVE);
  const { data, isLoading, error } = useQuery<OperationsData>({
    queryKey: ['operations'],
    queryFn: () => api.get('/operations/overview'),
  });
  const now = new Date();
  const { data: cycles = [] } = useQuery<AccountCycle[]>({
    queryKey: ['account-cycles', now.getFullYear(), now.getMonth() + 1],
    queryFn: () => api.get(`/account-cycles?year=${now.getFullYear()}&month=${now.getMonth() + 1}`),
  });
  const { data: objectives = [] } = useQuery<Objective[]>({ queryKey: ['objectives'], queryFn: () => api.get('/objectives') });
  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ['users', 'objective-options'],
    queryFn: () => api.get('/users?isActive=true'),
    enabled: canManageObjectives,
  });
  const { data: clients = [] } = useQuery<ClientOption[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
    enabled: canManageObjectives,
  });
  const objectiveMutation = useMutation({ mutationFn: ({ id, progress }: { id: string; progress: number }) => api.put(`/objectives/${id}`, { progress }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['objectives'] }) });
  const createObjective = useMutation({
    mutationFn: () => api.post('/objectives', {
      title: objectiveForm.title.trim(),
      category: objectiveForm.category.trim().toLowerCase().replace(/\s+/g, '_'),
      description: objectiveForm.description.trim() || undefined,
      ownerId: objectiveForm.ownerId || undefined,
      clientId: objectiveForm.clientId || undefined,
      dueAt: objectiveForm.dueAt || undefined,
      progress: objectiveForm.progress,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      setObjectiveOpen(false);
      setObjectiveForm(EMPTY_OBJECTIVE);
    },
  });
  const cycleMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, string | number> }) => api.put(`/account-cycles/${id}`, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['account-cycles'] }),
  });

  if (isLoading) return <LoadingSpinner text="Cargando operaciones..." />;
  if (error) return <div className="alert alert-error">Error al cargar operaciones</div>;
  if (!data) return <div className="alert alert-info">No hay datos de operaciones</div>;

  const utilizationPct = data.totalCapacity > 0 ? Math.round((data.usedCapacity / data.totalCapacity) * 100) : 0;

  return (
    <div className="page">
      <h1>Operaciones</h1>
      <div className="card-grid">
        <Card title="Capacidad Total" value={data.totalCapacity > 0 ? `${data.totalCapacity} UD` : 'Sin definir'} icon="📊" color="#3498db" />
        <Card title="Demanda Actual" value={`${data.usedCapacity} UD`} icon="⚡" color="#e67e22" />
        <Card title="Utilización" value={data.totalCapacity > 0 ? `${utilizationPct}%` : 'Sin definir'} icon="📈" color={utilizationPct > 80 ? '#e74c3c' : '#27ae60'} />
      </div>
      <div className="section">
        <div className="section-title-row">
          <div>
            <h2>Ciclos mensuales</h2>
            <p className="page-subtitle">Control integrado de grilla, produccion, reuniones y reporte del mes.</p>
          </div>
          <span className="cycle-period">{now.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })}</span>
        </div>
        {cycles.length === 0 ? <div className="alert alert-info">Los ciclos se crean al activar el proceso mensual.</div> : (
          <div className="cycle-grid">
            {cycles.map((cycle) => {
              const completed = [cycle.gridStatus, cycle.productionStatus, cycle.strategyMeetingStatus, cycle.reportStatus].filter((value) => value === 'completed').length;
              const progress = Math.round(((completed + Math.min(cycle.weeklyMeetingsCompleted / Math.max(cycle.weeklyMeetingsDue, 1), 1)) / 5) * 100);
              return <article className="cycle-card" key={cycle.id}>
                <div className="cycle-card-head"><strong>{cycle.client?.name ?? cycle.clientId}</strong><StatusBadge status={cycle.status} /></div>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
                <span className="cycle-progress">{progress}% del ciclo</span>
                <div className="cycle-checks">
                  <span>Grilla <StatusBadge status={cycle.gridStatus} /></span>
                  <span>Produccion <StatusBadge status={cycle.productionStatus} /></span>
                  <span>Reuniones {cycle.weeklyMeetingsCompleted}/{cycle.weeklyMeetingsDue}</span>
                  <span>Estrategia <StatusBadge status={cycle.strategyMeetingStatus} /></span>
                  <span>Reporte <StatusBadge status={cycle.reportStatus} /></span>
                </div>
                <div className="cycle-editor" aria-label={`Actualizar ciclo de ${cycle.client?.name ?? 'cliente'}`}>
                  {([
                    ['gridStatus', 'Grilla'],
                    ['productionStatus', 'Producción'],
                    ['strategyMeetingStatus', 'Estrategia'],
                    ['reportStatus', 'Reporte'],
                  ] as const).map(([field, label]) => (
                    <label key={field}>{label}
                      <select
                        className="input"
                        value={cycle[field]}
                        disabled={cycleMutation.isPending}
                        onChange={(event) => cycleMutation.mutate({ id: cycle.id, patch: { [field]: event.target.value } })}
                      >
                        {PROCESS_STATUSES.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
                      </select>
                    </label>
                  ))}
                  <label>Estado del ciclo
                    <select
                      className="input"
                      value={cycle.status}
                      disabled={cycleMutation.isPending}
                      onChange={(event) => cycleMutation.mutate({ id: cycle.id, patch: { status: event.target.value } })}
                    >
                      {['planning', 'active', 'closed'].map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
                    </select>
                  </label>
                  <div className="cycle-meeting-control">
                    <span>Reuniones realizadas</span>
                    <div className="objective-controls">
                      <button className="btn btn-sm btn-outline" type="button" disabled={cycleMutation.isPending || cycle.weeklyMeetingsCompleted <= 0} onClick={() => cycleMutation.mutate({ id: cycle.id, patch: { weeklyMeetingsCompleted: cycle.weeklyMeetingsCompleted - 1 } })}>-</button>
                      <strong>{cycle.weeklyMeetingsCompleted}</strong>
                      <button className="btn btn-sm btn-primary" type="button" disabled={cycleMutation.isPending || cycle.weeklyMeetingsCompleted >= 31} onClick={() => cycleMutation.mutate({ id: cycle.id, patch: { weeklyMeetingsCompleted: cycle.weeklyMeetingsCompleted + 1 } })}>+</button>
                    </div>
                  </div>
                </div>
                {cycleMutation.error && <div className="alert alert-error">No fue posible actualizar el ciclo.</div>}
              </article>;
            })}
          </div>
        )}
      </div>
      <div className="section">
        <h2>Pods</h2>
        {data.pods.length === 0 ? (
          <div className="alert alert-info">La asignación por pods está pendiente de definición operativa. El equipo y la demanda real siguen visibles abajo.</div>
        ) : (
          <div className="pod-grid">
            {data.pods.map((pod) => {
              const loadPct = pod.capacity > 0 ? Math.round((pod.currentLoad / pod.capacity) * 100) : 0;
              return (
                <div key={pod.id} className="pod-card">
                  <div className="pod-header">
                    <span className="pod-name">{pod.name}</span>
                    <StatusBadge status={pod.status} />
                  </div>
                  <div className="pod-stats">
                    <span>{pod.memberCount} miembros</span>
                    <span>{pod.currentLoad}/{pod.capacity} UD</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${loadPct}%`, background: loadPct > 80 ? '#e74c3c' : '#27ae60' }} />
                  </div>
                  <div className="pod-load">{loadPct}%</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <div className="section">
        <h2>Equipo</h2>
        {data.team.length === 0 ? (
          <div className="alert alert-info">No hay miembros en el equipo</div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Piezas Actuales</th>
                  <th>Capacidad</th>
                  <th>Carga</th>
                </tr>
              </thead>
              <tbody>
                {data.team.map((m) => {
                  const load = m.capacity > 0 ? Math.round((m.currentPieces / m.capacity) * 100) : 0;
                  return (
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      <td>{m.role}</td>
                      <td>{m.currentPieces}</td>
                      <td>{m.capacity > 0 ? `${m.capacity} UD` : 'Sin definir'}</td>
                      <td>
                        <div className="progress-bar" style={{ width: '100%' }}>
                          <div className="progress-fill" style={{ width: `${m.capacity > 0 ? load : 0}%`, background: load > 80 ? '#e74c3c' : '#27ae60' }} />
                        </div>
                        <span style={{ fontSize: 12, marginLeft: 8 }}>{m.capacity > 0 ? `${load}%` : 'Pendiente'}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="section">
        <div className="section-title-row">
          <div><h2>Objetivos del equipo</h2><p className="page-subtitle">Seguimiento operativo separado de XP y remuneraciones.</p></div>
          <div className="portal-item-actions">
            <span className="cycle-period">{objectives.filter((item) => item.status === 'active').length} activos</span>
            {canManageObjectives && <button className="btn btn-primary" type="button" onClick={() => setObjectiveOpen(true)}>+ Nuevo objetivo</button>}
          </div>
        </div>
        {objectives.length === 0 ? <div className="alert alert-info">No hay objetivos definidos.</div> : <div className="objective-grid">
          {objectives.map((objective) => <article className="objective-card" key={objective.id}>
            <div className="cycle-card-head"><span className="objective-category">{objective.category}</span><StatusBadge status={objective.status} /></div>
            <h3>{objective.title}</h3>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${objective.progress}%` }} /></div>
            <div className="objective-footer"><span>{objective.progress}%</span>{objective.dueAt && <span>Hasta {new Date(objective.dueAt).toLocaleDateString('es-CL')}</span>}</div>
            {canManageObjectives && <div className="objective-controls"><button className="btn btn-sm btn-outline" disabled={objectiveMutation.isPending || objective.progress <= 0} onClick={() => objectiveMutation.mutate({ id: objective.id, progress: Math.max(0, objective.progress - 10) })}>-10</button><button className="btn btn-sm btn-primary" disabled={objectiveMutation.isPending || objective.progress >= 100} onClick={() => objectiveMutation.mutate({ id: objective.id, progress: Math.min(100, objective.progress + 10) })}>+10</button></div>}
          </article>)}
        </div>}
      </div>
      <Modal open={objectiveOpen} onClose={() => setObjectiveOpen(false)} title="Nuevo objetivo del equipo">
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); createObjective.mutate(); }}>
          <label>Título<input className="input" value={objectiveForm.title} onChange={(event) => setObjectiveForm({ ...objectiveForm, title: event.target.value })} minLength={2} maxLength={255} required /></label>
          <div className="form-row">
            <label>Categoría<input className="input" value={objectiveForm.category} onChange={(event) => setObjectiveForm({ ...objectiveForm, category: event.target.value })} pattern="[A-Za-z0-9 _-]{2,30}" required /></label>
            <label>Fecha objetivo<input className="input" type="date" value={objectiveForm.dueAt} onChange={(event) => setObjectiveForm({ ...objectiveForm, dueAt: event.target.value })} /></label>
          </div>
          <label>Descripción<textarea className="input" rows={4} maxLength={5000} value={objectiveForm.description} onChange={(event) => setObjectiveForm({ ...objectiveForm, description: event.target.value })} /></label>
          <div className="form-row">
            <label>Responsable<select className="input" value={objectiveForm.ownerId} onChange={(event) => setObjectiveForm({ ...objectiveForm, ownerId: event.target.value })}><option value="">Objetivo general</option>{users.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role.replace(/_/g, ' ')}</option>)}</select></label>
            <label>Cuenta asociada<select className="input" value={objectiveForm.clientId} onChange={(event) => setObjectiveForm({ ...objectiveForm, clientId: event.target.value })}><option value="">Sin cuenta específica</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
          </div>
          <label>Progreso inicial: {objectiveForm.progress}%<input type="range" min="0" max="100" step="5" value={objectiveForm.progress} onChange={(event) => setObjectiveForm({ ...objectiveForm, progress: Number(event.target.value) })} /></label>
          {createObjective.error && <div className="alert alert-error">No fue posible crear el objetivo. Revisa los campos y responsables.</div>}
          <button className="btn btn-primary btn-block" disabled={createObjective.isPending}>{createObjective.isPending ? 'Creando...' : 'Crear objetivo'}</button>
        </form>
      </Modal>
    </div>
  );
}
