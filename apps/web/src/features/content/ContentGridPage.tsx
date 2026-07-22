import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { StatusBadge } from '../../shared/StatusBadge';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { EmptyState } from '../../shared/EmptyState';
import { Modal } from '../../shared/Modal';
import { useSearchParams } from 'react-router-dom';

interface ContentItem {
  id: string;
  caption: string;
  type: string;
  status: string;
  scheduledAt?: string;
  notes?: string;
}

interface ContentGrid {
  id: string;
  clientId: string;
  title: string;
  status: string;
  weekStart: string;
  weekEnd: string;
  notes?: string;
  client?: { name: string };
  contentItems: ContentItem[];
}

interface ClientOption { id: string; name: string }

const ITEM_TYPES = [
  ['feed', 'Feed'], ['story', 'Historia'], ['reel', 'Reel'], ['carousel', 'Carrusel'],
  ['video', 'Video'], ['copy', 'Copy'], ['ad', 'Anuncio'],
] as const;

const ITEM_STATUSES = [
  ['planned', 'Planificado'], ['in_production', 'En producción'], ['approved', 'Aprobado'],
  ['published', 'Publicado'], ['cancelled', 'Cancelado'],
] as const;

const GRID_STATUSES = [
  ['draft', 'Borrador'], ['submitted', 'Enviado'], ['approved', 'Aprobado'],
  ['rejected', 'Con observaciones'], ['published', 'Publicado'],
] as const;

