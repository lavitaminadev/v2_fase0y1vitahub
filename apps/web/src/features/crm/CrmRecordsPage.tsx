import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { useAuth } from '../../core/auth';
import { DataTable } from '../../shared/DataTable';
import { EmptyState } from '../../shared/EmptyState';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { Modal } from '../../shared/Modal';
import { statusLabel } from '../../shared/status-labels';
import { matchesSearch } from '../../shared/search';
import { CrmNav } from './CrmNav';
import { useSearchParams } from 'react-router-dom';

interface PageResult<T> { data: T[]; total: number }
interface LeadOption { id: string; name: string; company?: string; createdAt?: string; status?: string }
interface ClientOption { id: string; name: string }
interface Contact { [key: string]: unknown; id: string; name: string; email?: string; phone?: string; position?: string; notes?: string; leadId?: string; createdAt: string }
interface Opportunity { [key: string]: unknown; id: string; name: string; amount?: number; stage: string; probability: number; expectedCloseDate?: string; nextAction?: string; nextActionAt?: string; leadId?: string; clientId?: string; createdAt: string }
interface Interaction { id: string; type: string; description?: string; date: string; leadId?: string; contactId?: string }

const EMPTY_OPPORTUNITY = { name: '', amount: '', stage: 'new', probability: '20', expectedCloseDate: '', nextAction: '', nextActionAt: '', leadId: '', clientId: '' };
const EMPTY_INTERACTION = { type: 'call', description: '', date: '', leadId: '', contactId: '' };
const STAGES = ['new', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

function WorkspaceHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action: () => void }) {
  return <div className="page-header"><div><span className="page-eyebrow">{eyebrow}</span><h1>{title}</h1><p className="page-subtitle">{description}</p></div><button type="button" className="btn btn-primary" onClick={action}>+ Nuevo registro</button></div>;
}

function DeleteRecordModal({ open, name, pending, error, onClose, onConfirm }: { open: boolean; name: string; pending: boolean; error?: Error | null; onClose: () => void; onConfirm: () => void }) {
  return <Modal open={open} onClose={onClose} title="Eliminar registro"><div className="modal-form"><p>Se eliminará “{name}” del CRM. Esta acción no elimina el lead o cliente relacionado.</p>{error && <div className="alert alert-error">{error.message}</div>}<div className="modal-actions"><button type="button" className="btn btn-outline" onClick={onClose}>Cancelar</button><button type="button" className="btn btn-danger" disabled={pending} onClick={onConfirm}>{pending ? 'Eliminando...' : 'Confirmar eliminación'}</button></div></div></Modal>;
}

interface ReservationContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  status: string;
  source?: string;
  sourceDetail?: string;
  campaignName?: string;
  tags?: string[];
  createdAt?: string;
}

const CONTACT_STATUSES: Record<string, string> = {
  new: 'Nuevo', reserved: 'Reservó', attended: 'Asistió', no_show: 'No asistió',
};

