import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { DataTable } from '../../shared/DataTable';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { StatusBadge } from '../../shared/StatusBadge';
import { Modal } from '../../shared/Modal';
import { useSearchParams } from 'react-router-dom';
import { QueryErrorState } from '../../shared/QueryErrorState';

interface OnboardingItem {
  [key: string]: unknown;
  id: string;
  clientId: string;
  step: string;
  assignedTo?: string;
  status: string;
  notes?: string;
  blockedReason?: string;
  requiredDocuments?: string[];
  receivedDocuments?: string[];
  createdAt: string;
}

interface ClientOption {
  id: string;
  name: string;
}

interface UserOption {
  id: string;
  name: string;
}

interface OnboardingFormState {
  clientId: string;
  step: string;
  assignedTo: string;
  status: string;
  notes: string;
  blockedReason: string;
  requiredDocuments: string;
  receivedDocuments: string;
}

const EMPTY_FORM: OnboardingFormState = {
  clientId: '',
  step: '',
  assignedTo: '',
  status: 'pending',
  notes: '',
  blockedReason: '',
  requiredDocuments: '',
  receivedDocuments: '',
};

export function OnboardingPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OnboardingItem | null>(null);
  const [clientFilter, setClientFilter] = useState(searchParams.get('clientId') ?? '');
  const [templateClientId, setTemplateClientId] = useState(searchParams.get('clientId') ?? '');
  const [form, setForm] = useState<OnboardingFormState>(EMPTY_FORM);
  const [view, setView] = useState<'journey' | 'table'>('journey');

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['onboarding'],
    queryFn: () => api.get<{ data: OnboardingItem[] }>('/onboarding'),
  });

  const { data: clients } = useQuery<ClientOption[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
  });

  const { data: users } = useQuery<UserOption[]>({
    queryKey: ['users'],
    queryFn: () => api.get('/users'),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/onboarding', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.put(`/onboarding/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      closeModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/onboarding/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['onboarding'] }); setDeleteTarget(null); },
  });

  const createTemplateMutation = useMutation({
    mutationFn: (clientId: string) => api.post('/onboarding/templates/standard', { clientId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding'] }),
  });

  const items = (data?.data ?? []).filter((item) => !clientFilter || item.clientId === clientFilter);
  const clientMap = useMemo(() => new Map((clients ?? []).map((client) => [client.id, client.name])), [clients]);
  const userMap = useMemo(() => new Map((users ?? []).map((user) => [user.id, user.name])), [users]);
  const journeys = useMemo(() => {
    const grouped = new Map<string, OnboardingItem[]>();
    for (const item of items) grouped.set(item.clientId, [...(grouped.get(item.clientId) || []), item]);
    return [...grouped.entries()].map(([clientId, steps]) => ({ clientId, steps: steps.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), completed: steps.filter((step) => step.status === 'completed').length, blocked: steps.filter((step) => step.status === 'blocked').length }));
  }, [items]);

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM, clientId: clientFilter });
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, clientId: clientFilter });
    setModalOpen(true);
  };

  const openEdit = (item: OnboardingItem) => {
    setEditingId(item.id);
    setForm({
      clientId: item.clientId,
      step: item.step,
      assignedTo: item.assignedTo ?? '',
      status: item.status,
      notes: item.notes ?? '',
      blockedReason: item.blockedReason ?? '',
      requiredDocuments: (item.requiredDocuments ?? []).join(', '),
      receivedDocuments: (item.receivedDocuments ?? []).join(', '),
    });
    setModalOpen(true);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = {
      clientId: form.clientId,
      step: form.step.trim(),
      assignedTo: form.assignedTo || undefined,
      status: form.status,
      notes: form.notes.trim() || undefined,
      blockedReason: form.blockedReason.trim() || undefined,
      requiredDocuments: form.requiredDocuments.split(',').map((value) => value.trim()).filter(Boolean),
      receivedDocuments: form.receivedDocuments.split(',').map((value) => value.trim()).filter(Boolean),
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, body });
      return;
    }

    createMutation.mutate(body);
  };

  if (isLoading) return <LoadingSpinner text="Cargando onboarding..." />;
  if (error) return <QueryErrorState title="No pudimos cargar el onboarding" message={error.message} onRetry={() => void refetch()} retrying={isFetching} />;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Onboarding</h1>
          <p className="page-subtitle">Checklist operativo alineado al Documento Maestro: brief, estrategia, traspaso y activacion.</p>
        </div>
        <div className="portal-item-actions">
          <select className="input" value={templateClientId} onChange={(e) => setTemplateClientId(e.target.value)}>
            <option value="">Cliente para checklist estandar</option>
            {(clients ?? []).map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          <button
            className="btn btn-outline"
            onClick={() => createTemplateMutation.mutate(templateClientId)}
            disabled={!templateClientId || createTemplateMutation.isPending}
          >
            {createTemplateMutation.isPending ? 'Creando checklist...' : 'Crear checklist estandar'}
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            Nuevo paso
          </button>
        </div>
      </div>
      <div className="filters onboarding-filters"><select className="input" aria-label="Filtrar onboarding por cliente" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}><option value="">Todos los clientes</option>{(clients ?? []).map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select><div className="view-toggle"><button className={view === 'journey' ? 'active' : ''} onClick={() => setView('journey')}>Stepper</button><button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>Tabla</button></div><span className="filter-result-count">{items.length} pasos</span></div>
      {view === 'journey' ? <div className="onboarding-journeys">{journeys.map((journey) => { const progress = journey.steps.length ? Math.round(journey.completed / journey.steps.length * 100) : 0; return <section key={journey.clientId}><header><div><span className="page-eyebrow">CLIENTE</span><h2>{clientMap.get(journey.clientId) || 'Cliente no disponible'}</h2></div><div className="onboarding-progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}><strong>{progress}%</strong></div></header><div className="onboarding-progress-track"><i style={{ width: `${progress}%` }} /></div>{journey.blocked > 0 && <div className="onboarding-block-alert"><strong>{journey.blocked} bloqueo(s) activo(s)</strong><span>Requieren resolución para continuar el flujo.</span></div>}<div className="onboarding-stepper">{journey.steps.map((step, index) => { const missing = (step.requiredDocuments || []).filter((document) => !(step.receivedDocuments || []).includes(document)); return <article className={`is-${step.status}`} key={step.id}><div className="onboarding-step-marker"><span>{step.status === 'completed' ? '✓' : index + 1}</span><i /></div><div className="onboarding-step-card"><header><div><h3>{step.step}</h3><small>{step.assignedTo ? userMap.get(step.assignedTo) || 'Responsable no disponible' : 'Sin responsable'}</small></div><StatusBadge status={step.status} /></header>{step.notes && <p>{step.notes}</p>}{step.blockedReason && <div className="onboarding-reason"><strong>Bloqueo</strong><span>{step.blockedReason}</span></div>}{(step.requiredDocuments?.length || 0) > 0 && <div className="onboarding-documents"><span>Documentos</span><strong>{(step.receivedDocuments || []).length}/{step.requiredDocuments?.length} recibidos</strong>{missing.length > 0 && <small>Faltan: {missing.join(', ')}</small>}</div>}<footer><button className="btn btn-outline btn-sm" onClick={() => openEdit(step)}>Editar detalle</button>{step.status !== 'completed' && <button className="btn btn-primary btn-sm" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({ id: step.id, body: { status: step.status === 'pending' ? 'in_progress' : 'completed' } })}>{step.status === 'pending' ? 'Iniciar' : 'Completar'}</button>}</footer></div></article>; })}</div></section>; })}{journeys.length === 0 && <div className="table-empty">Crea el checklist estándar para visualizar el recorrido del cliente.</div>}</div> : <DataTable<OnboardingItem>
        storageKey="onboarding"
        exportFileName="onboarding"
        keyExtractor={(row) => row.id}
        columns={[
          { key: 'step', label: 'Paso', sortable: true },
          { key: 'clientId', label: 'Cliente', render: (row) => clientMap.get(row.clientId) ?? row.clientId },
          { key: 'assignedTo', label: 'Responsable', render: (row) => row.assignedTo ? userMap.get(row.assignedTo) ?? row.assignedTo : '-' },
          { key: 'status', label: 'Estado', render: (row) => <StatusBadge status={row.status} /> },
          { key: 'createdAt', label: 'Creado', render: (row) => new Date(row.createdAt).toLocaleDateString() },
          {
            key: 'id',
            label: 'Acciones',
            render: (row) => (
              <div className="actions-cell">
                <button className="btn btn-sm btn-outline" onClick={() => openEdit(row)}>
                  Editar
                </button>
                <button
                  className="btn btn-sm btn-outline btn-danger"
                  onClick={() => setDeleteTarget(row)}
                  disabled={deleteMutation.isPending}
                >
                  Eliminar
                </button>
              </div>
            ),
          },
        ]}
        data={items}
      />}

      <Modal open={modalOpen} onClose={closeModal} title={editingId ? 'Editar paso' : 'Nuevo paso de onboarding'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Cliente</label>
            <select className="input" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required>
              <option value="">Selecciona un cliente</option>
              {(clients ?? []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Paso</label>
            <input className="input" value={form.step} onChange={(e) => setForm({ ...form, step: e.target.value })} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Responsable</label>
              <select className="input" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
                <option value="">Sin asignar</option>
                {(users ?? []).map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Estado</label>
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="pending">Pendiente</option>
                <option value="in_progress">En progreso</option>
                <option value="blocked">Bloqueado</option>
                <option value="completed">Completado</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Notas</label>
            <textarea className="input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
          </div>
          {form.status === 'blocked' && <div className="form-group"><label>Motivo del bloqueo<textarea className="input" required value={form.blockedReason} onChange={(event) => setForm({ ...form, blockedReason: event.target.value })} rows={3} placeholder="Qué impide avanzar y quién debe resolverlo" /></label></div>}
          <div className="form-row"><div className="form-group"><label>Documentos requeridos<input className="input" value={form.requiredDocuments} onChange={(event) => setForm({ ...form, requiredDocuments: event.target.value })} placeholder="Contrato, accesos, manual de marca" /></label></div><div className="form-group"><label>Documentos recibidos<input className="input" value={form.receivedDocuments} onChange={(event) => setForm({ ...form, receivedDocuments: event.target.value })} placeholder="Contrato, manual de marca" /></label></div></div>
          <p className="page-subtitle">Separa los documentos con comas. La vista calculará automáticamente lo que falta.</p>
          <button className="btn btn-primary btn-block" type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
            {createMutation.isPending || updateMutation.isPending ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Crear paso'}
          </button>
        </form>
      </Modal>
      <Modal open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} title="Eliminar paso de onboarding">
        <div className="modal-form"><p>Se eliminará el paso “{deleteTarget?.step}” y dejará de aparecer en el seguimiento del cliente.</p>{deleteMutation.error && <div className="alert alert-error">{deleteMutation.error.message}</div>}<div className="modal-actions"><button className="btn btn-outline" type="button" onClick={() => setDeleteTarget(null)}>Cancelar</button><button className="btn btn-danger" type="button" disabled={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>{deleteMutation.isPending ? 'Eliminando...' : 'Confirmar eliminación'}</button></div></div>
      </Modal>
    </div>
  );
}
