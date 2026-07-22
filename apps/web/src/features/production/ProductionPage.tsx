import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { StatusBadge } from '../../shared/StatusBadge';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { Modal } from '../../shared/Modal';
import { EmptyState } from '../../shared/EmptyState';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../core/auth';
import { QueryErrorState } from '../../shared/QueryErrorState';

interface Piece {
  id: string;
  title: string;
  type: string;
  status: string;
  udAmount: number;
  correctionCount: number;
  difficultyLevel?: number;
  clientName: string;
  assignedTo?: string;
  dueDate?: string;
  dependencyIds?: string[];
  createdAt: string;
  assignedAt?: string;
}

interface UserOption {
  id: string;
  name: string;
  role: string;
  weeklyCapacityUd?: number;
}

interface ClientOption {
  id: string;
  name: string;
}

interface PieceFormState {
  clientId: string;
  title: string;
  type: string;
  difficultyLevel: string;
  carouselSlides: string;
  deadlineAt: string;
  description: string;
  dependencyIds: string[];
}

const EMPTY_FORM: PieceFormState = {
  clientId: '',
  title: '',
  type: 'post_simple',
  difficultyLevel: '1',
  carouselSlides: '2',
  deadlineAt: '',
  description: '',
  dependencyIds: [],
};

const PIECE_TYPES = [
  ['post_simple', 'Post simple'],
  ['post_author', 'Post de autor'],
  ['carousel', 'Carrusel'],
  ['story_original', 'Historia original'],
  ['story_adapted', 'Historia adaptada'],
  ['story_template', 'Historia con plantilla'],
  ['reel_cover', 'Portada de reel'],
  ['flyer_digital', 'Flyer digital'],
  ['flyer_print', 'Flyer para impresión'],
] as const;

const ROLE_LABELS: Record<string, string> = {
  designer: 'Diseño',
  audiovisual: 'Audiovisual',
  art_director: 'Dirección de arte',
};

function getErrorMessage(error: Error): string {
  return error.message || 'No se pudo completar la operación.';
}

