import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { StatusBadge } from '../../shared/StatusBadge';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { EmptyState } from '../../shared/EmptyState';
import { QueryErrorState } from '../../shared/QueryErrorState';

interface ApprovalVersion { id: string; number: number; fileName: string; url?: string; state?: string; createdAt: string; namingValid?: boolean }
interface ApprovalDecision { id: string; status: string; notes?: string; requestedAt: string; decidedAt?: string; requestedBy: string }
interface ApprovalItem {
  id: string; pieceTitle: string; clientName: string; requestedBy: string; status: string; createdAt: string;
  description?: string; decisionNotes?: string; dueAt?: string; versionUrl?: string;
  versions: ApprovalVersion[]; decisionHistory: ApprovalDecision[];
}

function previewUrl(url?: string): string | undefined {
  return url?.includes('drive.google.com') ? url.replace(/\/view.*$/, '/preview') : url;
}

export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'history'>('pending');
  const [selected, setSelected] = useState<ApprovalItem | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const { data: approvals = [], isLoading, error, refetch, isFetching } = useQuery<ApprovalItem[]>({ queryKey: ['approvals'], queryFn: () => api.get('/approvals') });

  const decideMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: 'approved' | 'rejected'; notes?: string }) => api.put(`/approvals/${id}`, { status, decisionNotes: notes || undefined }),
    onSuccess: async (_result, variables) => {
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['approvals'] }), queryClient.invalidateQueries({ queryKey: ['pieces'] })]);
      setSelected(null); setDecisionNotes('');
      setFeedback({ tone: 'success', text: variables.status === 'approved' ? 'Pieza aprobada con evidencia e historial registrados.' : 'La pieza volvió a corrección con indicaciones trazables.' });
    },
    onError: (mutationError: Error) => setFeedback({ tone: 'error', text: mutationError.message }),
  });

  if (isLoading) return <LoadingSpinner text="Cargando aprobaciones..." />;
  if (error) return <QueryErrorState title="No pudimos cargar las aprobaciones" message={error.message} onRetry={() => void refetch()} retrying={isFetching} />;
  const pending = approvals.filter((approval) => ['pending', 'viewed'].includes(approval.status));
  const resolved = approvals.filter((approval) => !['pending', 'viewed'].includes(approval.status));
  const visible = tab === 'pending' ? pending : resolved;

  return <div className="page approvals-workspace">
    <div className="page-header"><div><span className="page-eyebrow">DECISIONES CON EVIDENCIA</span><h1>Aprobaciones visuales</h1><p className="page-subtitle">Compara versiones, revisa instrucciones e historial y decide desde un panel lateral sin perder contexto.</p></div><div className="approval-tabs"><button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>Pendientes <span>{pending.length}</span></button><button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>Historial <span>{resolved.length}</span></button></div></div>
    {feedback && <div className={`alert alert-${feedback.tone}`} role="status">{feedback.text}</div>}
    {visible.length === 0 ? <EmptyState icon="OK" title={tab === 'pending' ? 'Nada pendiente' : 'Sin decisiones anteriores'} description={tab === 'pending' ? 'Todas las aprobaciones activas ya fueron resueltas.' : 'El historial aparecerá cuando se apruebe o rechace una pieza.'} /> : <div className="approval-grid approval-grid-visual">{visible.map((approval) => { const latest = approval.versions[0]; const overdue = approval.dueAt && new Date(approval.dueAt) < new Date() && ['pending', 'viewed'].includes(approval.status); return <article className={`approval-card ${overdue ? 'is-overdue' : ''}`} key={approval.id}><button className="approval-preview" onClick={() => { setSelected(approval); setDecisionNotes(''); }} aria-label={`Revisar ${approval.pieceTitle}`}>{latest?.url ? <iframe title={`Vista de ${approval.pieceTitle}`} src={previewUrl(latest.url)} loading="lazy" tabIndex={-1} /> : <span>{approval.pieceTitle.slice(0, 2).toUpperCase()}</span>}<small>{latest ? `Versión ${latest.number}` : 'Sin archivo'}</small></button><div className="approval-body"><div className="approval-head"><div><span className="page-eyebrow">{approval.clientName}</span><h3>{approval.pieceTitle}</h3></div><StatusBadge status={approval.status} /></div><p>{approval.description || 'Sin instrucciones adicionales.'}</p><div className="approval-meta"><span>{approval.versions.length} versión(es)</span><span>{approval.decisionHistory.length} evento(s)</span><span>{overdue ? 'Decisión vencida' : new Date(approval.createdAt).toLocaleDateString('es-CL')}</span></div><button className="btn btn-primary btn-sm" onClick={() => { setSelected(approval); setDecisionNotes(''); }}>{tab === 'pending' ? 'Revisar y decidir' : 'Abrir evidencia'}</button></div></article>; })}</div>}

    {selected && <div className="approval-review-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><aside className="approval-review-drawer" role="dialog" aria-modal="true" aria-label={`Revisión de ${selected.pieceTitle}`}><header><div><span className="page-eyebrow">{selected.clientName}</span><h2>{selected.pieceTitle}</h2><p>{selected.description || 'Sin instrucciones adicionales.'}</p></div><button aria-label="Cerrar revisión" onClick={() => setSelected(null)}>×</button></header><div className="approval-review-scroll">
      <section className="version-comparison"><div className="approval-section-title"><div><span className="page-eyebrow">COMPARACIÓN</span><h3>{selected.versions.length > 1 ? 'Versión anterior y actual' : 'Evidencia actual'}</h3></div><span>{selected.versions.length} archivo(s)</span></div><div>{selected.versions.slice(0, 2).reverse().map((version, index, array) => <article key={version.id}><header><strong>{array.length > 1 && index === 0 ? 'Anterior' : 'Actual'} · V{version.number}</strong><span>{new Date(version.createdAt).toLocaleString('es-CL')}</span></header>{version.url ? <iframe title={version.fileName} src={previewUrl(version.url)} loading="lazy" /> : <div className="approval-no-preview">Vista previa no disponible</div>}<footer><span>{version.fileName}</span>{version.url && <a href={version.url} target="_blank" rel="noreferrer">Abrir original</a>}</footer></article>)}</div></section>
      <section className="approval-history"><div className="approval-section-title"><div><span className="page-eyebrow">TRAZABILIDAD</span><h3>Comentarios e historial</h3></div></div><div>{selected.decisionHistory.map((decision) => <article key={decision.id}><i className={`is-${decision.status}`} /><div><strong>{decision.status === 'approved' ? 'Aprobada' : decision.status === 'rejected' ? 'Corrección solicitada' : 'Revisión solicitada'}</strong><p>{decision.notes || 'Sin comentario registrado.'}</p><small>{decision.requestedBy} · {new Date(decision.decidedAt || decision.requestedAt).toLocaleString('es-CL')}</small></div></article>)}</div></section>
    </div>{['pending', 'viewed'].includes(selected.status) && <footer className="approval-decision-panel"><label>Comentario de decisión<textarea className="input" rows={3} value={decisionNotes} onChange={(event) => setDecisionNotes(event.target.value)} placeholder="Opcional al aprobar; obligatorio para solicitar corrección" /></label>{decideMutation.error && <div className="alert alert-error">{decideMutation.error.message}</div>}<div><button className="btn btn-outline btn-danger" disabled={!decisionNotes.trim() || decideMutation.isPending} onClick={() => decideMutation.mutate({ id: selected.id, status: 'rejected', notes: decisionNotes.trim() })}>Solicitar corrección</button><button className="btn btn-primary" disabled={decideMutation.isPending} onClick={() => decideMutation.mutate({ id: selected.id, status: 'approved', notes: decisionNotes.trim() })}>{decideMutation.isPending ? 'Registrando...' : 'Aprobar versión'}</button></div></footer>}</aside></div>}
  </div>;
}