export function ContentGridPage() {
  const [searchParams] = useSearchParams();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [clientFilter, setClientFilter] = useState(searchParams.get('clientId') ?? '');
  const [createOpen, setCreateOpen] = useState(false);
  const [itemGridId, setItemGridId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [gridForm, setGridForm] = useState({ clientId: '', title: '', weekStart: '', weekEnd: '', notes: '' });
  const [itemForm, setItemForm] = useState({ caption: '', type: 'feed', scheduledAt: '', notes: '' });
  const queryClient = useQueryClient();

  const query = new URLSearchParams({ month: selectedMonth });
  if (clientFilter) query.set('clientId', clientFilter);
  const gridsQuery = useQuery<ContentGrid[]>({
    queryKey: ['content-grids', selectedMonth, clientFilter],
    queryFn: () => api.get(`/content/grids?${query}`),
  });
  const { data: clients = [] } = useQuery<ClientOption[]>({ queryKey: ['clients'], queryFn: () => api.get('/clients') });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['content-grids'] });
  const createGrid = useMutation({
    mutationFn: () => api.post('/content/grids', { ...gridForm, title: gridForm.title.trim(), notes: gridForm.notes.trim() || undefined }),
    onSuccess: async () => {
      await invalidate();
      setCreateOpen(false);
      setGridForm({ clientId: '', title: '', weekStart: '', weekEnd: '', notes: '' });
      setFeedback({ tone: 'success', text: 'Parrilla semanal creada correctamente.' });
    },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });
  const createItem = useMutation({
    mutationFn: () => api.post(`/content/grids/${itemGridId}/items`, { ...itemForm, caption: itemForm.caption.trim(), scheduledAt: itemForm.scheduledAt || undefined, notes: itemForm.notes.trim() || undefined }),
    onSuccess: async () => {
      await invalidate();
      setItemGridId(null);
      setItemForm({ caption: '', type: 'feed', scheduledAt: '', notes: '' });
      setFeedback({ tone: 'success', text: 'Publicación agregada a la parrilla.' });
    },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });
  const updateGrid = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/content/grids/${id}/status`, { status }),
    onSuccess: async () => { await invalidate(); setFeedback({ tone: 'success', text: 'Estado de parrilla actualizado.' }); },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });
  const updateItem = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/content/items/${id}`, { status }),
    onSuccess: async () => { await invalidate(); setFeedback({ tone: 'success', text: 'Estado de publicación actualizado.' }); },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });

  const grids = gridsQuery.data ?? [];
  const metrics = (() => {
    const items = grids.flatMap((grid) => grid.contentItems ?? []);
    return { grids: grids.length, items: items.length, approved: items.filter((item) => item.status === 'approved').length, published: items.filter((item) => item.status === 'published').length };
  })();

  if (gridsQuery.isLoading) return <LoadingSpinner text="Cargando calendario de contenido..." />;
  if (gridsQuery.error) return <div className="alert alert-error">Error al cargar el calendario: {gridsQuery.error.message}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Calendario de contenido</h1><p className="page-subtitle">Planifica semanas, publicaciones y estados por cliente.</p></div>
        <button className="btn btn-primary" onClick={() => { setFeedback(null); setGridForm((current) => ({ ...current, clientId: clientFilter })); setCreateOpen(true); }}>+ Nueva parrilla</button>
      </div>

      <div className="filters content-calendar-filters">
        <label>Mes<input type="month" className="input" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} /></label>
        <label>Cliente<select className="input" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}><option value="">Todos los clientes</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label>
      </div>
      {feedback && <div className={`alert alert-${feedback.tone}`} role="alert">{feedback.text}</div>}

      <div className="content-summary" aria-label="Resumen del calendario">
        <div><span>Parrillas</span><strong>{metrics.grids}</strong></div><div><span>Publicaciones</span><strong>{metrics.items}</strong></div><div><span>Aprobadas</span><strong>{metrics.approved}</strong></div><div><span>Publicadas</span><strong>{metrics.published}</strong></div>
      </div>

      {grids.length === 0 ? <EmptyState icon="[]" title="Sin parrillas para este periodo" description="Crea una parrilla semanal y agrega las publicaciones planificadas." /> : (
        <div className="content-plan-list">
          {grids.map((grid) => (
            <section className="content-plan-card" key={grid.id}>
              <header>
                <div><span className="page-eyebrow">{grid.client?.name || 'Cliente'}</span><h2>{grid.title}</h2><p>{new Date(grid.weekStart).toLocaleDateString('es-CL')} al {new Date(grid.weekEnd).toLocaleDateString('es-CL')}</p></div>
                <div className="content-plan-actions">
                  <select aria-label={`Estado de ${grid.title}`} className="input" value={grid.status} disabled={updateGrid.isPending} onChange={(event) => updateGrid.mutate({ id: grid.id, status: event.target.value })}>{GRID_STATUSES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
                  <button className="btn btn-outline btn-sm" onClick={() => { setFeedback(null); setItemGridId(grid.id); }}>+ Publicación</button>
                </div>
              </header>
              {grid.notes && <p className="content-plan-notes">{grid.notes}</p>}
              {(grid.contentItems?.length ?? 0) === 0 ? <div className="content-plan-empty">Aún no hay publicaciones en esta parrilla.</div> : (
                <div className="content-item-grid">
                  {grid.contentItems.map((item) => <article className="content-item-card" key={item.id}>
                    <div className="content-item-top"><span>{ITEM_TYPES.find(([value]) => value === item.type)?.[1] ?? item.type}</span><StatusBadge status={item.status} /></div>
                    <h3>{item.caption}</h3>
                    <p>{item.scheduledAt ? new Date(item.scheduledAt).toLocaleDateString('es-CL', { dateStyle: 'long' }) : 'Sin fecha de publicación'}</p>
                    {item.notes && <small>{item.notes}</small>}
                    <select aria-label={`Estado de ${item.caption}`} className="input" value={item.status} disabled={updateItem.isPending} onChange={(event) => updateItem.mutate({ id: item.id, status: event.target.value })}>{ITEM_STATUSES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select>
                  </article>)}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nueva parrilla semanal">
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); createGrid.mutate(); }}>
          <label>Cliente<select className="input" required value={gridForm.clientId} onChange={(event) => setGridForm({ ...gridForm, clientId: event.target.value })}><option value="">Selecciona un cliente</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label>
          <label>Nombre<input className="input" required maxLength={255} value={gridForm.title} onChange={(event) => setGridForm({ ...gridForm, title: event.target.value })} placeholder="Ej. Semana 1 · Lanzamiento invierno" /></label>
          <div className="form-row"><label>Desde<input className="input" type="date" required value={gridForm.weekStart} onChange={(event) => setGridForm({ ...gridForm, weekStart: event.target.value })} /></label><label>Hasta<input className="input" type="date" required min={gridForm.weekStart} value={gridForm.weekEnd} onChange={(event) => setGridForm({ ...gridForm, weekEnd: event.target.value })} /></label></div>
          <label>Notas<textarea className="input" rows={3} value={gridForm.notes} onChange={(event) => setGridForm({ ...gridForm, notes: event.target.value })} /></label>
          <button className="btn btn-primary btn-block" disabled={createGrid.isPending}>{createGrid.isPending ? 'Creando...' : 'Crear parrilla'}</button>
        </form>
      </Modal>

      <Modal open={Boolean(itemGridId)} onClose={() => setItemGridId(null)} title="Agregar publicación">
        <form className="modal-form" onSubmit={(event) => { event.preventDefault(); createItem.mutate(); }}>
          <label>Título o copy<input className="input" required maxLength={255} value={itemForm.caption} onChange={(event) => setItemForm({ ...itemForm, caption: event.target.value })} /></label>
          <div className="form-row"><label>Formato<select className="input" value={itemForm.type} onChange={(event) => setItemForm({ ...itemForm, type: event.target.value })}>{ITEM_TYPES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label>Fecha<input className="input" type="date" value={itemForm.scheduledAt} onChange={(event) => setItemForm({ ...itemForm, scheduledAt: event.target.value })} /></label></div>
          <label>Notas<textarea className="input" rows={3} value={itemForm.notes} onChange={(event) => setItemForm({ ...itemForm, notes: event.target.value })} /></label>
          <button className="btn btn-primary btn-block" disabled={createItem.isPending}>{createItem.isPending ? 'Agregando...' : 'Agregar a parrilla'}</button>
        </form>
      </Modal>
    </div>
  );
}