export function ProductionPage() {
  const [searchParams] = useSearchParams();
  const currentUser = useAuth((state) => state.user);
  const [viewMode, setViewMode] = useState<'board' | 'table' | 'gantt'>('board');
  const [assignModal, setAssignModal] = useState<{ open: boolean; pieceId: string }>({ open: false, pieceId: '' });
  const [versionModal, setVersionModal] = useState<{ open: boolean; pieceId: string }>({ open: false, pieceId: '' });
  const [createModalOpen, setCreateModalOpen] = useState(searchParams.get('create') === '1');
  const [assigneeId, setAssigneeId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [clientFilter, setClientFilter] = useState(searchParams.get('clientId') ?? '');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [form, setForm] = useState<PieceFormState>(EMPTY_FORM);
  const [versionForm, setVersionForm] = useState({ fileName: '', driveFileId: '' });
  const queryClient = useQueryClient();
  const role = currentUser?.role ?? '';
  const canAssign = ['admin', 'art_director', 'operations_director'].includes(role);
  const canCreate = canAssign;
  const canStart = ['admin', 'art_director', 'operations_director', 'designer', 'audiovisual'].includes(role);
  const canSubmitVersion = ['admin', 'art_director', 'designer', 'audiovisual'].includes(role);
  const canSendToClient = ['admin', 'art_director', 'operations_director'].includes(role);
  const canDeliver = canSendToClient;

  const pieceQuery = new URLSearchParams();
  if (statusFilter) pieceQuery.set('status', statusFilter);
  if (clientFilter) pieceQuery.set('clientId', clientFilter);
  const querySuffix = pieceQuery.size ? `?${pieceQuery}` : '';

  const { data: pieces, isLoading, error, refetch, isFetching } = useQuery<Piece[]>({
    queryKey: ['pieces', statusFilter, clientFilter],
    queryFn: () => api.get(`/production/pieces${querySuffix}`),
  });

  const { data: users } = useQuery<UserOption[]>({
    queryKey: ['production-assignees'],
    queryFn: () => api.get('/production/pieces/options/assignees'),
    enabled: canAssign,
  });

  const { data: clients } = useQuery<ClientOption[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
    enabled: canCreate,
  });

  const assignableUsers = useMemo(
    () => (users ?? []).filter((user) => ['designer', 'audiovisual', 'art_director'].includes(user.role)),
    [users],
  );

  const userMap = useMemo(
    () => new Map(assignableUsers.map((user) => [user.id, user.name])),
    [assignableUsers],
  );

  const capacityMap = useMemo(
    () => new Map(assignableUsers.map((user) => [user.id, Number(user.weeklyCapacityUd ?? 20)])),
    [assignableUsers],
  );

  const workload = useMemo(() => {
    const loads = new Map<string, { userId: string; name: string; ud: number; pieces: number; capacity: number }>();
    for (const piece of pieces ?? []) {
      if (!piece.assignedTo || ['delivered', 'cancelled'].includes(piece.status)) continue;
      const current = loads.get(piece.assignedTo) || { userId: piece.assignedTo, name: userMap.get(piece.assignedTo) || 'Responsable', ud: 0, pieces: 0, capacity: capacityMap.get(piece.assignedTo) || 20 };
      current.ud += Number(piece.udAmount || 0); current.pieces += 1; loads.set(piece.assignedTo, current);
    }
    return [...loads.values()].sort((a, b) => b.ud / Math.max(b.capacity, 1) - a.ud / Math.max(a.capacity, 1));
  }, [pieces, userMap, capacityMap]);

  const ganttStart = useMemo(() => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - 7); return date; }, []);
  const ganttDays = 42;
  const ganttPosition = (piece: Piece) => {
    const start = new Date(piece.assignedAt || piece.createdAt || ganttStart);
    const end = new Date(piece.dueDate || new Date(start.getTime() + 7 * 86400000));
    const left = Math.max(0, Math.min(100, (start.getTime() - ganttStart.getTime()) / 86400000 / ganttDays * 100));
    const naturalWidth = Math.max(2.5, (end.getTime() - start.getTime()) / 86400000 / ganttDays * 100);
    return { left, width: Math.min(100 - left, naturalWidth) };
  };

  const refreshPieces = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ['pieces'] });
    setFeedbackMessage(message);
  };

  const workflowColumns = [
    ['backlog', 'Backlog'], ['assigned', 'Asignado'], ['in_progress', 'En progreso'],
    ['internal_review', 'Revision interna'], ['client_validation', 'Cliente'],
    ['correction', 'Correccion'], ['approved', 'Aprobado'], ['delivered', 'Entregado'],
  ] as const;

  const renderActions = (piece: Piece) => <div className="kanban-card-actions">
    {canAssign && piece.status !== 'delivered' && <button className="btn btn-sm btn-outline" onClick={() => { setFeedbackMessage(null); setAssignModal({ open: true, pieceId: piece.id }); }}>{piece.assignedTo ? 'Reasignar' : 'Asignar'}</button>}
    {canStart && piece.status === 'assigned' && <button className="btn btn-sm btn-outline" onClick={() => transitionMutation.mutate({ pieceId: piece.id, action: 'start' })}>Iniciar</button>}
    {canStart && piece.status === 'correction' && <button className="btn btn-sm btn-outline" onClick={() => transitionMutation.mutate({ pieceId: piece.id, action: 'start' })}>Retomar</button>}
    {canSubmitVersion && piece.status === 'in_progress' && <button className="btn btn-sm btn-primary" onClick={() => { setFeedbackMessage(null); setVersionForm({ fileName: '', driveFileId: '' }); setVersionModal({ open: true, pieceId: piece.id }); }}>Enviar versión</button>}
    {canSendToClient && piece.status === 'internal_review' && <button className="btn btn-sm btn-outline" onClick={() => transitionMutation.mutate({ pieceId: piece.id, action: 'send-to-client' })}>Enviar cliente</button>}
    {piece.status === 'client_validation' && <Link className="btn btn-sm btn-outline" to="/approvals">Ver aprobación</Link>}
    {canDeliver && piece.status === 'approved' && <button className="btn btn-sm btn-outline" onClick={() => transitionMutation.mutate({ pieceId: piece.id, action: 'deliver' })}>Entregar</button>}
  </div>;

  const assignMutation = useMutation({
    mutationFn: ({ id, designerId }: { id: string; designerId: string }) =>
      api.post(`/production/pieces/${id}/assign`, { designerId }),
    onSuccess: () => {
      void refreshPieces('Pieza asignada correctamente.');
      setAssignModal({ open: false, pieceId: '' });
      setAssigneeId('');
    },
    onError: (error: Error) => setFeedbackMessage(`Error: ${getErrorMessage(error)}`),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/production/pieces', body),
    onSuccess: () => {
      void refreshPieces('Pieza creada y enviada al tablero.');
      setCreateModalOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (error: Error) => setFeedbackMessage(`Error: ${getErrorMessage(error)}`),
  });

  const transitionMutation = useMutation({
    mutationFn: ({ pieceId, action }: { pieceId: string; action: 'start' | 'send-to-client' | 'deliver' }) =>
      api.post(`/production/pieces/${pieceId}/${action}`),
    onSuccess: (_data, variables) => {
      const messages: Record<string, string> = {
        start: 'La pieza paso a En progreso.',
        'send-to-client': 'La pieza fue enviada a validacion del cliente.',
        deliver: 'La pieza fue marcada como entregada.',
      };
      void refreshPieces(messages[variables.action]);
    },
    onError: (error: Error) => setFeedbackMessage(`Error: ${getErrorMessage(error)}`),
  });

  const versionMutation = useMutation({
    mutationFn: ({ pieceId, fileName, driveFileId }: { pieceId: string; fileName: string; driveFileId?: string }) =>
      api.post(`/production/pieces/${pieceId}/versions`, { fileName, driveFileId }),
    onSuccess: () => {
      void refreshPieces('Versión registrada y enviada a revisión interna.');
      setVersionModal({ open: false, pieceId: '' });
      setVersionForm({ fileName: '', driveFileId: '' });
    },
    onError: (error: Error) => setFeedbackMessage(`Error: ${getErrorMessage(error)}`),
  });

  if (isLoading) return <LoadingSpinner text="Cargando piezas..." />;
  if (error) return <QueryErrorState title="No pudimos cargar el plan de producción" message={error.message} onRetry={() => void refetch()} retrying={isFetching} />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Produccion</h1>
          <p className="page-subtitle">Flujo alineado al Maestro: backlog, asignacion, progreso, revision interna, validacion cliente, correccion, aprobado y entregado.</p>
        </div>
        <div className="portal-item-actions">
          <div className="view-switch" role="group" aria-label="Vista de produccion">
            <button className={`btn btn-sm ${viewMode === 'board' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('board')}>Tablero</button>
            <button className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('table')}>Tabla</button>
            <button className={`btn btn-sm ${viewMode === 'gantt' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setViewMode('gantt')}>Gantt y carga</button>
          </div>
          <select className="input" aria-label="Filtrar piezas por estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="backlog">Backlog</option>
            <option value="assigned">Asignado</option>
            <option value="in_progress">En progreso</option>
            <option value="internal_review">Revision interna</option>
            <option value="client_validation">Validacion cliente</option>
            <option value="correction">Correccion</option>
            <option value="approved">Aprobado</option>
            <option value="delivered">Entregado</option>
          </select>
          {canCreate && <select className="input" aria-label="Filtrar piezas por cliente" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}><option value="">Todos los clientes</option>{(clients ?? []).map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select>}
          {canCreate && <button className="btn btn-primary" onClick={() => { setFeedbackMessage(null); setForm((current) => ({ ...current, clientId: clientFilter })); setCreateModalOpen(true); }}>
            Nueva pieza
          </button>}
        </div>
      </div>

      {feedbackMessage && (
        <div className={`alert ${feedbackMessage.startsWith('Error:') ? 'alert-error' : 'alert-success'}`} role="alert">
          {feedbackMessage}
        </div>
      )}

      {workload.length > 0 && <section className="production-capacity"><header><div><span className="page-eyebrow">CAPACIDAD CONFIGURADA</span><h2>Carga activa por trabajador</h2></div><small>La capacidad semanal se edita en Usuarios</small></header><div>{workload.map((member) => { const usage = Math.round(member.ud / Math.max(member.capacity, 1) * 100); return <article className={usage > 100 ? 'is-overcapacity' : ''} key={member.userId}><div><strong>{member.name}</strong><span>{member.pieces} pieza(s)</span></div><div className="capacity-track"><i style={{ width: `${Math.min(usage, 100)}%` }} /></div><footer><span>{member.ud} / {member.capacity} UD</span><strong>{usage}%{usage > 100 ? ' · Sobrecapacidad' : ''}</strong></footer></article>; })}</div></section>}

      {(pieces?.length ?? 0) === 0 ? (
        <EmptyState
          icon="[]"
          title="Sin piezas en produccion"
          description="Todavia no hay piezas activas para este filtro."
        />
      ) : viewMode === 'board' ? (
        <div className="production-board">
          {workflowColumns.map(([status, label]) => {
            const columnPieces = pieces?.filter((piece) => piece.status === status) ?? [];
            return <section className="kanban-column" key={status}>
              <div className="kanban-header"><strong>{label}</strong><span className="kanban-count">{columnPieces.length}</span></div>
              <div className="kanban-cards">{columnPieces.length === 0 ? <div className="kanban-empty">Sin piezas</div> : columnPieces.map((piece) => <article className="kanban-card" key={piece.id}>
                <div className="kanban-card-title">{piece.title}</div>
                <div className="kanban-card-client">{piece.clientName}</div>
                <div className="kanban-card-metrics"><span>N{piece.difficultyLevel ?? 1}</span><span>{piece.udAmount} UD</span><span>{piece.correctionCount} corr.</span></div>
                {piece.dueDate && <div className="kanban-card-info">Vence {new Date(piece.dueDate).toLocaleDateString('es-CL')}</div>}
                {renderActions(piece)}
              </article>)}</div>
            </section>;
          })}
        </div>
      ) : viewMode === 'gantt' ? (
        <section className="production-gantt"><header><div><span className="page-eyebrow">PLANIFICADOR DE 6 SEMANAS</span><h2>Dependencias, fechas y avance</h2></div><p>Las barras parten en la creación o asignación y terminan en el vencimiento. Las piezas sin fecha usan una ventana operativa de 7 días.</p></header><div className="gantt-scroll"><div className="gantt-calendar"><div className="gantt-axis-label">Pieza / responsable</div><div className="gantt-axis">{Array.from({ length: 7 }, (_, index) => { const date = new Date(ganttStart); date.setDate(date.getDate() + index * 7); return <span key={date.toISOString()} style={{ left: `${index / 6 * 100}%` }}>{date.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' })}</span>; })}</div>{pieces?.map((piece) => { const position = ganttPosition(piece); const blockers = (piece.dependencyIds || []).map((id) => pieces.find((candidate) => candidate.id === id)).filter(Boolean); const blocked = blockers.some((candidate) => candidate?.status !== 'delivered'); return <div className={`gantt-row ${blocked ? 'is-blocked' : ''}`} key={piece.id}><div className="gantt-row-label"><strong>{piece.title}</strong><small>{userMap.get(piece.assignedTo || '') || 'Sin asignar'} · {piece.udAmount} UD</small>{blockers.length > 0 && <em>{blocked ? 'Bloqueada por' : 'Dependía de'}: {blockers.map((dependency) => dependency?.title).join(', ')}</em>}</div><div className="gantt-lane"><i className={`status-${piece.status}`} style={{ left: `${position.left}%`, width: `${position.width}%` }}><span>{piece.dueDate ? new Date(piece.dueDate).toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }) : '+7 días'}</span></i></div></div>; })}</div></div></section>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Titulo</th>
                <th>Cliente</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Nivel</th>
                <th>UD</th>
                <th>Correcciones</th>
                <th>Asignado a</th>
                <th>Vence</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pieces?.map((piece) => (
                <tr key={piece.id}>
                  <td>{piece.title}</td>
                  <td>{piece.clientName}</td>
                  <td>{PIECE_TYPES.find(([value]) => value === piece.type)?.[1] ?? piece.type}</td>
                  <td><StatusBadge status={piece.status} /></td>
                  <td>N{piece.difficultyLevel ?? 1}</td>
                  <td>{piece.udAmount}</td>
                  <td>{piece.correctionCount}</td>
                  <td>{piece.assignedTo ? userMap.get(piece.assignedTo) ?? piece.assignedTo : 'Sin asignar'}</td>
                  <td>{piece.dueDate ? new Date(piece.dueDate).toLocaleDateString() : 'Sin fecha'}</td>
                  <td>
                    {renderActions(piece)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={assignModal.open} onClose={() => { setAssignModal({ open: false, pieceId: '' }); setAssigneeId(''); }} title="Asignar pieza">
        <form
          className="modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            assignMutation.mutate({ id: assignModal.pieceId, designerId: assigneeId });
          }}
        >
          <label>
            Asignar a
            <select className="input" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} required>
              <option value="">Selecciona un responsable</option>
              {assignableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({ROLE_LABELS[user.role] ?? user.role})
                </option>
              ))}
            </select>
          </label>

          <button className="btn btn-primary btn-block" type="submit" disabled={assignMutation.isPending || !assigneeId}>
            {assignMutation.isPending ? 'Asignando...' : 'Confirmar asignacion'}
          </button>
        </form>
      </Modal>

      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Nueva pieza">
        <form
          className="modal-form"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate({
              clientId: form.clientId,
              title: form.title.trim(),
              type: form.type,
              difficultyLevel: Number(form.difficultyLevel),
              ...(form.type === 'carousel' ? { carouselSlides: Number(form.carouselSlides) } : {}),
              ...(form.deadlineAt ? { deadlineAt: new Date(form.deadlineAt).toISOString() } : {}),
              ...(form.description.trim() ? { description: form.description.trim() } : {}),
              ...(form.dependencyIds.length ? { dependencyIds: form.dependencyIds } : {}),
            });
          }}
        >
          <label>
            Cliente
            <select className="input" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required>
              <option value="">Selecciona un cliente</option>
              {(clients ?? []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Titulo
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </label>
          <label>
            Tipo
            <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {PIECE_TYPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {form.type === 'carousel' && (
            <label>
              Cantidad de láminas
              <input
                className="input"
                type="number"
                min="2"
                max="20"
                value={form.carouselSlides}
                onChange={(e) => setForm({ ...form, carouselSlides: e.target.value })}
                required
              />
            </label>
          )}
          <label>
            Nivel
            <select className="input" value={form.difficultyLevel} onChange={(e) => setForm({ ...form, difficultyLevel: e.target.value })}>
              <option value="1">N1</option>
              <option value="2">N2</option>
              <option value="3">N3</option>
              <option value="4">N4</option>
              <option value="5">N5</option>
            </select>
          </label>
          <label>
            Fecha límite
            <input className="input" type="datetime-local" value={form.deadlineAt} onChange={(e) => setForm({ ...form, deadlineAt: e.target.value })} />
          </label>
          <label>
            Dependencias previas
            <select className="input production-dependency-select" multiple value={form.dependencyIds} onChange={(event) => setForm({ ...form, dependencyIds: Array.from(event.currentTarget.selectedOptions, (option) => option.value) })}>
              {(pieces ?? []).filter((piece) => piece.status !== 'delivered').map((piece) => <option value={piece.id} key={piece.id}>{piece.title} · {piece.clientName}</option>)}
            </select>
            <small>Usa Ctrl o Cmd para seleccionar varias. El Gantt mostrará los bloqueos pendientes.</small>
          </label>
          <label>
            Indicaciones
            <textarea className="input" rows={3} maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Objetivo, formato y observaciones para producción" />
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creando...' : 'Crear pieza'}
          </button>
        </form>
      </Modal>

      <Modal open={versionModal.open} onClose={() => setVersionModal({ open: false, pieceId: '' })} title="Enviar versión a revisión">
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); versionMutation.mutate({ pieceId: versionModal.pieceId, fileName: versionForm.fileName.trim(), driveFileId: versionForm.driveFileId.trim() || undefined }); }}>
          <p className="page-subtitle">La nomenclatura se valida automáticamente antes de la revisión.</p>
          <label>
            Nombre exacto del archivo
            <input className="input" required maxLength={255} value={versionForm.fileName} onChange={(event) => setVersionForm({ ...versionForm, fileName: event.target.value })} placeholder="CLIE_POST-CAMPANA_FEED-1080x1080_v1_REVISION" />
          </label>
          <label>
            ID del archivo en Google Drive
            <input className="input" maxLength={255} value={versionForm.driveFileId} onChange={(event) => setVersionForm({ ...versionForm, driveFileId: event.target.value })} placeholder="ID ubicado entre /d/ y /view" />
          </label>
          <button className="btn btn-primary btn-block" type="submit" disabled={versionMutation.isPending || !versionForm.fileName.trim()}>
            {versionMutation.isPending ? 'Validando y enviando...' : 'Registrar versión'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
