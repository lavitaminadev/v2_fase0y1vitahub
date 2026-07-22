import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { DataTable } from '../../shared/DataTable';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { StatusBadge } from '../../shared/StatusBadge';
import { Modal } from '../../shared/Modal';
import { matchesSearch } from '../../shared/search';
import { ConfirmDialog } from '../../shared/ConfirmDialog';

interface BriefRow {
  [key: string]: unknown;
  id: string;
  clientId: string;
  client?: { name: string };
  title: string;
  description?: string;
  requirements?: { notes?: string };
  status: string;
  dueDate?: string;
  createdAt: string;
}

interface ClientOption { id: string; name: string }
const EMPTY_FORM = { clientId: '', title: '', description: '', requirements: '', status: 'draft', dueDate: '' };

export function BriefsPage() {
  const user = useAuth((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const clientScope = searchParams.get('clientId') || '';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BriefRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const qc = useQueryClient();
  const briefsQuery = useQuery<{ data: BriefRow[] }>({ queryKey: ['briefs'], queryFn: () => api.get('/briefs') });
  const { data: clients = [] } = useQuery<ClientOption[]>({ queryKey: ['clients'], queryFn: () => api.get('/clients') });
  const close = () => { setOpen(false); setEditingId(null); setForm(EMPTY_FORM); };
  const success = async (text: string) => { await qc.invalidateQueries({ queryKey: ['briefs'] }); close(); setFeedback({ tone: 'success', text }); };
  const createMutation = useMutation({ mutationFn: (body: Record<string, unknown>) => api.post('/briefs', body), onSuccess: () => success('Brief creado correctamente.'), onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }) });
  const updateMutation = useMutation({ mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.put(`/briefs/${id}`, body), onSuccess: () => success('Brief actualizado correctamente.'), onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }) });
  const deleteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/briefs/${id}`), onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['briefs'] }); setDeleteTarget(null); setFeedback({ tone: 'success', text: 'Brief eliminado correctamente.' }); }, onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }) });

  const allRows = briefsQuery.data?.data ?? [];
  const scopedRows = allRows.filter((row) => !clientScope || row.clientId === clientScope);
  const rows = scopedRows.filter((row) => (!status || row.status === status) && matchesSearch(search, [row.title, row.client?.name, row.description]));
  const contextClient = clients.find((client) => client.id === clientScope);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const overdue = scopedRows.filter((row) => row.dueDate && new Date(row.dueDate).getTime() < now.getTime() && !['approved', 'archived'].includes(row.status)).length;
  const approved = scopedRows.filter((row) => row.status === 'approved').length;
  const openCreate = () => { setFeedback(null); setEditingId(null); setForm({ ...EMPTY_FORM, clientId: clientScope }); setOpen(true); };
  const openEdit = (row: BriefRow) => { setFeedback(null); setEditingId(row.id); setForm({ clientId: row.clientId, title: row.title, description: row.description || '', requirements: row.requirements?.notes || '', status: row.status, dueDate: row.dueDate?.slice(0, 10) || '' }); setOpen(true); };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const body = { ...form, title: form.title.trim(), description: form.description.trim() || undefined, requirements: form.requirements.trim() ? { notes: form.requirements.trim() } : undefined, dueDate: form.dueDate || undefined };
    if (editingId) { const { clientId: _clientId, ...updateBody } = body; updateMutation.mutate({ id: editingId, body: updateBody }); }
    else createMutation.mutate(body);
  };

  if (briefsQuery.isLoading) return <LoadingSpinner text="Cargando briefs..." />;
  if (briefsQuery.error) return <div className="alert alert-error">Error al cargar briefs: {briefsQuery.error.message}</div>;
  return <div className="page">
    <section className="governance-header brief-header"><div><span className="page-eyebrow">CONTROL DE REQUERIMIENTOS</span><h1>Briefs</h1><p>Convierte una solicitud en un acuerdo claro antes de que entre a producción.</p>{contextClient && <span className="context-chip">Vista filtrada: {contextClient.name}<button type="button" aria-label="Quitar filtro de cliente" onClick={() => { searchParams.delete('clientId'); setSearchParams(searchParams); }}>×</button></span>}</div><button className="btn btn-primary" onClick={openCreate}>+ Nuevo brief</button></section>
    <div className="governance-stats"><article><span>Total en alcance</span><strong>{scopedRows.length}</strong><small>{clientScope ? 'para este cliente' : 'en toda la organización'}</small></article><article><span>Aprobados</span><strong>{approved}</strong><small>{scopedRows.length ? `${Math.round(approved * 100 / scopedRows.length)}% del total` : 'sin registros todavía'}</small></article><article className={overdue ? 'attention' : ''}><span>Requieren atención</span><strong>{overdue}</strong><small>briefs vencidos sin aprobar</small></article></div>
    <div className="filters"><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por título o cliente..." /><select className="input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos los estados</option><option value="draft">Borrador</option><option value="sent">Enviado</option><option value="received">Recibido</option><option value="approved">Aprobado</option><option value="archived">Archivado</option></select></div>
    {feedback && <div className={`alert alert-${feedback.tone}`} role="alert">{feedback.text}</div>}
    <DataTable<BriefRow> keyExtractor={(row) => row.id} emptyMessage="No se encontraron briefs" data={rows} columns={[
      { key: 'title', label: 'Título', sortable: true },
      { key: 'clientId', label: 'Cliente', render: (row) => row.client?.name || 'Sin cliente' },
      { key: 'status', label: 'Estado', render: (row) => <StatusBadge status={row.status} /> },
      { key: 'dueDate', label: 'Vencimiento', render: (row) => row.dueDate ? <span className={new Date(row.dueDate).getTime() < now.getTime() && !['approved', 'archived'].includes(row.status) ? 'date-overdue' : ''}>{new Date(row.dueDate).toLocaleDateString('es-CL')}</span> : 'Sin fecha' },
      { key: 'id', label: 'Acciones', render: (row) => <div className="table-actions"><button className="btn btn-outline btn-sm" onClick={() => openEdit(row)}>Editar</button>{user?.role === 'admin' && <button className="btn btn-sm btn-ghost-danger" onClick={() => setDeleteTarget(row)}>Eliminar</button>}</div> },
    ]} />
    <Modal open={open} onClose={close} title={editingId ? 'Editar brief' : 'Nuevo brief'}><form className="modal-form" onSubmit={submit}>
      <label>Cliente<select className="input" required disabled={Boolean(editingId)} value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })}><option value="">Selecciona un cliente</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label>
      <label>Título<input className="input" required maxLength={255} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
      <label>Descripción<textarea className="input" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      <label>Requerimientos levantados<textarea className="input" rows={5} value={form.requirements} onChange={(event) => setForm({ ...form, requirements: event.target.value })} placeholder="Objetivo, audiencia, entregables, referencias y restricciones" /></label>
      <div className="form-row"><label>Estado<select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">Borrador</option><option value="sent">Enviado</option><option value="received">Recibido</option><option value="approved">Aprobado</option><option value="archived">Archivado</option></select></label><label>Vencimiento<input className="input" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label></div>
      {feedback?.tone === 'error' && <div className="alert alert-error">{feedback.text}</div>}
      <button className="btn btn-primary btn-block" disabled={createMutation.isPending || updateMutation.isPending}>{createMutation.isPending || updateMutation.isPending ? 'Guardando...' : 'Guardar brief'}</button>
    </form></Modal>
    <ConfirmDialog open={Boolean(deleteTarget)} title="Eliminar brief" description={`Se eliminará “${deleteTarget?.title ?? ''}”. Esta acción no afecta piezas ya creadas, pero el brief dejará de estar disponible como respaldo.`} confirmLabel="Eliminar brief" pending={deleteMutation.isPending} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} />
  </div>;
}
