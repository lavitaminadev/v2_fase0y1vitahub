import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { StatusBadge } from '../../shared/StatusBadge';
import { EmptyState } from '../../shared/EmptyState';
import { Modal } from '../../shared/Modal';

interface ClientApprovalItem {
  id: string;
  pieceId?: string;
  pieceTitle?: string;
  status: string;
  createdAt?: string;
  versionUrl?: string;
  decisionNotes?: string;
}

export function ClientApprovals() {
  const queryClient = useQueryClient();
  const [rejection, setRejection] = useState<{ id: string; title: string } | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const { data, isLoading, error } = useQuery<ClientApprovalItem[]>({
    queryKey: ['client-approvals'],
    queryFn: () => api.get('/approvals'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.put(`/approvals/${id}`, { status: 'approved' }),
    onSuccess: () => {
      setRejection(null);
      setRejectionNotes('');
      setFeedback({ tone: 'success', text: 'Pieza aprobada. Tu decisión quedó registrada.' });
      return queryClient.invalidateQueries({ queryKey: ['client-approvals'] });
    },
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, decisionNotes }: { id: string; decisionNotes?: string }) =>
      api.put(`/approvals/${id}`, { status: 'rejected', decisionNotes }),
    onSuccess: () => {
      setRejection(null);
      setRejectionNotes('');
      setFeedback({ tone: 'success', text: 'Solicitud de corrección enviada al equipo.' });
      return queryClient.invalidateQueries({ queryKey: ['client-approvals'] });
    },
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  if (isLoading) return <LoadingSpinner text="Cargando aprobaciones..." />;
  if (error) return <div className="alert alert-error">Error al cargar aprobaciones</div>;

  const approvals = Array.isArray(data) ? data.filter((item) => item.status === 'pending') : [];

  return (
    <div className="page">
      <h1>Mis aprobaciones</h1>
      <p className="page-subtitle">Revisa piezas pendientes, abre la versión entregada y responde desde el portal.</p>
      {feedback && <div className={`alert alert-${feedback.tone}`} role="status">{feedback.text}</div>}

      {approvals.length === 0 ? (
        <EmptyState
          icon="OK"
          title="Sin piezas pendientes"
          description="No tienes aprobaciones activas por revisar en este momento."
        />
      ) : (
        <div className="portal-list">
          {approvals.map((approval) => (
            <div key={approval.id} className="card portal-item-card">
              <div>
                <h3>{approval.pieceTitle || approval.pieceId || 'Pieza pendiente'}</h3>
                <div className="portal-item-meta">
                  <StatusBadge status={approval.status} />
                  <span>{approval.createdAt ? new Date(approval.createdAt).toLocaleDateString() : 'Sin fecha'}</span>
                </div>
              </div>
              <div className="portal-item-actions">
                {approval.versionUrl && (
                  <a className="btn btn-outline btn-sm" href={approval.versionUrl} target="_blank" rel="noreferrer">
                    Ver pieza
                  </a>
                )}
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => approveMutation.mutate(approval.id)}
                  disabled={approveMutation.isPending}
                >
                  {approveMutation.isPending ? 'Aprobando...' : 'Aprobar'}
                </button>
                <button
                  className="btn btn-outline btn-sm btn-danger"
                  onClick={() => setRejection({
                    id: approval.id,
                    title: approval.pieceTitle || approval.pieceId || 'Pieza pendiente',
                  })}
                  disabled={rejectMutation.isPending}
                >
                  {rejectMutation.isPending ? 'Rechazando...' : 'Rechazar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(rejection)}
        onClose={() => {
          if (!rejectMutation.isPending) {
            setRejection(null);
            setRejectionNotes('');
          }
        }}
        title="Solicitar corrección"
      >
        <form
          className="modal-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!rejection || !rejectionNotes.trim()) return;
            rejectMutation.mutate({ id: rejection.id, decisionNotes: rejectionNotes.trim() });
          }}
        >
          <p className="page-subtitle">
            Explica claramente el cambio requerido en <strong>{rejection?.title}</strong>. El equipo conservará este comentario en el historial de la pieza.
          </p>
          <label>
            Cambios solicitados
            <textarea
              className="input"
              rows={6}
              value={rejectionNotes}
              onChange={(event) => setRejectionNotes(event.target.value)}
              placeholder="Ejemplo: cambiar el titular, mantener la fotografia y ajustar la fecha..."
              autoFocus
              required
            />
          </label>
          {rejectMutation.error && <div className="alert alert-error">No se pudo enviar la solicitud. Intenta nuevamente.</div>}
          <button className="btn btn-primary btn-block" type="submit" disabled={rejectMutation.isPending || !rejectionNotes.trim()}>
            {rejectMutation.isPending ? 'Enviando solicitud...' : 'Enviar a correccion'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
