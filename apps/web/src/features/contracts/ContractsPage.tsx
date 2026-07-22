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

interface ContractRow {
  [key: string]: unknown;
  id: string;
  clientId: string;
  client?: { name: string };
  name: string;
  serviceType?: string;
  monthlyUd: number;
  startDate: string;
  endDate?: string;
  status: string;
  terms?: string;
  packId?: string;
  monthlyPrice?: number;
  committedAdSpend?: number;
  includedReels?: number;
  billingCycle?: string;
}
interface ClientOption { id: string; name: string }
interface PackOption { id: string; name: string; monthlyUd: number; monthlyPrice?: number; reelsIncluded?: number; services?: string }
const EMPTY_FORM = { clientId: '', packId: '', name: '', serviceType: '', monthlyUd: '20', monthlyPrice: '', committedAdSpend: '', includedReels: '0', billingCycle: 'monthly_advance', startDate: '', endDate: '', status: 'active', terms: '' };
const money = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value || 0);

export function ContractsPage() {
  const user = useAuth((state) => state.user);
  const [searchParams, setSearchParams] = useSearchParams();
  const clientScope = searchParams.get('clientId') || '';
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContractRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const qc = useQueryClient();
  const contractsQuery = useQuery<{ data: ContractRow[] }>({ queryKey: ['contracts'], queryFn: () => api.get('/contracts') });
  const { data: clients = [] } = useQuery<ClientOption[]>({ queryKey: ['clients'], queryFn: () => api.get('/clients') });
  const { data: packs = [] } = useQuery<PackOption[]>({ queryKey: ['catalog-packs'], queryFn: () => api.get('/catalog/packs') });
  const close = () => { setOpen(false); setEditingId(null); setForm(EMPTY_FORM); };
  const success = async (text: string) => { await qc.invalidateQueries({ queryKey: ['contracts'] }); close(); setFeedback({ tone: 'success', text }); };
  const createMutation = useMutation({ mutationFn: (body: Record<string, unknown>) => api.post('/contracts', body), onSuccess: () => success('Contrato creado correctamente.'), onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }) });
  const updateMutation = useMutation({ mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.put(`/contracts/${id}`, body), onSuccess: () => success('Contrato actualizado correctamente.'), onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }) });
  const deleteMutation = useMutation({ mutationFn: (id: string) => api.delete(`/contracts/${id}`), onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['contracts'] }); setDeleteTarget(null); setFeedback({ tone: 'success', text: 'Contrato eliminado correctamente.' }); }, onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }) });
  const allRows = contractsQuery.data?.data ?? [];
  const scopedRows = allRows.filter((row) => !clientScope || row.clientId === clientScope);
  const rows = scopedRows.filter((row) => (!statusFilter || row.status === statusFilter) && matchesSearch(search, [row.name, row.serviceType, row.client?.name]));
  const contextClient = clients.find((client) => client.id === clientScope);
  const active = scopedRows.filter((row) => row.status === 'active').length;
  const monthlyUd = scopedRows.filter((row) => row.status === 'active').reduce((sum, row) => sum + Number(row.monthlyUd || 0), 0);
  const monthlyRevenue = scopedRows.filter((row) => row.status === 'active').reduce((sum, row) => sum + Number(row.monthlyPrice || 0), 0);
  const nextMonth = Date.now() + 30 * 86400000;
  const expiring = scopedRows.filter((row) => row.status === 'active' && row.endDate && new Date(row.endDate).getTime() >= Date.now() && new Date(row.endDate).getTime() <= nextMonth).length;
  const openCreate = () => { setFeedback(null); setEditingId(null); setForm({ ...EMPTY_FORM, clientId: clientScope, startDate: new Date().toISOString().slice(0, 10) }); setOpen(true); };
  const openEdit = (row: ContractRow) => { setFeedback(null); setEditingId(row.id); setForm({ clientId: row.clientId, packId: row.packId || '', name: row.name, serviceType: row.serviceType || '', monthlyUd: String(row.monthlyUd ?? 0), monthlyPrice: row.monthlyPrice == null ? '' : String(row.monthlyPrice), committedAdSpend: row.committedAdSpend == null ? '' : String(row.committedAdSpend), includedReels: String(row.includedReels ?? 0), billingCycle: row.billingCycle || 'monthly_advance', startDate: row.startDate.slice(0, 10), endDate: row.endDate?.slice(0, 10) || '', status: row.status, terms: row.terms || '' }); setOpen(true); };
  const applyPack = (packId: string) => {
    const pack = packs.find((option) => option.id === packId);
    setForm({ ...form, packId, name: form.name || pack?.name || '', serviceType: form.serviceType || pack?.name || '', monthlyUd: pack ? String(pack.monthlyUd ?? 0) : form.monthlyUd, monthlyPrice: pack?.monthlyPrice == null ? form.monthlyPrice : String(pack.monthlyPrice), includedReels: pack ? String(pack.reelsIncluded ?? 0) : form.includedReels });
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const common = { packId: form.packId || undefined, name: form.name.trim(), serviceType: form.serviceType.trim() || undefined, monthlyUd: Number(form.monthlyUd), monthlyPrice: form.monthlyPrice ? Number(form.monthlyPrice) : undefined, committedAdSpend: form.committedAdSpend ? Number(form.committedAdSpend) : undefined, includedReels: Number(form.includedReels || 0), billingCycle: form.billingCycle, endDate: form.endDate || undefined, status: form.status, terms: form.terms.trim() || undefined };
    if (editingId) updateMutation.mutate({ id: editingId, body: common });
    else createMutation.mutate({ ...common, clientId: form.clientId, startDate: form.startDate });
  };
  if (contractsQuery.isLoading) return <LoadingSpinner text="Cargando contratos..." />;
  if (contractsQuery.error) return <div className="alert alert-error">Error al cargar contratos: {contractsQuery.error.message}</div>;
  return <div className="page">
    <section className="governance-header contract-header"><div><span className="page-eyebrow">GOBIERNO COMERCIAL</span><h1>Contratos</h1><p>Controla vigencia, servicio acordado y capacidad mensual comprometida por cliente.</p>{contextClient && <span className="context-chip">Vista filtrada: {contextClient.name}<button type="button" aria-label="Quitar filtro de cliente" onClick={() => { searchParams.delete('clientId'); setSearchParams(searchParams); }}>×</button></span>}</div><button className="btn btn-primary" onClick={openCreate}>+ Nuevo contrato</button></section>
    <div className="governance-stats governance-stats-four"><article><span>Contratos activos</span><strong>{active}</strong><small>de {scopedRows.length} registrados</small></article><article><span>Ingreso comprometido</span><strong>{money(monthlyRevenue)}</strong><small>mensual recurrente</small></article><article><span>Capacidad comprometida</span><strong>{monthlyUd}</strong><small>UD mensuales activas</small></article><article className={expiring ? 'attention' : ''}><span>Próximos a vencer</span><strong>{expiring}</strong><small>durante los siguientes 30 días</small></article></div>
    <div className="filters"><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar contrato, servicio o cliente..." /><select className="input" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Todos los estados</option><option value="active">Activo</option><option value="paused">Pausado</option><option value="ended">Finalizado</option><option value="cancelled">Cancelado</option></select></div>
    {feedback && <div className={`alert alert-${feedback.tone}`} role="alert">{feedback.text}</div>}
    <DataTable<ContractRow> keyExtractor={(row) => row.id} emptyMessage="No se encontraron contratos" data={rows} columns={[
      { key: 'name', label: 'Contrato', sortable: true },
      { key: 'clientId', label: 'Cliente', render: (row) => row.client?.name || 'Sin cliente' },
      { key: 'serviceType', label: 'Servicio', render: (row) => row.serviceType || 'Sin especificar' },
      { key: 'monthlyUd', label: 'UD/mes', sortable: true, render: (row) => String(Number(row.monthlyUd)) },
      { key: 'monthlyPrice', label: 'Mensualidad', render: (row) => row.monthlyPrice == null ? 'Por definir' : money(Number(row.monthlyPrice)) },
      { key: 'endDate', label: 'Vigencia', render: (row) => `${new Date(row.startDate).toLocaleDateString('es-CL')} - ${row.endDate ? new Date(row.endDate).toLocaleDateString('es-CL') : 'Indefinido'}` },
      { key: 'status', label: 'Estado', render: (row) => <StatusBadge status={row.status} /> },
      { key: 'id', label: 'Acciones', render: (row) => <div className="table-actions"><button className="btn btn-outline btn-sm" onClick={() => openEdit(row)}>Editar</button>{user?.role === 'admin' && <button className="btn btn-sm btn-ghost-danger" onClick={() => setDeleteTarget(row)}>Eliminar</button>}</div> },
    ]} />
    <Modal open={open} onClose={close} title={editingId ? 'Editar contrato' : 'Nuevo contrato'}><form className="modal-form" onSubmit={submit}>
      <label>Cliente<select className="input" required disabled={Boolean(editingId)} value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })}><option value="">Selecciona un cliente</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label>
      <label>Pack comercial<select className="input" value={form.packId} onChange={(event) => applyPack(event.target.value)}><option value="">Contrato personalizado</option>{packs.map((pack) => <option key={pack.id} value={pack.id}>{pack.name}</option>)}</select><small className="field-help">Al seleccionar un pack se precargan precio, UD y reels; luego puedes personalizarlos.</small></label>
      <label>Nombre del contrato<input className="input" required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ej. Plan Integral 2026" /></label>
      <label>Servicio principal<input className="input" maxLength={255} value={form.serviceType} onChange={(event) => setForm({ ...form, serviceType: event.target.value })} placeholder="Marketing digital, Meta Ads..." /></label>
      <div className="form-row"><label>Inicio<input className="input" required disabled={Boolean(editingId)} type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></label><label>Término<input className="input" min={form.startDate} type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label></div>
      <div className="form-row"><label>UD mensuales<input className="input" required type="number" min="0" step="0.1" value={form.monthlyUd} onChange={(event) => setForm({ ...form, monthlyUd: event.target.value })} /></label><label>Mensualidad CLP<input className="input" type="number" min="0" step="1" value={form.monthlyPrice} onChange={(event) => setForm({ ...form, monthlyPrice: event.target.value })} /></label></div>
      <div className="form-row"><label>Inversión publicitaria comprometida<input className="input" type="number" min="0" step="1" value={form.committedAdSpend} onChange={(event) => setForm({ ...form, committedAdSpend: event.target.value })} /></label><label>Reels incluidos<input className="input" type="number" min="0" step="1" value={form.includedReels} onChange={(event) => setForm({ ...form, includedReels: event.target.value })} /></label></div>
      <div className="form-row"><label>Ciclo de cobro<select className="input" value={form.billingCycle} onChange={(event) => setForm({ ...form, billingCycle: event.target.value })}><option value="monthly_advance">Mensual anticipado</option><option value="monthly_arrears">Mensual vencido</option><option value="quarterly_advance">Trimestral anticipado</option></select></label><label>Estado<select className="input" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="active">Activo</option><option value="paused">Pausado</option><option value="ended">Finalizado</option><option value="cancelled">Cancelado</option></select></label></div>
      <label>Condiciones<textarea className="input" rows={4} value={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.value })} /></label>
      {feedback?.tone === 'error' && <div className="alert alert-error">{feedback.text}</div>}
      <button className="btn btn-primary btn-block" disabled={createMutation.isPending || updateMutation.isPending}>{createMutation.isPending || updateMutation.isPending ? 'Guardando...' : 'Guardar contrato'}</button>
    </form></Modal>
    <ConfirmDialog open={Boolean(deleteTarget)} title="Eliminar contrato" description={`Se eliminará “${deleteTarget?.name ?? ''}”. Revisa antes si su capacidad UD ya fue utilizada en la operación del cliente.`} confirmLabel="Eliminar contrato" pending={deleteMutation.isPending} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} />
  </div>;
}
