import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { DataTable } from '../../shared/DataTable';
import { Modal } from '../../shared/Modal';
import { StatusBadge } from '../../shared/StatusBadge';
import { ConfirmDialog } from '../../shared/ConfirmDialog';
import { matchesSearch } from '../../shared/search';

interface QuoteItem { serviceId?: string; description: string; quantity: number; unitPrice: number; total?: number }
interface QuoteRow {
  [key: string]: unknown;
  id: string; number: string; title: string; amount: number; currency: string; status: string; version: number;
  clientId?: string; leadId?: string; client?: { name: string }; lead?: { name: string }; validUntil?: string;
  notes?: string; items?: QuoteItem[];
}
interface Target { id: string; name: string; status?: string }
interface ServiceOption { id: string; name: string; unitPrice?: number; currency: string }
interface QuoteForm { targetType: 'lead' | 'client'; targetId: string; title: string; currency: string; validUntil: string; notes: string; items: Array<{ serviceId: string; description: string; quantity: string; unitPrice: string }> }

const emptyItem = () => ({ serviceId: '', description: '', quantity: '1', unitPrice: '0' });
const emptyForm = (): QuoteForm => ({ targetType: 'lead', targetId: '', title: '', currency: 'CLP', validUntil: '', notes: '', items: [emptyItem()] });
const money = (value: number, currency = 'CLP') => new Intl.NumberFormat('es-CL', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value || 0);

