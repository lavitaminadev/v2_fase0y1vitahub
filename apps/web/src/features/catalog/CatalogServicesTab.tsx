import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { DataTable } from '../../shared/DataTable';
import { StatusBadge } from '../../shared/StatusBadge';
import { Modal } from '../../shared/Modal';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { useAuth } from '../../core/auth';
import { statusLabel } from '../../shared/status-labels';

interface Service {
  [key: string]: unknown;
  id: string;
  name: string;
  category: string;
  description?: string;
  unitPrice?: number;
  currency: string;
  udPerUnit: number;
  status: string;
}

interface ServiceForm {
  name: string;
  category: string;
  description: string;
  unitPrice: string;
  currency: string;
  udPerUnit: string;
}

const EMPTY_FORM: ServiceForm = { name: '', category: '', description: '', unitPrice: '', currency: 'CLP', udPerUnit: '0' };

export function CatalogServicesTab() {
  const queryClient = useQueryClient();
  const user = useAuth((state) => state.user);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Service | null>(null);
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['catalog-services'], queryFn: () => api.get('/catalog/services') });
  const services: Service[] = Array.isArray(data) ? data : [];

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/catalog/services', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-services'] });
      setModalOpen(false);
      setForm(EMPTY_FORM);
      setFeedback({ tone: 'success', text: 'Servicio creado y disponible para nuevos packs.' });
    },
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.put(`/catalog/services/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['catalog-services'] });
      setModalOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setFeedback({ tone: 'success', text: 'Servicio actualizado correctamente.' });
    },
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/catalog/services/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['catalog-services'] });
      setArchiveTarget(null);
      setFeedback({ tone: 'success', text: 'Servicio archivado. Los registros históricos se mantienen.' });
    },
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = {
      name: form.name,
      category: form.category,
      description: form.description || undefined,
      unitPrice: form.unitPrice ? Number(form.unitPrice) : undefined,
      currency: form.currency,
      udPerUnit: Number(form.udPerUnit),
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, body });
    } else {
      createMutation.mutate(body);
    }
  };

  const openEdit = (svc: Service) => {
    setEditingId(svc.id);
    setForm({
      name: svc.name,
      category: svc.category,
      description: svc.description || '',
      unitPrice: svc.unitPrice?.toString() || '',
      currency: svc.currency,
      udPerUnit: svc.udPerUnit.toString(),
    });
    setModalOpen(true);
  };

  const openCreate = () => {
    setFeedback(null);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  return (
    <div className="catalog-panel">
      <div className="section-header catalog-section-header">
        <div><h2>Servicios base</h2><p>Cada servicio define precio de referencia y esfuerzo operativo en UD.</p></div>
        <button className="btn btn-primary" onClick={openCreate}>+ Nuevo servicio</button>
      </div>
      {feedback && <div className={`alert alert-${feedback.tone}`} role="status">{feedback.text}</div>}
      {error ? <div className="inline-error"><span>!</span><div><strong>No se pudo cargar el catálogo</strong><small>{error.message}</small></div><button className="btn btn-outline btn-sm" onClick={() => refetch()}>Reintentar</button></div> :
      <DataTable
        keyExtractor={(r) => r.id as string}
        columns={[
          { key: 'name', label: 'Servicio', sortable: true },
          { key: 'category', label: 'Categoría', render: (r) => statusLabel(r.category) },
          { key: 'unitPrice', label: 'Precio unitario', render: (r) => r.unitPrice != null ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: r.currency || 'CLP', maximumFractionDigits: 0 }).format(Number(r.unitPrice)) : 'Por definir' },
          { key: 'udPerUnit', label: 'UD por unidad', render: (r) => `${Number(r.udPerUnit)} UD` },
          { key: 'status', label: 'Estado', render: (r) => <StatusBadge status={r.status as string} /> },
          {
            key: 'actions', label: 'Acciones',
            render: (r) => <div className="table-actions"><button className="btn btn-sm btn-outline" onClick={() => openEdit(r)}>Editar</button>{user?.role === 'admin' && <button className="btn btn-sm btn-ghost-danger" onClick={() => setArchiveTarget(r)}>Archivar</button>}</div>,
          },
        ]}
        data={services}
        loading={isLoading}
        emptyMessage="Aún no hay servicios. Crea el primero para estructurar tu oferta."
      />
      }

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setEditingId(null); setForm(EMPTY_FORM); }}
        title={editingId ? 'Editar Servicio' : 'Nuevo Servicio'}>
        <form onSubmit={handleSubmit} className="modal-form">
          <label>Nombre <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Categoría
            <select className="input" required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">Selecciona una categoría</option>
              <option value="monthly">Monthly</option>
              <option value="ads">Ads</option>
              <option value="project">Project</option>
              <option value="one_time">One time</option>
            </select>
          </label>
          <label>Descripción <textarea className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <div className="form-row"><label>Precio unitario <input className="input" type="number" min="0" step="1" value={form.unitPrice} onChange={(e) => setForm({ ...form, unitPrice: e.target.value })} /></label>
          <label>Moneda <input className="input" maxLength={3} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></label>
          </div><label>UD por unidad <input className="input" type="number" min="0" step="0.1" required value={form.udPerUnit} onChange={(e) => setForm({ ...form, udPerUnit: e.target.value })} /><small className="field-help">Esfuerzo que se descontará del presupuesto operativo.</small></label>
          {(createMutation.error || updateMutation.error) && <div className="alert alert-error">{(createMutation.error || updateMutation.error)?.message}</div>}
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary" disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? (editingId ? 'Guardando...' : 'Creando...') : (editingId ? 'Guardar' : 'Crear')}
            </button>
            <button type="button" className="btn btn-outline" onClick={() => { setModalOpen(false); setEditingId(null); setForm(EMPTY_FORM); }}>Cancelar</button>
          </div>
        </form>
      </Modal>
      <ConfirmDialog open={Boolean(archiveTarget)} title="Archivar servicio" description={`“${archiveTarget?.name ?? ''}” dejará de aparecer en nuevas configuraciones. El historial existente no se eliminará.`} confirmLabel="Archivar servicio" pending={archiveMutation.isPending} onClose={() => setArchiveTarget(null)} onConfirm={() => archiveTarget && archiveMutation.mutate(archiveTarget.id)} />
    </div>
  );
}
