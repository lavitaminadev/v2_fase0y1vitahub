import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { DataTable } from '../../shared/DataTable';
import { StatusBadge } from '../../shared/StatusBadge';
import { Modal } from '../../shared/Modal';
import { ConfirmDialog } from '../../shared/ConfirmDialog';

interface Pack {
  [key: string]: unknown;
  id: string;
  name: string;
  description?: string;
  monthlyUd: number;
  reelsIncluded: number;
  monthlyPrice?: number;
  currency: string;
  services?: string;
  status: string;
  createdAt: string;
}

interface PackForm {
  name: string;
  description: string;
  monthlyUd: string;
  reelsIncluded: string;
  monthlyPrice: string;
  currency: string;
  services: string;
}

const EMPTY_FORM: PackForm = { name: '', description: '', monthlyUd: '0', reelsIncluded: '0', monthlyPrice: '', currency: 'CLP', services: '' };

function serviceList(value?: string): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map((item) => typeof item === 'string' ? item : JSON.stringify(item));
  } catch {
    return value.split('\n').map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function formatMoney(value: number | undefined, currency: string) {
  if (value == null) return 'Por definir';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: currency || 'CLP', maximumFractionDigits: 0 }).format(Number(value));
}

export function CatalogPacksTab() {
  const queryClient = useQueryClient();
  const user = useAuth((state) => state.user);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Pack | null>(null);
  const [form, setForm] = useState<PackForm>(EMPTY_FORM);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const packsQuery = useQuery<Pack[]>({ queryKey: ['catalog-packs'], queryFn: () => api.get('/catalog/packs') });
  const packs = Array.isArray(packsQuery.data) ? packsQuery.data : [];

  const closeEditor = () => { setModalOpen(false); setEditingId(null); setForm(EMPTY_FORM); };
  const saveSuccess = async (text: string) => {
    await queryClient.invalidateQueries({ queryKey: ['catalog-packs'] });
    closeEditor();
    setFeedback({ tone: 'success', text });
  };
  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/catalog/packs', body),
    onSuccess: () => saveSuccess('Pack creado y listo para asociar a una propuesta.'),
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.put(`/catalog/packs/${id}`, body),
    onSuccess: () => saveSuccess('Pack actualizado correctamente.'),
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/catalog/packs/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalog-packs'] });
      setDeleteTarget(null);
      setFeedback({ tone: 'success', text: 'Pack eliminado del catálogo.' });
    },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });

  const openCreate = () => { setFeedback(null); setEditingId(null); setForm(EMPTY_FORM); setModalOpen(true); };
  const openEdit = (pack: Pack) => {
    setFeedback(null);
    setEditingId(pack.id);
    setForm({
      name: pack.name,
      description: pack.description || '',
      monthlyUd: String(pack.monthlyUd ?? 0),
      reelsIncluded: String(pack.reelsIncluded ?? 0),
      monthlyPrice: pack.monthlyPrice == null ? '' : String(pack.monthlyPrice),
      currency: pack.currency || 'CLP',
      services: serviceList(pack.services).join('\n'),
    });
    setModalOpen(true);
  };
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const included = form.services.split('\n').map((item) => item.trim()).filter(Boolean);
    const body = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      monthlyUd: Number(form.monthlyUd),
      reelsIncluded: Number(form.reelsIncluded),
      monthlyPrice: form.monthlyPrice ? Number(form.monthlyPrice) : undefined,
      currency: form.currency,
      services: included.length ? JSON.stringify(included) : undefined,
    };
    if (editingId) updateMutation.mutate({ id: editingId, body });
    else createMutation.mutate(body);
  };

  return (
    <div className="catalog-panel">
      <div className="section-header catalog-section-header">
        <div><h2>Packs comerciales</h2><p>Agrupa servicios, capacidad mensual y precio en una oferta clara.</p></div>
        <button className="btn btn-primary" onClick={openCreate}>+ Nuevo pack</button>
      </div>
      {feedback && <div className={`alert alert-${feedback.tone}`} role="status">{feedback.text}</div>}
      {packsQuery.error ? (
        <div className="inline-error"><span>!</span><div><strong>No se pudieron cargar los packs</strong><small>{packsQuery.error.message}</small></div><button className="btn btn-outline btn-sm" onClick={() => packsQuery.refetch()}>Reintentar</button></div>
      ) : (
        <DataTable<Pack>
          keyExtractor={(row) => row.id}
          loading={packsQuery.isLoading}
          emptyMessage="Aún no hay packs. Combina servicios para crear una oferta comercial."
          columns={[
            { key: 'name', label: 'Pack', sortable: true, render: (row) => <span className="primary-cell"><strong>{row.name}</strong><small>{serviceList(row.services).slice(0, 2).join(' · ') || row.description || 'Sin detalle de servicios'}</small></span> },
            { key: 'monthlyUd', label: 'Capacidad', render: (row) => `${Number(row.monthlyUd)} UD/mes` },
            { key: 'reelsIncluded', label: 'Reels', render: (row) => `${Number(row.reelsIncluded || 0)} incluidos` },
            { key: 'monthlyPrice', label: 'Precio mensual', render: (row) => formatMoney(row.monthlyPrice, row.currency) },
            { key: 'status', label: 'Estado', render: (row) => <StatusBadge status={row.status} /> },
            { key: 'actions', label: 'Acciones', render: (row) => <div className="table-actions"><button className="btn btn-sm btn-outline" onClick={() => openEdit(row)}>Editar</button>{user?.role === 'admin' && <button className="btn btn-sm btn-ghost-danger" onClick={() => setDeleteTarget(row)}>Eliminar</button>}</div> },
          ]}
          data={packs}
        />
      )}

      <Modal open={modalOpen} onClose={closeEditor} title={editingId ? 'Editar pack' : 'Nuevo pack'}>
        <form onSubmit={handleSubmit} className="modal-form">
          <label>Nombre<input className="input" required maxLength={255} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ej. Presencia Activa" /></label>
          <label>Descripción<textarea className="input" rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Resultado comercial que obtiene el cliente" /></label>
          <div className="form-row"><label>UD mensuales<input className="input" type="number" min="0" step="0.1" required value={form.monthlyUd} onChange={(event) => setForm({ ...form, monthlyUd: event.target.value })} /></label><label>Reels incluidos<input className="input" type="number" min="0" step="1" required value={form.reelsIncluded} onChange={(event) => setForm({ ...form, reelsIncluded: event.target.value })} /></label></div>
          <div className="form-row"><label>Precio mensual<input className="input" type="number" min="0" step="1" value={form.monthlyPrice} onChange={(event) => setForm({ ...form, monthlyPrice: event.target.value })} /></label><label>Moneda<input className="input" pattern="[A-Z]{3}" maxLength={3} value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value.toUpperCase() })} /></label></div>
          <label>Servicios incluidos<textarea className="input" rows={5} value={form.services} onChange={(event) => setForm({ ...form, services: event.target.value })} placeholder={'Escribe un servicio por línea\nGestión de contenidos\nMeta Ads\nReporte mensual'} /><small className="field-help">Un servicio por línea. VITAHUB lo guarda en formato estructurado automáticamente.</small></label>
          {(createMutation.error || updateMutation.error) && <div className="alert alert-error">{(createMutation.error || updateMutation.error)?.message}</div>}
          <div className="modal-actions"><button type="button" className="btn btn-outline" onClick={closeEditor}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>{createMutation.isPending || updateMutation.isPending ? 'Guardando...' : 'Guardar pack'}</button></div>
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(deleteTarget)} title="Eliminar pack" description={`“${deleteTarget?.name ?? ''}” se eliminará del catálogo. Los contratos existentes no se modificarán.`} confirmLabel="Eliminar pack" pending={deleteMutation.isPending} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} />
    </div>
  );
}
