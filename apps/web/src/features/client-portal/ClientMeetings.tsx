import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { EmptyState } from '../../shared/EmptyState';
import { statusLabel } from '../../shared/status-labels';

interface ActionItem {
  id: string;
  description: string;
  status: string;
  dueAt?: string;
}

interface ClientMeetingItem {
  id: string;
  title?: string;
  scheduledAt: string;
  location?: string;
  meetingLink?: string;
  minutes?: string;
  actionItems?: ActionItem[];
}

export function ClientMeetings() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<ClientMeetingItem[]>({
    queryKey: ['client-meetings'],
    queryFn: () => api.get('/meetings'),
  });
  const updateAction = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.put(`/meetings/action-items/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client-meetings'] }),
  });

  if (isLoading) return <LoadingSpinner text="Cargando reuniones..." />;
  if (error) return <div className="alert alert-error">Error al cargar reuniones</div>;

  const meetings = Array.isArray(data) ? data : [];

  return (
    <div className="page">
      <h1>Mis reuniones</h1>
      <p className="page-subtitle">Revisa proximas instancias, modalidad, enlaces y compromisos para cada reunion.</p>

      {meetings.length === 0 ? (
        <EmptyState
          icon="[]"
          title="Sin reuniones agendadas"
          description="No hay reuniones publicadas para este cliente en este momento."
        />
      ) : (
        <div className="portal-list">
          {meetings.map((meeting) => (
            <div key={meeting.id} className="card portal-item-card">
              <div>
                <h3>{meeting.title || 'Reunion'}</h3>
                <p>
                  {new Date(meeting.scheduledAt).toLocaleString('es-CL')}
                  {meeting.location ? ` · ${meeting.location}` : ''}
                </p>
                {meeting.minutes && <div className="meeting-notes"><strong>Acta y acuerdos</strong><p>{meeting.minutes}</p></div>}
              </div>
              <div className="portal-item-actions">
                {meeting.meetingLink && (
                  <a className="btn btn-outline btn-sm" href={meeting.meetingLink} target="_blank" rel="noreferrer">
                    Unirse
                  </a>
                )}
              </div>
              {(meeting.actionItems?.length ?? 0) > 0 && (
                <div className="portal-list">
                  {meeting.actionItems?.map((item) => (
                    <div key={item.id} className="crm-related-item">
                      <strong>{item.description}</strong>
                      <span>{statusLabel(item.status)}</span>
                      <span>{item.dueAt ? new Date(item.dueAt).toLocaleDateString() : 'Sin vencimiento'}</span>
                      <button
                        className={`btn btn-sm ${item.status === 'completed' ? 'btn-outline' : 'btn-primary'}`}
                        type="button"
                        disabled={updateAction.isPending}
                        onClick={() => updateAction.mutate({ id: item.id, status: item.status === 'completed' ? 'pending' : 'completed' })}
                      >
                        {item.status === 'completed' ? 'Reabrir' : 'Marcar completado'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {updateAction.error && <div className="alert alert-error">No fue posible actualizar el compromiso.</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
