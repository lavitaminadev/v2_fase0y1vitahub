import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { Modal } from '../../shared/Modal';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { StatusBadge } from '../../shared/StatusBadge';
import { matchesSearch } from '../../shared/search';
import { EmptyState } from '../../shared/EmptyState';
import { statusLabel } from '../../shared/status-labels';

interface ClientOption { id: string; name: string }
interface UserOption { id: string; name: string; role: string }
interface Moodboard {
  id: string; clientId: string; title: string; description?: string; images?: string[];
  status: string; client?: ClientOption; createdAt: string;
}
interface Session {
  id: string; clientId: string; type: string; date: string; location?: string;
  assignedTeam?: string[]; moodboardId?: string; status: string; client?: ClientOption;
}
interface PageResult<T> { data: T[]; total: number }

const EMPTY_MOODBOARD = { clientId: '', title: '', description: '', images: '' };
const EMPTY_SESSION = { clientId: '', type: 'recording', date: '', location: '', moodboardId: '', assignedTeam: [] as string[] };

export function AudiovisualPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'sessions' | 'moodboards'>('sessions');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [moodboardOpen, setMoodboardOpen] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [moodboardForm, setMoodboardForm] = useState(EMPTY_MOODBOARD);
  const [sessionForm, setSessionForm] = useState(EMPTY_SESSION);
  const [confirmDialog, setConfirmDialog] = useState<{ type: 'session-confirm' | 'session-complete' | 'moodboard-approve' | null; id: string | null }>({ type: null, id: null });

  const canManageMoodboards = ['admin', 'creative_director', 'av_director'].includes(user?.role ?? '');
  const canManageSessions = ['admin', 'operations_director', 'av_director'].includes(user?.role ?? '');
  const canSeeMoodboards = user?.role !== 'audiovisual';

  const { data: sessionResult, isLoading: sessionsLoading, error: sessionsError } = useQuery<PageResult<Session>>({
    queryKey: ['av-sessions'],
    queryFn: () => api.get('/sessions?limit=100'),
  });
  const { data: moodboardResult, isLoading: moodboardsLoading } = useQuery<PageResult<Moodboard>>({
    queryKey: ['moodboards'],
    queryFn: () => api.get('/moodboards?limit=100'),
    enabled: canSeeMoodboards,
  });
  const { data: clients = [] } = useQuery<ClientOption[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
    enabled: canManageMoodboards || canManageSessions,
  });
  const { data: assignees = [] } = useQuery<UserOption[]>({
    queryKey: ['production-assignees'],
    queryFn: () => api.get('/production/pieces/options/assignees'),
    enabled: canManageSessions,
  });

  const createMoodboard = useMutation({
    mutationFn: () => api.post('/moodboards', {
      clientId: moodboardForm.clientId,
      title: moodboardForm.title.trim(),
      description: moodboardForm.description.trim() || undefined,
      images: moodboardForm.images.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moodboards'] });
      setMoodboardOpen(false);
      setMoodboardForm(EMPTY_MOODBOARD);
    },
  });
  const createSession = useMutation({
    mutationFn: () => api.post('/sessions', {
      clientId: sessionForm.clientId,
      type: sessionForm.type.trim(),
      date: sessionForm.date,
      location: sessionForm.location.trim() || undefined,
      moodboardId: sessionForm.moodboardId || undefined,
      assignedTeam: sessionForm.assignedTeam,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['av-sessions'] });
      setSessionOpen(false);
      setSessionForm(EMPTY_SESSION);
    },
  });
  const updateMoodboard = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/moodboards/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['moodboards'] }),
  });
  const updateSession = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/sessions/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['av-sessions'] }),
  });

  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client.name])), [clients]);
  const userMap = useMemo(() => new Map(assignees.map((member) => [member.id, member.name])), [assignees]);
  const moodboardMap = useMemo(() => new Map((moodboardResult?.data ?? []).map((item) => [item.id, item.title])), [moodboardResult]);
  const sessions = (sessionResult?.data ?? []).filter((item) =>
    (!status || item.status === status)
    && matchesSearch(search, [item.type, item.location, item.client?.name, clientMap.get(item.clientId)]),
  );
  const moodboards = (moodboardResult?.data ?? []).filter((item) =>
    (!status || item.status === status)
    && matchesSearch(search, [item.title, item.description, item.client?.name, clientMap.get(item.clientId)]),
  );

  if (sessionsLoading) return <LoadingSpinner text="Cargando operación audiovisual..." />;
  if (sessionsError) return <div className="alert alert-error">No fue posible cargar las sesiones audiovisuales.</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <span className="page-eyebrow">PRODUCCIÓN AUDIOVISUAL</span>
          <h1>Sesiones y moodboards</h1>
          <p className="page-subtitle">Planifica referencias, jornadas de grabación y responsables sin mezclar este flujo con diseño gráfico.</p>
        </div>
        <div className="portal-item-actions">
          {canManageMoodboards && <button className="btn btn-outline" type="button" onClick={() => setMoodboardOpen(true)}>+ Moodboard</button>}
          {canManageSessions && <button className="btn btn-primary" type="button" onClick={() => setSessionOpen(true)}>+ Nueva sesión</button>}
        </div>
      </div>

      <div className="attention-strip">
        <div><span className="attention-kicker">Agenda AV</span><strong>{sessions.filter((item) => ['scheduled', 'confirmed'].includes(item.status)).length} sesiones próximas</strong><small>{sessions.filter((item) => item.status === 'completed').length} completadas en el registro visible.</small></div>
      </div>

      <div className="tabs" role="tablist" aria-label="Vista audiovisual">
        <button className={`tab ${tab === 'sessions' ? 'active' : ''}`} onClick={() => setTab('sessions')} role="tab" aria-selected={tab === 'sessions'}>Sesiones</button>
        {canSeeMoodboards && <button className={`tab ${tab === 'moodboards' ? 'active' : ''}`} onClick={() => setTab('moodboards')} role="tab" aria-selected={tab === 'moodboards'}>Moodboards</button>}
      </div>
      <div className="filters">
        <input className="input" type="search" placeholder={tab === 'sessions' ? 'Buscar sesión, cliente o lugar...' : 'Buscar moodboard o cliente...'} value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="input" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todos los estados</option>
          {(tab === 'sessions'
            ? ['scheduled', 'confirmed', 'completed', 'rescheduled', 'cancelled']
            : ['draft', 'review', 'approved', 'rejected']
          ).map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}
        </select>
      </div>

      {tab === 'sessions' ? (
        sessions.length ? <div className="portal-list">{sessions.map((item) => (
          <article className="card portal-item-card" key={item.id}>
            <div>
              <div className="cycle-card-head"><span className="objective-category">{item.type}</span><StatusBadge status={item.status} /></div>
              <h3>{item.client?.name ?? clientMap.get(item.clientId) ?? 'Cuenta asignada'}</h3>
              <p>{new Date(item.date).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}{item.location ? ` · ${item.location}` : ''}</p>
              {item.moodboardId && <small>Moodboard: {moodboardMap.get(item.moodboardId) ?? 'Referencia vinculada'}</small>}
              <div className="portal-item-actions">{(item.assignedTeam ?? []).map((id) => <span className="date-chip" key={id}>{userMap.get(id) ?? (id === user?.id ? 'Tú' : 'Equipo asignado')}</span>)}</div>
            </div>
            {canManageSessions && <div className="portal-item-actions">
              {item.status !== 'confirmed' && item.status !== 'completed' && <button className="btn btn-sm btn-outline" onClick={() => setConfirmDialog({ type: 'session-confirm', id: item.id })}>Confirmar</button>}
              {item.status !== 'completed' && <button className="btn btn-sm btn-primary" onClick={() => setConfirmDialog({ type: 'session-complete', id: item.id })}>Completar</button>}
            </div>}
          </article>
        ))}</div> : <EmptyState icon="🎬" title="Sin sesiones" description="No se encontraron sesiones con los filtros aplicados." action={canManageSessions ? <button className="btn btn-primary" type="button" onClick={() => setSessionOpen(true)}>+ Nueva sesión</button> : undefined} />
      ) : moodboardsLoading ? <LoadingSpinner text="Cargando moodboards..." /> : (
        moodboards.length ? <div className="objective-grid">{moodboards.map((item) => (
          <article className="objective-card" key={item.id}>
            <div className="cycle-card-head"><span className="objective-category">{item.client?.name ?? clientMap.get(item.clientId) ?? 'Cliente'}</span><StatusBadge status={item.status} /></div>
            <h3>{item.title}</h3>
            <p>{item.description || 'Sin descripción adicional.'}</p>
            <small>{item.images?.length ?? 0} referencias visuales</small>
            {canManageMoodboards && <div className="objective-controls">
              {item.status === 'draft' && <button className="btn btn-sm btn-outline" onClick={() => updateMoodboard.mutate({ id: item.id, status: 'review' })}>Enviar a revisión</button>}
              {item.status !== 'approved' && <button className="btn btn-sm btn-primary" onClick={() => setConfirmDialog({ type: 'moodboard-approve', id: item.id })}>Aprobar</button>}
            </div>}
          </article>
        ))}</div> : <EmptyState icon="🎨" title="Sin moodboards" description="No se encontraron moodboards con los filtros aplicados." action={canManageMoodboards ? <button className="btn btn-outline" type="button" onClick={() => setMoodboardOpen(true)}>+ Moodboard</button> : undefined} />
      )}
      {(updateMoodboard.error || updateSession.error) && <div className="alert alert-error">No fue posible actualizar el estado. Intenta nuevamente.</div>}

      <Modal open={moodboardOpen} onClose={() => setMoodboardOpen(false)} title="Nuevo moodboard">
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); createMoodboard.mutate(); }}>
          <label>Cliente<select className="input" value={moodboardForm.clientId} onChange={(event) => setMoodboardForm({ ...moodboardForm, clientId: event.target.value })} required><option value="">Selecciona una cuenta</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
          <label>Título<input className="input" value={moodboardForm.title} onChange={(event) => setMoodboardForm({ ...moodboardForm, title: event.target.value })} maxLength={255} required /></label>
          <label>Dirección visual<textarea className="input" rows={4} value={moodboardForm.description} onChange={(event) => setMoodboardForm({ ...moodboardForm, description: event.target.value })} /></label>
          <label>Referencias <small>Una URL HTTPS por línea</small><textarea className="input" rows={5} value={moodboardForm.images} onChange={(event) => setMoodboardForm({ ...moodboardForm, images: event.target.value })} placeholder="https://..." /></label>
          {createMoodboard.error && <div className="alert alert-error">Revisa el cliente y las URLs de referencia.</div>}
          <button className="btn btn-primary btn-block" disabled={createMoodboard.isPending}>{createMoodboard.isPending ? 'Creando...' : 'Crear moodboard'}</button>
        </form>
      </Modal>

      <Modal open={sessionOpen} onClose={() => setSessionOpen(false)} title="Nueva sesión audiovisual">
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); createSession.mutate(); }}>
          <div className="form-row">
            <label>Cliente<select className="input" value={sessionForm.clientId} onChange={(event) => setSessionForm({ ...sessionForm, clientId: event.target.value, moodboardId: '' })} required><option value="">Selecciona una cuenta</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
            <label>Tipo<input className="input" value={sessionForm.type} onChange={(event) => setSessionForm({ ...sessionForm, type: event.target.value.toLowerCase().replace(/\s+/g, '_') })} placeholder="recording" required /></label>
          </div>
          <div className="form-row">
            <label>Fecha<input className="input" type="date" value={sessionForm.date} onChange={(event) => setSessionForm({ ...sessionForm, date: event.target.value })} required /></label>
            <label>Lugar<input className="input" value={sessionForm.location} onChange={(event) => setSessionForm({ ...sessionForm, location: event.target.value })} /></label>
          </div>
          <label>Moodboard<select className="input" value={sessionForm.moodboardId} onChange={(event) => setSessionForm({ ...sessionForm, moodboardId: event.target.value })}><option value="">Sin moodboard</option>{(moodboardResult?.data ?? []).filter((item) => item.clientId === sessionForm.clientId).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <label>Equipo asignado<select className="input" multiple size={Math.min(Math.max(assignees.length, 3), 7)} value={sessionForm.assignedTeam} onChange={(event) => setSessionForm({ ...sessionForm, assignedTeam: Array.from(event.currentTarget.selectedOptions, (option) => option.value) })}>{assignees.filter((member) => ['audiovisual', 'av_director'].includes(member.role)).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select><small>Usa Ctrl o Cmd para seleccionar más de una persona.</small></label>
          {createSession.error && <div className="alert alert-error">No fue posible crear la sesión. Revisa cliente, fecha y equipo.</div>}
          <button className="btn btn-primary btn-block" disabled={createSession.isPending}>{createSession.isPending ? 'Creando...' : 'Crear sesión'}</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDialog.type)}
        title={
          confirmDialog.type === 'session-confirm' ? 'Confirmar sesión' :
          confirmDialog.type === 'session-complete' ? 'Completar sesión' :
          'Aprobar moodboard'
        }
        description={
          confirmDialog.type === 'session-confirm' ? 'La sesión quedará confirmada en la agenda audiovisual.' :
          confirmDialog.type === 'session-complete' ? 'La sesión se marcará como completada. Esta acción no se puede deshacer.' :
          'El moodboard quedará aprobado como referencia visual definitiva.'
        }
        confirmLabel={
          confirmDialog.type === 'session-confirm' ? 'Confirmar' :
          confirmDialog.type === 'session-complete' ? 'Completar' :
          'Aprobar'
        }
        pending={updateSession.isPending || updateMoodboard.isPending}
        onClose={() => setConfirmDialog({ type: null, id: null })}
        onConfirm={() => {
          if (!confirmDialog.id) return;
          if (confirmDialog.type === 'session-confirm') updateSession.mutate({ id: confirmDialog.id, status: 'confirmed' }, { onSuccess: () => setConfirmDialog({ type: null, id: null }) });
          else if (confirmDialog.type === 'session-complete') updateSession.mutate({ id: confirmDialog.id, status: 'completed' }, { onSuccess: () => setConfirmDialog({ type: null, id: null }) });
          else updateMoodboard.mutate({ id: confirmDialog.id, status: 'approved' }, { onSuccess: () => setConfirmDialog({ type: null, id: null }) });
        }}
      />
    </div>
  );
}
