import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../core/api';
import { useAuth } from '../core/auth';
import { getNavigation } from '../core/navigation.registry';
import { publicReservationUrl } from '../core/public-url';

interface SearchItem { id: string; group: string; title: string; description: string; path?: string; action?: () => void }
interface ClientResult { id: string; name: string; industry?: string; status: string }
interface LeadResult { id: string; name: string; company?: string; email?: string; status: string }
interface DocumentResult { id: string; name: string; type: string; status: string; clientId?: string }
interface FormResult { id: string; name: string; publicSlug: string; publicUrl?: string; status: string }
interface MeetingResult { id: string; title?: string; subject?: string; scheduledAt?: string; date?: string }
interface UserResult { id: string; name: string; email: string; role: string; isActive: boolean }
interface OpportunityResult { id: string; name: string; stage: string; amount?: number; nextAction?: string }
interface ReservationResult { id: string; referenceCode: string; guestName: string; guestEmail?: string; guestPhone?: string; status: string }

export function CommandPalette() {
  const user = useAuth((state) => state.user);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [taskMode, setTaskMode] = useState(false);
  const [taskForm, setTaskForm] = useState({ meetingId: '', description: '' });
  const navigation = useMemo(() => getNavigation(user?.role), [user?.role]);
  const hasPath = useCallback((prefix: string) => navigation.some((item) => item.path.startsWith(prefix)), [navigation]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setOpen((current) => !current); }
      if (event.key === 'Escape') { setOpen(false); setTaskMode(false); }
    };
    const handleOpen = () => setOpen(true);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('vitahub:open-command', handleOpen);
    return () => { window.removeEventListener('keydown', handleKey); window.removeEventListener('vitahub:open-command', handleOpen); };
  }, []);

  useEffect(() => {
    if (!open) return;
    setActiveIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 30);
  }, [open, taskMode]);

  const clientsQuery = useQuery<ClientResult[]>({ queryKey: ['command-clients'], queryFn: () => api.get('/clients'), enabled: open && hasPath('/clients'), retry: false });
  const leadsQuery = useQuery<LeadResult[]>({ queryKey: ['command-leads'], queryFn: () => api.get('/crm/leads'), enabled: open && hasPath('/crm'), retry: false });
  const documentsQuery = useQuery<{ data: DocumentResult[] }>({ queryKey: ['command-documents'], queryFn: () => api.get('/documents'), enabled: open && hasPath('/documents'), retry: false });
  const formsQuery = useQuery<FormResult[]>({ queryKey: ['command-forms'], queryFn: () => api.get('/reservations/forms'), enabled: open && hasPath('/reservations'), retry: false });
  const reservationsQuery = useQuery<{ items: ReservationResult[] }>({ queryKey: ['command-reservations'], queryFn: () => api.get('/reservations?page=1&pageSize=50'), enabled: open && hasPath('/reservations'), retry: false });
  const usersQuery = useQuery<UserResult[]>({ queryKey: ['command-users'], queryFn: () => api.get('/users'), enabled: open && hasPath('/users'), retry: false });
  const opportunitiesQuery = useQuery<{ data: OpportunityResult[] }>({ queryKey: ['command-opportunities'], queryFn: () => api.get('/crm/opportunities?limit=100'), enabled: open && hasPath('/crm'), retry: false });
  const meetingsQuery = useQuery<MeetingResult[]>({ queryKey: ['command-meetings'], queryFn: () => api.get('/meetings'), enabled: open && taskMode && hasPath('/meetings'), retry: false });
  const taskMutation = useMutation({ mutationFn: () => api.post(`/meetings/${taskForm.meetingId}/action-items`, { description: taskForm.description.trim() }), onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: ['meetings'] }); setTaskForm({ meetingId: '', description: '' }); setTaskMode(false); setOpen(false); } });

  const items = useMemo<SearchItem[]>(() => {
    const actions: SearchItem[] = navigation.map((item) => ({ id: `nav-${item.path}`, group: 'Navegación', title: item.label, description: `Abrir ${item.label}`, path: item.path }));
    if (hasPath('/clients')) actions.unshift({ id: 'action-new-client', group: 'Acciones rápidas', title: 'Crear empresa o cliente', description: 'Abrir nueva ficha comercial', path: '/clients?create=1' });
    if (hasPath('/users')) actions.unshift({ id: 'action-new-user', group: 'Acciones rápidas', title: 'Crear usuario', description: 'Asignar rol, empresa y acceso', path: '/users?create=1' });
    if (hasPath('/documents')) actions.unshift({ id: 'action-new-document', group: 'Acciones rápidas', title: 'Crear documento', description: 'Registrar o subir archivo a Drive', path: '/documents?create=1' });
    if (hasPath('/production')) actions.unshift({ id: 'action-new-piece', group: 'Acciones rápidas', title: 'Crear pieza de producción', description: 'Abrir encargo con fecha y dependencias', path: '/production?create=1' });
    if (hasPath('/crm')) actions.unshift(
      { id: 'nav-opportunities', group: 'CRM Comercial', title: 'Oportunidades y forecast', description: 'Abrir tablero comercial', path: '/crm/opportunities' },
      { id: 'nav-contacts', group: 'CRM Comercial', title: 'Contactos', description: 'Abrir personas y canales', path: '/crm/contacts' },
      { id: 'nav-activity', group: 'CRM Comercial', title: 'Centro de actividad', description: 'Abrir seguimientos y bandeja diaria', path: '/crm/interactions' },
      { id: 'action-new-opportunity', group: 'Acciones rápidas', title: 'Crear oportunidad', description: 'Registrar monto, cierre y próxima acción', path: '/crm/opportunities?create=1' },
      { id: 'action-new-lead', group: 'Acciones rápidas', title: 'Crear lead', description: 'Abrir registro comercial', path: '/crm/leads?create=1' },
    );
    if (hasPath('/reservations')) actions.unshift({ id: 'action-new-form', group: 'Acciones rápidas', title: 'Crear formulario o encuesta', description: 'Abrir el constructor guiado', path: '/reservations?create=1' });
    if (hasPath('/meetings')) actions.unshift({ id: 'action-new-task', group: 'Acciones rápidas', title: 'Crear tarea de reunión', description: 'Registrar una acción sin abandonar la pantalla', action: () => setTaskMode(true) });
    const records: SearchItem[] = [
      ...(clientsQuery.data || []).map((client) => ({ id: `client-${client.id}`, group: 'Clientes', title: client.name, description: `${client.industry || 'Sin industria'} · ${client.status}`, path: `/clients/${client.id}` })),
      ...(leadsQuery.data || []).map((lead) => ({ id: `lead-${lead.id}`, group: 'Leads', title: lead.name, description: `${lead.company || lead.email || 'Sin empresa'} · ${lead.status}`, path: `/crm/leads?focus=${lead.id}` })),
      ...(documentsQuery.data?.data || []).map((document) => ({ id: `document-${document.id}`, group: 'Documentos', title: document.name, description: `${document.type} · ${document.status}`, path: `/documents?q=${encodeURIComponent(document.name)}` })),
      ...(formsQuery.data || []).map((form) => ({ id: `form-${form.id}`, group: 'Reservas y formularios', title: form.name, description: `${form.status} · ${publicReservationUrl(form.publicSlug, form.publicUrl)}`, path: `/reservations/forms/${form.id}` })),
      ...(reservationsQuery.data?.items || []).map((reservation) => ({ id: `reservation-${reservation.id}`, group: 'Reservas', title: reservation.guestName, description: `#${reservation.referenceCode} · ${reservation.guestEmail || reservation.guestPhone || reservation.status}`, path: `/reservations?tab=bookings&search=${encodeURIComponent(reservation.referenceCode)}` })),
      ...(usersQuery.data || []).map((account) => ({ id: `user-${account.id}`, group: 'Usuarios', title: account.name, description: `${account.email} · ${account.role} · ${account.isActive ? 'activo' : 'inactivo'}`, path: `/users?q=${encodeURIComponent(account.email)}` })),
      ...(opportunitiesQuery.data?.data || []).map((opportunity) => ({ id: `opportunity-${opportunity.id}`, group: 'Oportunidades', title: opportunity.name, description: `${opportunity.stage} · ${opportunity.nextAction || `CLP ${Number(opportunity.amount || 0).toLocaleString('es-CL')}`}`, path: `/crm/opportunities?search=${encodeURIComponent(opportunity.name)}` })),
    ];
    const needle = query.trim().toLocaleLowerCase('es');
    return [...actions, ...records].filter((item) => !needle || `${item.title} ${item.description} ${item.group}`.toLocaleLowerCase('es').includes(needle)).slice(0, 40);
  }, [clientsQuery.data, documentsQuery.data, formsQuery.data, hasPath, leadsQuery.data, navigation, opportunitiesQuery.data, query, reservationsQuery.data, usersQuery.data]);

  const execute = (item: SearchItem | undefined) => {
    if (!item) return;
    if (item.action) { item.action(); return; }
    if (item.path) navigate(item.path);
    setOpen(false); setQuery('');
  };

  if (!open) return null;
  return <div className="command-palette-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
    <header><span>VK</span>{taskMode ? <div><strong>Nueva tarea de reunión</strong><small>Se guardará en el acta seleccionada</small></div> : <input ref={inputRef} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }} onKeyDown={(event) => { if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, items.length - 1)); } if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); } if (event.key === 'Enter') { event.preventDefault(); execute(items[activeIndex]); } }} placeholder="Buscar clientes, leads, documentos, reservas o una acción..." aria-label="Buscar en VITAHUB" />}<kbd>ESC</kbd></header>
    {taskMode ? <form className="command-task" onSubmit={(event) => { event.preventDefault(); taskMutation.mutate(); }}><label>Reunión<select className="input" required value={taskForm.meetingId} onChange={(event) => setTaskForm({ ...taskForm, meetingId: event.target.value })}><option value="">Selecciona un acta</option>{meetingsQuery.data?.map((meeting) => <option value={meeting.id} key={meeting.id}>{meeting.title || meeting.subject || 'Reunión'}{meeting.scheduledAt || meeting.date ? ` · ${new Date(meeting.scheduledAt || meeting.date!).toLocaleDateString('es-CL')}` : ''}</option>)}</select></label><label>Tarea<input className="input" autoFocus required minLength={2} value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} placeholder="Ej. Enviar propuesta el viernes" /></label>{taskMutation.error && <div className="alert alert-error">{taskMutation.error.message}</div>}<div><button type="button" className="btn btn-outline" onClick={() => setTaskMode(false)}>Volver</button><button className="btn btn-primary" disabled={taskMutation.isPending}>{taskMutation.isPending ? 'Guardando...' : 'Crear tarea'}</button></div></form> : <div className="command-results">{items.map((item, index) => <button className={index === activeIndex ? 'active' : ''} key={item.id} onMouseEnter={() => setActiveIndex(index)} onClick={() => execute(item)}><span>{item.group.slice(0, 2).toUpperCase()}</span><div><strong>{item.title}</strong><small>{item.description}</small></div><em>{item.group}</em></button>)}{items.length === 0 && <div className="command-empty"><strong>Sin resultados</strong><span>Prueba con otro nombre, correo o módulo.</span></div>}</div>}
    {!taskMode && <footer><span><kbd>↑</kbd><kbd>↓</kbd> navegar</span><span><kbd>↵</kbd> abrir</span><span>Ctrl K desde cualquier pantalla</span></footer>}
  </section></div>;
}