export function ContactsPage() {
  const user = useAuth((state) => state.user);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [clientFilter, setClientFilter] = useState(searchParams.get('clientId') ?? '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [tagging, setTagging] = useState<ReservationContact | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [historyContact, setHistoryContact] = useState<ReservationContact | null>(null);
  const { data: clients = [] } = useQuery<ClientOption[]>({ queryKey: ['clients'], queryFn: () => api.get('/clients'), enabled: user?.role !== 'client' });
  const contactsQuery = useQuery<ReservationContact[]>({
    queryKey: ['crm-reservation-contacts', clientFilter, statusFilter],
    queryFn: () => api.get(`/crm/leads?source=vitahub_reservations${clientFilter ? `&clientId=${encodeURIComponent(clientFilter)}` : ''}${statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : ''}`),
  });
  const { data: historyReservations = [], isLoading: historyLoading } = useQuery<Array<{ id: string; referenceCode: string; status: string; startsAt: string; partySize: number }>>({
    queryKey: ['lead-reservations', historyContact?.id],
    queryFn: () => api.get(`/crm/leads/${historyContact!.id}/reservations`),
    enabled: Boolean(historyContact),
  });
  const tagMutation = useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) => api.put(`/crm/leads/${id}`, { tags }),
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['crm-reservation-contacts'] }); setFeedback({ tone: 'success', text: 'Etiquetas actualizadas.' }); },
    onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }),
  });

  const contacts = (contactsQuery.data ?? []).filter((contact) => matchesSearch(search, [contact.name, contact.email, contact.phone, contact.company, contact.sourceDetail, contact.campaignName, ...(contact.tags || [])]));
  const updateFilter = (key: 'clientId' | 'status', value: string) => {
    setSearchParams((current) => { const next = new URLSearchParams(current); if (value) next.set(key, value); else next.delete(key); return next; });
    if (key === 'clientId') setClientFilter(value);
    if (key === 'status') setStatusFilter(value);
  };
  if (contactsQuery.isLoading) return <LoadingSpinner text="Cargando contactos..." />;

  const saveTags = (contact: ReservationContact) => {
    const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean);
    tagMutation.mutate({ id: contact.id, tags });
    setTagging(null);
  };

  return <div className="page"><CrmNav /><div className="page-header"><div><span className="page-eyebrow">CRM FASE 1</span><h1>Contactos de reservas</h1><p className="page-subtitle">Personas que llegaron por las agendas de reserva, filtrables por cliente y estado de asistencia.</p></div></div>{feedback && <div className={`alert alert-${feedback.tone}`} role={feedback.tone === 'error' ? 'alert' : 'status'}>{feedback.text}</div>}{contactsQuery.error && <div className="alert alert-error">{contactsQuery.error.message}</div>}<div className="filters crm-filter-bar"><input className="input" type="search" placeholder="Buscar persona, email, teléfono o campaña" value={search} onChange={(event) => setSearch(event.target.value)} />{user?.role !== 'client' && <select className="input" aria-label="Filtrar por cliente" value={clientFilter} onChange={(event) => updateFilter('clientId', event.target.value)}><option value="">Todos los clientes</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>}<select className="input" aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => updateFilter('status', event.target.value)}><option value="">Todos los estados</option>{Object.entries(CONTACT_STATUSES).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select><button type="button" className="btn btn-outline btn-sm" disabled={!search && !clientFilter && !statusFilter} onClick={() => { setSearch(''); updateFilter('clientId', ''); updateFilter('status', ''); }}>Limpiar</button><span className="filter-result-count">{contacts.length} contactos</span></div><DataTable<ReservationContact> storageKey="reservation-contacts" exportFileName="contactos-reservas" keyExtractor={(contact) => contact.id} data={contacts} emptyMessage="Aún no hay contactos de reservas" columns={[
    { key: 'name', label: 'Persona', sortable: true, render: (contact) => <div className="user-cell"><strong>{contact.name}</strong><small>{contact.company || 'Sin empresa'}</small></div> },
    { key: 'email', label: 'Email', render: (contact) => contact.email || '-' },
    { key: 'phone', label: 'Teléfono', render: (contact) => contact.phone || '-' },
    { key: 'status', label: 'Estado', render: (contact) => <span className={`crm-stage is-${contact.status}`}>{CONTACT_STATUSES[contact.status] || contact.status}</span> },
    { key: 'tags', label: 'Etiquetas', render: (contact) => <div className="contact-tags">{contact.tags?.map((tag) => <span key={tag} className="tag-chip">{tag}</span>) || <small>Sin etiquetas</small>}<button type="button" className="btn btn-outline btn-xs" onClick={() => { setTagging(contact); setTagInput((contact.tags || []).join(', ')); }}>Editar</button></div> },
    { key: 'source', label: 'Origen', render: (contact) => <div className="crm-table-stack"><strong>{contact.sourceDetail || 'Reserva'}</strong><small>{contact.campaignName || 'Sin campaña'}</small></div> },
    { key: 'createdAt', label: 'Creado', render: (contact) => contact.createdAt ? new Date(contact.createdAt).toLocaleDateString('es-CL') : '-' },
    { key: 'id', label: 'Acciones', render: (contact) => <div className="actions-cell"><button type="button" className="btn btn-outline btn-sm" onClick={() => { setHistoryContact(contact); }}>Historial</button></div> },
  ]} />
  <Modal open={Boolean(tagging)} onClose={() => setTagging(null)} title={tagging ? `Etiquetas de ${tagging.name}` : 'Etiquetas'}>{tagging && <div className="modal-form"><label>Etiquetas (separadas por coma)<input className="input" autoFocus value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="VIP, alergia, cumpleaños..." /></label><div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setTagging(null)}>Cancelar</button><button type="button" className="btn btn-primary" disabled={tagMutation.isPending} onClick={() => saveTags(tagging)}>{tagMutation.isPending ? 'Guardando...' : 'Guardar etiquetas'}</button></div></div>}</Modal>
  <Modal open={Boolean(historyContact)} onClose={() => setHistoryContact(null)} title={historyContact ? `Historial de ${historyContact.name}` : 'Historial'}>{historyContact && <div className="modal-form"><h4>Reservas vinculadas</h4>{historyLoading ? <p>Cargando...</p> : historyReservations.length === 0 ? <p>Sin reservas previas registradas.</p> : <div className="reservation-history">{historyReservations.map((reservation) => <div key={reservation.id}><span>Reserva #{reservation.referenceCode}</span><small>{new Date(reservation.startsAt).toLocaleString('es-CL')} · {CONTACT_STATUSES[reservation.status] || reservation.status}</small><em>{reservation.partySize} persona(s)</em></div>)}</div>}</div>}</Modal>
  </div>;
}

export function OpportunitiesPage() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuth((state) => state.user);
  const [open, setOpen] = useState(searchParams.get('create') === '1');
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Opportunity | null>(null);
  const [form, setForm] = useState(EMPTY_OPPORTUNITY);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [stageFilter, setStageFilter] = useState('');
  const [view, setView] = useState<'board' | 'table'>('board');
  const [feedback, setFeedback] = useState('');
  const opportunitiesQuery = useQuery<PageResult<Opportunity>>({ queryKey: ['crm-opportunities'], queryFn: () => api.get('/crm/opportunities?limit=100') });
  const leadsQuery = useQuery<LeadOption[]>({ queryKey: ['leads'], queryFn: () => api.get('/crm/leads') });
  const clientsQuery = useQuery<ClientOption[]>({ queryKey: ['clients'], queryFn: () => api.get('/clients') });
  const save = useMutation({ mutationFn: () => { const body = { name: form.name.trim(), amount: form.amount ? Number(form.amount) : undefined, stage: form.stage, probability: Number(form.probability), expectedCloseDate: form.expectedCloseDate || (editing ? null : undefined), nextAction: form.nextAction.trim() || (editing ? null : undefined), nextActionAt: form.nextActionAt ? new Date(form.nextActionAt).toISOString() : (editing ? null : undefined), leadId: form.leadId || (editing ? null : undefined), clientId: form.clientId || (editing ? null : undefined) }; return editing ? api.put(`/crm/opportunities/${editing.id}`, body) : api.post('/crm/opportunities', body); }, onSuccess: async () => { setOpen(false); setEditing(null); setForm(EMPTY_OPPORTUNITY); setFeedback('Oportunidad y próxima acción guardadas.'); await queryClient.invalidateQueries({ queryKey: ['crm-opportunities'] }); } });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/crm/opportunities/${id}`), onSuccess: async () => { setDeleteTarget(null); setFeedback('Oportunidad eliminada.'); await queryClient.invalidateQueries({ queryKey: ['crm-opportunities'] }); } });
  const moveStage = useMutation({ mutationFn: ({ id, stage }: { id: string; stage: string }) => api.put(`/crm/opportunities/${id}`, { stage }), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['crm-opportunities'] }) });
  const allOpportunities = opportunitiesQuery.data?.data ?? [];
  const opportunities = allOpportunities.filter((item) => (!stageFilter || item.stage === stageFilter) && matchesSearch(search, [item.name, leadsQuery.data?.find((lead) => lead.id === item.leadId)?.name, clientsQuery.data?.find((client) => client.id === item.clientId)?.name]));
  const total = allOpportunities.filter((item) => !['won', 'lost'].includes(item.stage)).reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const weighted = allOpportunities.filter((item) => !['won', 'lost'].includes(item.stage)).reduce((sum, item) => sum + Number(item.amount ?? 0) * item.probability / 100, 0);
  const overdue = allOpportunities.filter((item) => item.nextActionAt && new Date(item.nextActionAt) < new Date() && !['won', 'lost'].includes(item.stage));
  const forecast = Object.values(allOpportunities.filter((item) => item.expectedCloseDate && item.stage !== 'lost').reduce<Record<string, { key: string; label: string; amount: number; weighted: number; count: number }>>((months, item) => {
    const closeDate = item.expectedCloseDate!;
    const date = new Date(closeDate);
    const key = closeDate.slice(0, 7);
    const current = months[key] || { key, label: date.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' }), amount: 0, weighted: 0, count: 0 };
    current.amount += Number(item.amount || 0); current.weighted += Number(item.amount || 0) * item.probability / 100; current.count += 1; months[key] = current;
    return months;
  }, {})).sort((a, b) => a.key.localeCompare(b.key)).slice(0, 6);
  const openEdit = (item?: Opportunity) => { setEditing(item ?? null); setForm(item ? { name: item.name, amount: item.amount == null ? '' : String(item.amount), stage: item.stage, probability: String(item.probability), expectedCloseDate: item.expectedCloseDate?.slice(0, 10) ?? '', nextAction: item.nextAction ?? '', nextActionAt: item.nextActionAt ? new Date(item.nextActionAt).toISOString().slice(0, 16) : '', leadId: item.leadId ?? '', clientId: item.clientId ?? '' } : EMPTY_OPPORTUNITY); setOpen(true); };
  const ageInDays = (createdAt: string) => Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000));
  if (opportunitiesQuery.isLoading) return <LoadingSpinner text="Cargando oportunidades..." />;

  return <div className="page"><CrmNav /><WorkspaceHeader eyebrow="PRIORIDAD COMERCIAL" title="Oportunidades y forecast" description="Controla etapa, monto, probabilidad, cierre, antigüedad y la próxima acción que mueve cada negocio." action={() => openEdit()} />
  <div className="crm-summary-grid crm-summary-grid-four"><article><span>Pipeline abierto</span><strong>CLP {Math.round(total).toLocaleString('es-CL')}</strong></article><article><span>Forecast ponderado</span><strong>CLP {Math.round(weighted).toLocaleString('es-CL')}</strong></article><article className={overdue.length ? 'is-warning' : ''}><span>Seguimientos vencidos</span><strong>{overdue.length}</strong></article><article><span>Oportunidades</span><strong>{allOpportunities.length}</strong></article></div>
  {forecast.length > 0 && <section className="commercial-forecast"><header><div><span className="page-eyebrow">FORECAST MENSUAL</span><h3>Cierre esperado ponderado</h3></div><small>Valor x probabilidad</small></header><div>{forecast.map((month) => <article key={month.key}><span>{month.label}</span><strong>CLP {Math.round(month.weighted).toLocaleString('es-CL')}</strong><small>{month.count} negocio(s) · bruto CLP {Math.round(month.amount).toLocaleString('es-CL')}</small><i style={{ width: `${month.amount ? Math.max(4, month.weighted / month.amount * 100) : 0}%` }} /></article>)}</div></section>}
  {feedback && <div className="alert alert-success">{feedback}</div>}{opportunitiesQuery.error && <div className="alert alert-error">{opportunitiesQuery.error.message}</div>}
  <div className="filters opportunity-filters"><input className="input" type="search" placeholder="Buscar oportunidad, lead o cliente" value={search} onChange={(event) => setSearch(event.target.value)} /><select className="input" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}><option value="">Todas las etapas</option>{STAGES.map((stage) => <option key={stage} value={stage}>{statusLabel(stage)}</option>)}</select><div className="view-toggle" aria-label="Vista de oportunidades"><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}>Tablero</button><button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>Lista</button></div><span className="filter-result-count">{opportunities.length} resultados</span></div>
  {view === 'board' ? <div className="opportunity-board">{STAGES.filter((stage) => !stageFilter || stage === stageFilter).map((stage) => { const stageItems = opportunities.filter((item) => item.stage === stage); const stageAmount = stageItems.reduce((sum, item) => sum + Number(item.amount || 0), 0); return <section key={stage} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const id = event.dataTransfer.getData('opportunity-id'); if (id) moveStage.mutate({ id, stage }); }}><header><div><strong>{statusLabel(stage)}</strong><span>{stageItems.length}</span></div><small>CLP {Math.round(stageAmount).toLocaleString('es-CL')}</small></header><div>{stageItems.map((item) => <article draggable onDragStart={(event) => event.dataTransfer.setData('opportunity-id', item.id)} key={item.id} className={item.nextActionAt && new Date(item.nextActionAt) < new Date() && !['won', 'lost'].includes(item.stage) ? 'is-overdue' : ''}><button className="opportunity-card-main" onClick={() => openEdit(item)}><strong>{item.name}</strong><small>{clientsQuery.data?.find((client) => client.id === item.clientId)?.name || leadsQuery.data?.find((lead) => lead.id === item.leadId)?.name || 'Sin cuenta asociada'}</small></button><div className="opportunity-value"><strong>CLP {Number(item.amount || 0).toLocaleString('es-CL')}</strong><span>{item.probability}%</span></div><div className="opportunity-meta"><span>{ageInDays(item.createdAt)} días</span><span>{item.expectedCloseDate ? `Cierra ${new Date(item.expectedCloseDate).toLocaleDateString('es-CL')}` : 'Sin cierre'}</span></div>{item.nextAction && <div className="opportunity-next"><span>Próxima acción</span><strong>{item.nextAction}</strong><small>{item.nextActionAt ? new Date(item.nextActionAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' }) : 'Sin fecha'}</small></div>}</article>)}</div>{stageItems.length === 0 && <p>Suelta una oportunidad aquí</p>}</section>; })}</div> : <DataTable<Opportunity> keyExtractor={(item) => item.id} data={opportunities} emptyMessage="Aún no hay oportunidades" columns={[
    { key: 'name', label: 'Oportunidad', sortable: true, render: (item) => <div className="user-cell"><strong>{item.name}</strong><small>{ageInDays(item.createdAt)} días en pipeline</small></div> },
    { key: 'stage', label: 'Etapa', render: (item) => <span className={`crm-stage is-${item.stage}`}>{statusLabel(item.stage)}</span> },
    { key: 'amount', label: 'Valor', sortable: true, render: (item) => item.amount == null ? '-' : `CLP ${Number(item.amount).toLocaleString('es-CL')}` },
    { key: 'probability', label: 'Prob.', render: (item) => `${item.probability}%` },
    { key: 'expectedCloseDate', label: 'Cierre esperado', render: (item) => item.expectedCloseDate ? new Date(item.expectedCloseDate).toLocaleDateString('es-CL') : '-' },
    { key: 'nextAction', label: 'Próxima acción', render: (item) => <div className="user-cell"><strong>{item.nextAction || 'Sin definir'}</strong><small>{item.nextActionAt ? new Date(item.nextActionAt).toLocaleString('es-CL') : '-'}</small></div> },
    { key: 'id', label: 'Acciones', render: (item) => <div className="actions-cell"><button className="btn btn-outline btn-sm" onClick={() => openEdit(item)}>Actualizar</button>{user?.role === 'admin' && <button className="btn btn-outline btn-danger btn-sm" onClick={() => setDeleteTarget(item)}>Eliminar</button>}</div> },
  ]} />}
  <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Actualizar oportunidad' : 'Nueva oportunidad'}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>{save.error && <div className="alert alert-error">{save.error.message}</div>}<label>Nombre<input className="input" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><div className="form-row"><label>Valor estimado<input className="input" type="number" min="0" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label><label>Fecha de cierre<input className="input" type="date" value={form.expectedCloseDate} onChange={(event) => setForm({ ...form, expectedCloseDate: event.target.value })} /></label></div><div className="form-row"><label>Etapa<select className="input" value={form.stage} onChange={(event) => setForm({ ...form, stage: event.target.value })}>{STAGES.map((stage) => <option key={stage} value={stage}>{statusLabel(stage)}</option>)}</select></label><label>Probabilidad<input className="input" type="number" min="0" max="100" value={form.probability} onChange={(event) => setForm({ ...form, probability: event.target.value })} /></label></div><div className="form-row"><label>Próxima acción<input className="input" value={form.nextAction} onChange={(event) => setForm({ ...form, nextAction: event.target.value })} placeholder="Ej. Enviar propuesta corregida" /></label><label>Fecha y hora de seguimiento<input className="input" type="datetime-local" value={form.nextActionAt} onChange={(event) => setForm({ ...form, nextActionAt: event.target.value })} /></label></div><div className="form-row"><label>Lead<select className="input" value={form.leadId} onChange={(event) => setForm({ ...form, leadId: event.target.value })}><option value="">Sin lead</option>{leadsQuery.data?.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select></label><label>Cliente<select className="input" value={form.clientId} onChange={(event) => setForm({ ...form, clientId: event.target.value })}><option value="">Sin cliente</option>{clientsQuery.data?.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label></div><div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={save.isPending}>{save.isPending ? 'Guardando...' : 'Guardar oportunidad'}</button></div></form></Modal>
  <DeleteRecordModal open={Boolean(deleteTarget)} name={deleteTarget?.name ?? ''} pending={remove.isPending} error={remove.error} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)} /></div>;
}

export function InteractionsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuth((state) => state.user);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Interaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Interaction | null>(null);
  const [form, setForm] = useState(EMPTY_INTERACTION);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState('');
  const interactionsQuery = useQuery<PageResult<Interaction>>({ queryKey: ['crm-interactions'], queryFn: () => api.get('/crm/interactions?limit=100') });
  const contactsQuery = useQuery<PageResult<Contact>>({ queryKey: ['crm-contacts'], queryFn: () => api.get('/crm/contacts?limit=100') });
  const leadsQuery = useQuery<LeadOption[]>({ queryKey: ['leads'], queryFn: () => api.get('/crm/leads') });
  const opportunitiesQuery = useQuery<PageResult<Opportunity>>({ queryKey: ['crm-opportunities'], queryFn: () => api.get('/crm/opportunities?limit=100') });
  const save = useMutation({
    mutationFn: () => {
      const body = { type: form.type, description: form.description.trim() || undefined, date: form.date ? new Date(form.date).toISOString() : undefined, leadId: form.leadId || (editing ? null : undefined), contactId: form.contactId || (editing ? null : undefined) };
      return editing ? api.put(`/crm/interactions/${editing.id}`, body) : api.post('/crm/interactions', body);
    },
    onSuccess: async () => { setOpen(false); setEditing(null); setForm(EMPTY_INTERACTION); setFeedback('Actividad guardada correctamente.'); await queryClient.invalidateQueries({ queryKey: ['crm-interactions'] }); },
  });
  const remove = useMutation({ mutationFn: (id: string) => api.delete(`/crm/interactions/${id}`), onSuccess: async () => { setDeleteTarget(null); setFeedback('Actividad eliminada.'); await queryClient.invalidateQueries({ queryKey: ['crm-interactions'] }); } });
  const contactMap = useMemo(() => new Map((contactsQuery.data?.data ?? []).map((contact) => [contact.id, contact.name])), [contactsQuery.data]);
  const leadMap = useMemo(() => new Map((leadsQuery.data ?? []).map((lead) => [lead.id, lead.name])), [leadsQuery.data]);
  const openEdit = (item?: Interaction) => { setEditing(item ?? null); setForm(item ? { type: item.type, description: item.description ?? '', date: item.date ? new Date(item.date).toISOString().slice(0, 16) : '', leadId: item.leadId ?? '', contactId: item.contactId ?? '' } : EMPTY_INTERACTION); setOpen(true); };
  if (interactionsQuery.isLoading) return <LoadingSpinner text="Cargando actividad..." />;
  const interactions = (interactionsQuery.data?.data ?? []).filter((item) => (!typeFilter || item.type === typeFilter) && matchesSearch(search, [item.description, item.type, item.contactId ? contactMap.get(item.contactId) : '', item.leadId ? leadMap.get(item.leadId) : '']));
  const now = new Date();
  const endOfToday = new Date(now); endOfToday.setHours(23, 59, 59, 999);
  const dueFollowUps = (opportunitiesQuery.data?.data ?? []).filter((item) => item.nextActionAt && new Date(item.nextActionAt) <= endOfToday && !['won', 'lost'].includes(item.stage));
  const upcomingMeetings = (interactionsQuery.data?.data ?? []).filter((item) => item.type === 'meeting' && new Date(item.date) > now).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const contactedLeadIds = new Set((interactionsQuery.data?.data ?? []).map((item) => item.leadId).filter(Boolean));
  const untouchedLeads = (leadsQuery.data ?? []).filter((lead) => !contactedLeadIds.has(lead.id) && !['won', 'lost', 'converted'].includes(lead.status || '')).slice(0, 8);

  return <div className="page"><CrmNav /><WorkspaceHeader eyebrow="BANDEJA DIARIA" title="Centro de actividad comercial" description="Prioriza seguimientos, reuniones y leads sin contacto antes de revisar el historial completo." action={() => openEdit()} />
  <section className="commercial-inbox"><article className={dueFollowUps.length ? 'is-urgent' : ''}><header><span>Seguimientos para hoy o vencidos</span><strong>{dueFollowUps.length}</strong></header><div>{dueFollowUps.slice(0, 5).map((item) => <button key={item.id} onClick={() => navigate('/crm/opportunities')}><strong>{item.nextAction || item.name}</strong><small>{item.name} · {(item.nextActionAt ? new Date(item.nextActionAt).toLocaleString('es-CL') : 'Sin fecha')}</small></button>)}{dueFollowUps.length === 0 && <p>Bandeja al día. No hay seguimientos vencidos.</p>}</div></article><article><header><span>Reuniones próximas</span><strong>{upcomingMeetings.length}</strong></header><div>{upcomingMeetings.slice(0, 5).map((item) => <button key={item.id} onClick={() => setTypeFilter('meeting')}><strong>{item.description || 'Reunión comercial'}</strong><small>{new Date(item.date).toLocaleString('es-CL')}</small></button>)}{upcomingMeetings.length === 0 && <p>No hay reuniones futuras registradas.</p>}</div></article><article><header><span>Leads sin contacto</span><strong>{untouchedLeads.length}</strong></header><div>{untouchedLeads.slice(0, 5).map((lead) => <button key={lead.id} onClick={() => { setForm({ ...EMPTY_INTERACTION, leadId: lead.id }); setOpen(true); }}><strong>{lead.name}</strong><small>{lead.company || 'Sin empresa'} · registrar actividad</small></button>)}{untouchedLeads.length === 0 && <p>Todos los leads visibles tienen actividad.</p>}</div></article></section>
  {feedback && <div className="alert alert-success">{feedback}</div>}{interactionsQuery.error && <div className="alert alert-error">{interactionsQuery.error.message}</div>}<div className="filters"><input className="input" type="search" placeholder="Buscar detalle, persona o lead" value={search} onChange={(event) => setSearch(event.target.value)} /><select className="input" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">Todos los tipos</option><option value="call">Llamadas</option><option value="email">Correos</option><option value="meeting">Reuniones</option><option value="whatsapp">WhatsApp</option><option value="note">Notas</option></select><span className="filter-result-count">{interactions.length} actividades</span></div>{interactions.length === 0 ? <EmptyState icon="HC" title="Sin actividad registrada" description="Crea la primera interacción y vincúlala a un lead o contacto." /> : <div className="crm-timeline">{interactions.map((item) => <article key={item.id}><i /><div className="crm-timeline-content"><div><strong>{statusLabel(item.type)}</strong><time>{new Date(item.date).toLocaleString('es-CL')}</time></div><p>{item.description || 'Sin observaciones adicionales.'}</p><small>{item.contactId ? `Contacto: ${contactMap.get(item.contactId) ?? 'No disponible'}` : item.leadId ? `Lead: ${leadMap.get(item.leadId) ?? 'No disponible'}` : 'Actividad general'}</small></div><div className="crm-timeline-actions"><button className="btn btn-outline btn-sm" onClick={() => openEdit(item)}>Editar</button>{user?.role === 'admin' && <button className="btn btn-outline btn-danger btn-sm" onClick={() => setDeleteTarget(item)}>Eliminar</button>}</div></article>)}</div>}
  <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Editar actividad' : 'Registrar actividad'}><form className="modal-form" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>{save.error && <div className="alert alert-error">{save.error.message}</div>}<div className="form-row"><label>Tipo<select className="input" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="call">Llamada</option><option value="email">Correo</option><option value="meeting">Reunión</option><option value="whatsapp">WhatsApp</option><option value="note">Nota</option></select></label><label>Fecha y hora<input className="input" type="datetime-local" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label></div><div className="form-row"><label>Lead<select className="input" value={form.leadId} onChange={(event) => setForm({ ...form, leadId: event.target.value })}><option value="">Sin lead</option>{leadsQuery.data?.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select></label><label>Contacto<select className="input" value={form.contactId} onChange={(event) => setForm({ ...form, contactId: event.target.value })}><option value="">Sin contacto</option>{contactsQuery.data?.data.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label></div><label>Descripción<textarea className="input" rows={5} required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><div className="modal-actions"><button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>Cancelar</button><button className="btn btn-primary" disabled={save.isPending || !form.description.trim()}>{save.isPending ? 'Guardando...' : 'Guardar actividad'}</button></div></form></Modal>
  <DeleteRecordModal open={Boolean(deleteTarget)} name={deleteTarget ? `${statusLabel(deleteTarget.type)} del ${new Date(deleteTarget.date).toLocaleDateString('es-CL')}` : ''} pending={remove.isPending} error={remove.error} onClose={() => setDeleteTarget(null)} onConfirm={() => deleteTarget && remove.mutate(deleteTarget.id)} /></div>;
}
