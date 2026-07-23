import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { StatusBadge } from '../../shared/StatusBadge';
import { statusLabel } from '../../shared/status-labels';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { Modal } from '../../shared/Modal';
import { EmptyState } from '../../shared/EmptyState';
import { useSearchParams } from 'react-router-dom';

interface ActionItem {
  id: string;
  description: string;
  status: string;
  dueAt?: string;
}

interface Meeting {
  id: string;
  title: string;
  type: string;
  status: string;
  scheduledAt: string;
  durationMinutes?: number;
  clientId?: string;
  location?: string;
  meetingLink?: string;
  minutes?: string;
  actionItems?: ActionItem[];
}

interface ClientOption {
  id: string;
  name: string;
}

interface MeetingFormState {
  clientId: string;
  title: string;
  type: string;
  date: string;
  time: string;
  durationMinutes: string;
  location: string;
  meetingLink: string;
  minutes: string;
}

const EMPTY_FORM: MeetingFormState = {
  clientId: '',
  title: '',
  type: 'weekly',
  date: '',
  time: '',
  durationMinutes: '30',
  location: '',
  meetingLink: '',
  minutes: '',
};

export function MeetingsPage() {
  const [searchParams] = useSearchParams();
  const [clientFilter, setClientFilter] = useState(searchParams.get('clientId') ?? '');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<MeetingFormState>(EMPTY_FORM);
  const [actionItemDrafts, setActionItemDrafts] = useState<Record<string, string>>({});
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [minutesDraft, setMinutesDraft] = useState('');
  const [meetingStatus, setMeetingStatus] = useState('scheduled');
  const queryClient = useQueryClient();

  const { data: meetings, isLoading, error } = useQuery<Meeting[]>({
    queryKey: ['meetings'],
    queryFn: () => api.get('/meetings'),
  });

  const { data: clients } = useQuery<ClientOption[]>({
    queryKey: ['clients'],
    queryFn: () => api.get('/clients'),
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/meetings', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      setModalOpen(false);
      setForm(EMPTY_FORM);
    },
  });

  const createActionItemMutation = useMutation({
    mutationFn: ({ meetingId, description }: { meetingId: string; description: string }) =>
      api.post(`/meetings/${meetingId}/action-items`, { description }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetings'] }),
  });
  const calendarMutation = useMutation({
    mutationFn: (meetingId: string) => api.post(`/meetings/${meetingId}/google-calendar`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetings'] }),
  });
  const updateMeetingMutation = useMutation({
    mutationFn: ({ id, minutes, status }: { id: string; minutes: string; status: string }) =>
      api.put(`/meetings/${id}`, { minutes, status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      setEditingMeeting(null);
    },
  });
  const updateActionItemMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/meetings/action-items/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetings'] }),
  });

  const clientMap = useMemo(
    () => new Map((clients ?? []).map((client) => [client.id, client.name])),
    [clients],
  );

  if (isLoading) return <LoadingSpinner text="Cargando reuniones..." />;
  if (error) return <div className="alert alert-error">Error al cargar reuniones</div>;

  const sorted = [...(meetings ?? [])].filter((meeting) => !clientFilter || meeting.clientId === clientFilter).sort(
    (a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
  );

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const scheduledAt = form.date && form.time ? new Date(`${form.date}T${form.time}`).toISOString() : undefined;
    createMutation.mutate({
      clientId: form.clientId || undefined,
      title: form.title.trim(),
      type: form.type,
      scheduledAt,
      durationMinutes: Number(form.durationMinutes),
      location: form.location.trim() || undefined,
      meetingLink: form.meetingLink.trim() || undefined,
      minutes: form.minutes.trim() || undefined,
    });
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Reuniones</h1>
          <p className="page-subtitle">Registro operativo de reuniones y compromisos asociados para seguimiento semanal y estrategico.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setForm((current) => ({ ...current, clientId: clientFilter })); setModalOpen(true); }}>
          + Nueva Reunión
        </button>
      </div>
      <div className="filters"><select className="input" aria-label="Filtrar reuniones por cliente" value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}><option value="">Todos los clientes</option>{(clients ?? []).map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select><span className="filter-result-count">{sorted.length} reuniones</span></div>
      {sorted.length === 0 ? (
        <EmptyState icon="📅" title="Sin reuniones" description="Programá tu primera reunión para dar seguimiento a los clientes." action={<button className="btn btn-primary" onClick={() => { setForm((current) => ({ ...current, clientId: clientFilter })); setModalOpen(true); }}>+ Nueva Reunión</button>} />
      ) : (
        <div className="meeting-list">
          {sorted.map((meeting) => {
            const scheduledAt = new Date(meeting.scheduledAt);
            return (
              <div key={meeting.id} className="meeting-card">
                <div className="meeting-date">
                  <div className="meeting-day">{scheduledAt.getDate()}</div>
                  <div className="meeting-month">{scheduledAt.toLocaleString('es', { month: 'short' })}</div>
                </div>
                <div className="meeting-info">
                  <div className="meeting-title">{meeting.title}</div>
                  <div className="meeting-meta">
                    {scheduledAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {meeting.durationMinutes ?? 60} min · {statusLabel(meeting.type)}
                  </div>
                  {meeting.clientId && (
                    <div className="meeting-participants">Cliente: {clientMap.get(meeting.clientId) ?? meeting.clientId}</div>
                  )}
                  {meeting.location && <div className="meeting-meta">Lugar: {meeting.location}</div>}
                  {meeting.meetingLink && (
                    <div className="meeting-participants">
                      <a href={meeting.meetingLink} target="_blank" rel="noreferrer">
                        Abrir enlace
                      </a>
                    </div>
                  )}
                  {meeting.minutes && <div className="meeting-notes">{meeting.minutes}</div>}
                  <div className="portal-item-actions" style={{ marginTop: '8px' }}>
                    <button className="btn btn-sm btn-outline" onClick={() => { setEditingMeeting(meeting); setMinutesDraft(meeting.minutes ?? ''); setMeetingStatus(meeting.status); }}>
                      {meeting.minutes ? 'Editar acta' : 'Registrar acta'}
                    </button>
                    {!meeting.meetingLink && <button className="btn btn-sm btn-outline" onClick={() => calendarMutation.mutate(meeting.id)} disabled={calendarMutation.isPending}>Publicar en Google Calendar</button>}
                    <input
                      className="input"
                      placeholder="Nuevo compromiso o accion"
                      value={actionItemDrafts[meeting.id] || ''}
                      onChange={(e) => setActionItemDrafts((current) => ({ ...current, [meeting.id]: e.target.value }))}
                    />
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => {
                        const description = actionItemDrafts[meeting.id]?.trim();
                        if (!description) return;
                        createActionItemMutation.mutate({ meetingId: meeting.id, description });
                        setActionItemDrafts((current) => ({ ...current, [meeting.id]: '' }));
                      }}
                    >
                      Agregar accion
                    </button>
                  </div>
                  {(meeting.actionItems?.length ?? 0) > 0 && (
                    <div className="portal-list" style={{ marginTop: '10px' }}>
                      {meeting.actionItems?.map((item) => (
                        <div key={item.id} className="crm-related-item">
                          <strong>{item.description}</strong>
                          <span>{statusLabel(item.status)}</span>
                          <span>{item.dueAt ? new Date(item.dueAt).toLocaleDateString() : 'Sin vencimiento'}</span>
                          <button
                            className="btn btn-sm btn-outline"
                            disabled={updateActionItemMutation.isPending}
                            onClick={() => updateActionItemMutation.mutate({ id: item.id, status: item.status === 'completed' ? 'pending' : 'completed' })}
                          >
                            {item.status === 'completed' ? 'Reabrir' : 'Completar'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <StatusBadge status={meeting.status} />
              </div>
            );
          })}
        </div>
      )}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nueva Reunión">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Cliente</label>
            <select className="input" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              <option value="">Sin cliente</option>
              {(clients ?? []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Titulo</label>
            <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Tipo</label>
              <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="weekly">Semanal</option>
                <option value="strategic">Estratégica</option>
              </select>
            </div>
            <div className="form-group">
              <label>Duracion (min)</label>
              <input className="input" type="number" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Fecha</label>
              <input className="input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Hora</label>
              <input className="input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} required />
            </div>
          </div>
          <div className="form-group">
            <label>Ubicacion</label>
            <input className="input" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Link</label>
            <input className="input" type="url" value={form.meetingLink} onChange={(e) => setForm({ ...form, meetingLink: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Acta o acuerdos iniciales <span className="text-muted">(opcional)</span></label>
            <textarea className="input" rows={4} value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} placeholder="Decisiones, contexto y próximos pasos" />
          </div>
          {createMutation.error && <div className="alert alert-error">No fue posible crear la reunión. Revisa los datos e inténtalo nuevamente.</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creando...' : 'Crear Reunion'}
          </button>
        </form>
      </Modal>
      <Modal open={Boolean(editingMeeting)} onClose={() => setEditingMeeting(null)} title="Acta de reunión">
        <form onSubmit={(event) => { event.preventDefault(); if (editingMeeting) updateMeetingMutation.mutate({ id: editingMeeting.id, minutes: minutesDraft.trim(), status: meetingStatus }); }}>
          <div className="form-group">
            <label htmlFor="meeting-status">Estado</label>
            <select id="meeting-status" className="input" value={meetingStatus} onChange={(event) => setMeetingStatus(event.target.value)}>
              <option value="scheduled">Programada</option>
              <option value="completed">Completada</option>
              <option value="rescheduled">Reprogramada</option>
              <option value="cancelled">Cancelada</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="meeting-minutes">Decisiones y acuerdos</label>
            <textarea id="meeting-minutes" className="input" rows={8} value={minutesDraft} onChange={(event) => setMinutesDraft(event.target.value)} placeholder="Registra decisiones, responsables y próximos pasos" />
          </div>
          {updateMeetingMutation.error && <div className="alert alert-error">No fue posible guardar el acta.</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={updateMeetingMutation.isPending}>
            {updateMeetingMutation.isPending ? 'Guardando...' : 'Guardar acta'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