export function CatalogQuotesTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ action: 'send' | 'accept' | 'version'; quote: QuoteRow } | null>(null);
  const [form, setForm] = useState<QuoteForm>(emptyForm());
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const quotesQuery = useQuery<QuoteRow[]>({ queryKey: ['catalog-quotes'], queryFn: () => api.get('/catalog/quotes') });
  const { data: leads = [] } = useQuery<Target[]>({ queryKey: ['crm-leads'], queryFn: () => api.get('/crm/leads') });
  const { data: clients = [] } = useQuery<Target[]>({ queryKey: ['clients'], queryFn: () => api.get('/clients') });
  const { data: services = [] } = useQuery<ServiceOption[]>({ queryKey: ['catalog-services'], queryFn: () => api.get('/catalog/services') });
  const rows = (quotesQuery.data ?? []).filter((quote) => (!status || quote.status === status) && matchesSearch(search, [quote.number, quote.title, quote.client?.name, quote.lead?.name]));
  const total = form.items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0), 0);
  const close = () => { setOpen(false); setEditingId(null); setForm(emptyForm()); };
  const refresh = async (text: string) => { await qc.invalidateQueries({ queryKey: ['catalog-quotes'] }); close(); setConfirm(null); setFeedback({ tone: 'success', text }); };
  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => editingId ? api.put(`/catalog/quotes/${editingId}`, body) : api.post('/catalog/quotes', body),
    onSuccess: () => refresh(editingId ? 'Cotización actualizada.' : 'Cotización creada en borrador.'),
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });
  const actionMutation = useMutation({
    mutationFn: ({ action, quote }: NonNullable<typeof confirm>) => api.post(`/catalog/quotes/${quote.id}/${action}`, {}),
    onSuccess: (_, variables) => refresh(variables.action === 'accept' ? 'Cotización aceptada: se creó o actualizó el cliente y su contrato.' : variables.action === 'send' ? 'Cotización marcada como enviada.' : 'Nueva versión creada como borrador.'),
    onError: (error: Error) => { setConfirm(null); setFeedback({ tone: 'error', text: error.message }); },
  });
  const openEdit = (quote: QuoteRow) => {
    setEditingId(quote.id);
    setForm({
      targetType: quote.leadId ? 'lead' : 'client', targetId: quote.leadId ?? quote.clientId ?? '', title: quote.title,
      currency: quote.currency, validUntil: quote.validUntil?.slice(0, 10) ?? '', notes: quote.notes ?? '',
      items: (quote.items?.length ? quote.items : [emptyItem()]).map((item) => ({ serviceId: item.serviceId ?? '', description: item.description, quantity: String(item.quantity), unitPrice: String(item.unitPrice) })),
    });
    setOpen(true);
  };
  const setItem = (index: number, changes: Partial<QuoteForm['items'][number]>) => setForm({ ...form, items: form.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item) });
  const selectService = (index: number, serviceId: string) => {
    const selected = services.find((service) => service.id === serviceId);
    setItem(index, { serviceId, description: selected?.name ?? '', unitPrice: String(selected?.unitPrice ?? 0) });
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    saveMutation.mutate({
      [form.targetType === 'lead' ? 'leadId' : 'clientId']: form.targetId,
      title: form.title.trim(), currency: form.currency, validUntil: form.validUntil || undefined, notes: form.notes.trim() || undefined,
      items: form.items.map((item) => ({ serviceId: item.serviceId || undefined, description: item.description.trim(), quantity: Number(item.quantity), unitPrice: Number(item.unitPrice) })),
    });
  };
  const targetOptions = form.targetType === 'lead' ? leads : clients;
  const confirmCopy = confirm?.action === 'accept'
    ? { title: 'Aceptar cotización', description: 'Esta acción cerrará la venta y generará automáticamente el cliente, contrato, capacidad UD y onboarding cuando corresponda.', label: 'Aceptar y activar' }
    : confirm?.action === 'send'
      ? { title: 'Marcar como enviada', description: 'La cotización quedará bloqueada para edición. Si necesita cambios, podrás crear una nueva versión.', label: 'Confirmar envío' }
      : { title: 'Crear nueva versión', description: 'Se conservará la versión actual y se creará una copia editable con numeración nueva.', label: 'Crear versión' };

  return <div className="catalog-panel quote-workspace">
    <div className="section-header catalog-section-header"><div><h2>Cotizaciones y propuestas</h2><p>Construye la oferta, controla versiones y convierte la aceptación en operación real.</p></div><button className="btn btn-primary" onClick={() => { setFeedback(null); setForm(emptyForm()); setOpen(true); }}>+ Nueva cotización</button></div>
    <div className="quote-flow"><span><b>1</b> Borrador editable</span><span><b>2</b> Envío controlado</span><span><b>3</b> Aceptación</span><span><b>4</b> Contrato + onboarding</span></div>
    {feedback && <div className={`alert alert-${feedback.tone}`} role="status">{feedback.text}</div>}
    <div className="filters"><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar número, propuesta o empresa..." /><select className="input" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos los estados</option><option value="draft">Borrador</option><option value="sent">Enviada</option><option value="accepted">Aceptada</option><option value="rejected">Rechazada</option><option value="expired">Vencida</option></select></div>
    <DataTable<QuoteRow> loading={quotesQuery.isLoading} data={rows} keyExtractor={(row) => row.id} emptyMessage="Aún no hay cotizaciones. Crea una para iniciar el circuito comercial." columns={[
      { key: 'number', label: 'Cotización', render: (row) => <span className="quote-number"><strong>{row.number}</strong><small>Versión {row.version}</small></span> },
      { key: 'title', label: 'Propuesta', sortable: true },
      { key: 'clientId', label: 'Destino', render: (row) => row.client?.name ?? row.lead?.name ?? 'Sin destino' },
      { key: 'amount', label: 'Total', sortable: true, render: (row) => money(Number(row.amount), row.currency) },
      { key: 'validUntil', label: 'Vigencia', render: (row) => row.validUntil ? new Date(row.validUntil).toLocaleDateString('es-CL') : 'Sin límite' },
      { key: 'status', label: 'Estado', render: (row) => <StatusBadge status={row.status} /> },
      { key: 'id', label: 'Acciones', render: (row) => <div className="table-actions">{row.status === 'draft' && <button className="btn btn-sm btn-outline" onClick={() => openEdit(row)}>Editar</button>}{row.status === 'draft' && <button className="btn btn-sm btn-outline" onClick={() => setConfirm({ action: 'send', quote: row })}>Enviar</button>}{['draft', 'sent'].includes(row.status) && <button className="btn btn-sm btn-primary" onClick={() => setConfirm({ action: 'accept', quote: row })}>Aceptar</button>}{row.status !== 'draft' && <button className="btn btn-sm btn-outline" onClick={() => setConfirm({ action: 'version', quote: row })}>Nueva versión</button>}</div> },
    ]} />
    <Modal open={open} onClose={close} title={editingId ? 'Editar cotización' : 'Nueva cotización'}><form className="modal-form quote-form" onSubmit={submit}>
      <div className="form-row"><label>Tipo de destinatario<select className="input" value={form.targetType} onChange={(event) => setForm({ ...form, targetType: event.target.value as QuoteForm['targetType'], targetId: '' })}><option value="lead">Lead en negociación</option><option value="client">Cliente existente</option></select></label><label>{form.targetType === 'lead' ? 'Lead' : 'Cliente'}<select required className="input" value={form.targetId} onChange={(event) => setForm({ ...form, targetId: event.target.value })}><option value="">Selecciona una opción</option>{targetOptions.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}</select></label></div>
      <label>Título de la propuesta<input className="input" required maxLength={255} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ej. Plan de crecimiento digital" /></label>
      <div className="form-row"><label>Moneda<select className="input" value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })}><option value="CLP">CLP</option><option value="USD">USD</option></select></label><label>Válida hasta<input className="input" type="date" value={form.validUntil} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} /></label></div>
      <fieldset className="quote-items"><legend>Servicios cotizados</legend>{form.items.map((item, index) => <div className="quote-item" key={index}><select className="input" value={item.serviceId} onChange={(event) => selectService(index, event.target.value)}><option value="">Ítem personalizado</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select><input className="input" required value={item.description} onChange={(event) => setItem(index, { description: event.target.value })} placeholder="Descripción" /><input aria-label="Cantidad" className="input" required type="number" min="1" value={item.quantity} onChange={(event) => setItem(index, { quantity: event.target.value })} /><input aria-label="Precio unitario" className="input" required type="number" min="0" value={item.unitPrice} onChange={(event) => setItem(index, { unitPrice: event.target.value })} /><button type="button" className="btn btn-sm btn-ghost-danger" disabled={form.items.length === 1} onClick={() => setForm({ ...form, items: form.items.filter((_, itemIndex) => itemIndex !== index) })}>Quitar</button></div>)}<button type="button" className="btn btn-sm btn-outline" onClick={() => setForm({ ...form, items: [...form.items, emptyItem()] })}>+ Agregar ítem</button></fieldset>
      <label>Notas y condiciones<textarea className="input" rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
      <div className="quote-total"><span>Total propuesta</span><strong>{money(total, form.currency)}</strong></div>
      {feedback?.tone === 'error' && <div className="alert alert-error">{feedback.text}</div>}
      <div className="modal-actions"><button className="btn btn-primary" disabled={saveMutation.isPending}>{saveMutation.isPending ? 'Guardando...' : 'Guardar borrador'}</button><button type="button" className="btn btn-outline" onClick={close}>Cancelar</button></div>
    </form></Modal>
    <ConfirmDialog open={Boolean(confirm)} title={confirmCopy.title} description={confirmCopy.description} confirmLabel={confirmCopy.label} pending={actionMutation.isPending} onClose={() => setConfirm(null)} onConfirm={() => confirm && actionMutation.mutate(confirm)} />
  </div>;
}
