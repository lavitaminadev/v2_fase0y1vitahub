import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { EmptyState } from '../../shared/EmptyState';
import { Modal } from '../../shared/Modal';
import { useAuth } from '../../core/auth';

interface RankingEntry {
  id: string;
  userId: string;
  user?: { name?: string };
  totalXp: number;
  tier?: string;
}
interface XpDispute { id: string; xpPeriodId: string; userId: string; user?: { name: string }; status: string; message: string; resolution?: string; adjustmentPoints: number; createdAt: string }

const tierLabel: Record<string, string> = { bronze: 'Bronce', silver: 'Plata', gold: 'Oro', platinum: 'Platino', diamond: 'Diamante' };

export function GamificationPage() {
  const qc = useQueryClient();
  const user = useAuth((state) => state.user);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [resolving, setResolving] = useState<XpDispute | null>(null);
  const [resolution, setResolution] = useState('');
  const [adjustment, setAdjustment] = useState('0');
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const rankingQuery = useQuery<RankingEntry[]>({ queryKey: ['gamification-ranking'], queryFn: () => api.get('/gamification/ranking') });
  const disputesQuery = useQuery<XpDispute[]>({ queryKey: ['xp-disputes'], queryFn: () => api.get('/gamification/disputes') });
  const createReview = useMutation({ mutationFn: (xpPeriodId: string) => api.post('/gamification/disputes', { xpPeriodId, message }), onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['xp-disputes'] }); setReviewOpen(false); setMessage(''); setFeedback({ tone: 'success', text: 'Solicitud enviada a dirección. El ajuste, si corresponde, quedará auditado.' }); }, onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }) });
  const resolveReview = useMutation({ mutationFn: ({ status }: { status: 'accepted' | 'rejected' }) => api.put(`/gamification/disputes/${resolving!.id}/resolve`, { status, resolution, adjustmentPoints: status === 'accepted' ? Number(adjustment) : 0 }), onSuccess: async (_, variables) => { await Promise.all([qc.invalidateQueries({ queryKey: ['xp-disputes'] }), qc.invalidateQueries({ queryKey: ['gamification-ranking'] })]); setResolving(null); setResolution(''); setAdjustment('0'); setFeedback({ tone: 'success', text: variables.status === 'accepted' ? 'Revisión aceptada y ranking recalculado.' : 'Revisión resuelta sin ajuste.' }); }, onError: (error: Error) => setFeedback({ tone: 'error', text: error.message }) });
  if (rankingQuery.isLoading) return <LoadingSpinner text="Calculando ranking semanal..." />;
  if (rankingQuery.error) return <div className="page"><div className="page-load-error"><span>!</span><h1>No pudimos cargar el ranking</h1><p>{rankingQuery.error.message}</p><button className="btn btn-primary" onClick={() => rankingQuery.refetch()}>Reintentar</button></div></div>;
  const users = Array.isArray(rankingQuery.data) ? rankingQuery.data : [];
  const leaders = users.slice(0, 3);
  const totalXp = users.reduce((sum, user) => sum + Number(user.totalXp || 0), 0);
  const topXp = users[0]?.totalXp || 0;
  const ownPeriod = users.find((entry) => entry.userId === user?.id);
  const canResolve = ['admin', 'art_director', 'av_director', 'operations_director'].includes(user?.role ?? '');
  const disputes = disputesQuery.data ?? [];

  return <div className="page gamification-page">
    <section className="team-hero"><div><span className="page-eyebrow">RITMO DEL EQUIPO</span><h1>Ranking semanal</h1><p>Reconoce entregas a tiempo y consistencia operativa. Los XP acompañan el desempeño; no reemplazan la evaluación humana.</p><button className="btn btn-outline team-review-button" disabled={!ownPeriod} onClick={() => { setFeedback(null); setReviewOpen(true); }}>Solicitar revisión de mis XP</button></div><div className="team-hero-metrics"><span><small>Participantes</small><strong>{users.length}</strong></span><span><small>XP de la semana</small><strong>{totalXp}</strong></span></div></section>
    {feedback && <div className={`alert alert-${feedback.tone}`}>{feedback.text}</div>}
    {!users.length ? <EmptyState icon="XP" title="La semana todavía no tiene movimientos" description="Los puntos aparecerán automáticamente cuando se registren entregas o ajustes autorizados." /> : <>
      <section className={`podium-grid podium-${leaders.length}`}>{leaders.map((user, index) => <article className={`podium-card place-${index + 1}`} key={user.id}><span className="podium-position">{String(index + 1).padStart(2, '0')}</span><div className="podium-avatar">{(user.user?.name || 'E').slice(0, 2).toUpperCase()}</div><h2>{user.user?.name || 'Integrante del equipo'}</h2><strong>{user.totalXp} <small>XP</small></strong><i className={`tier tier-${user.tier || 'bronze'}`}>{tierLabel[user.tier || 'bronze'] || user.tier}</i>{index > 0 && <p>{topXp - user.totalXp} XP para alcanzar el primer lugar</p>}</article>)}</section>
      {users.length > 3 && <section className="ranking-panel"><header><div><span className="page-eyebrow">CLASIFICACIÓN COMPLETA</span><h2>Más posiciones</h2></div><small>Semana iniciada el lunes</small></header><div className="ranking-list">{users.slice(3).map((user, index) => <article key={user.id}><b>{String(index + 4).padStart(2, '0')}</b><span><strong>{user.user?.name || 'Integrante del equipo'}</strong><small>{tierLabel[user.tier || 'bronze'] || user.tier}</small></span><em>{user.totalXp} XP</em><i><span style={{ width: `${topXp ? user.totalXp * 100 / topXp : 0}%` }} /></i></article>)}</div></section>}
      <p className="data-note gamification-note">El período opera de lunes 09:00 a viernes 18:00. Una semana sin errores atribuibles suma 15 XP al cierre.</p>
    </>}
    {(canResolve || disputes.length > 0) && <section className="xp-review-panel"><header><div><span className="page-eyebrow">REVISIÓN HUMANA</span><h2>Solicitudes de revisión</h2></div><span>{disputes.filter((item) => item.status === 'pending').length} pendientes</span></header>{disputes.length ? <div className="xp-review-list">{disputes.map((item) => <article key={item.id}><div><span>{item.status === 'pending' ? 'Pendiente' : item.status === 'accepted' ? 'Aceptada' : 'Rechazada'}</span><h3>{item.user?.name ?? 'Mi solicitud'}</h3><p>{item.message}</p>{item.resolution && <small>Resolución: {item.resolution}{item.adjustmentPoints ? ` · ${item.adjustmentPoints > 0 ? '+' : ''}${item.adjustmentPoints} XP` : ''}</small>}</div>{canResolve && item.status === 'pending' && <button className="btn btn-sm btn-outline" onClick={() => { setResolving(item); setResolution(''); setAdjustment('0'); }}>Resolver</button>}</article>)}</div> : <div className="panel-empty"><strong>Sin revisiones pendientes</strong><span>El equipo puede pedir revisión cuando detecte una diferencia en su puntaje.</span></div>}</section>}
    <Modal open={reviewOpen} onClose={() => setReviewOpen(false)} title="Solicitar revisión de XP"><form className="modal-form" onSubmit={(event) => { event.preventDefault(); if (ownPeriod) createReview.mutate(ownPeriod.id); }}><p className="form-context">Describe el evento, entrega o corrección que debería revisarse. Dirección responderá aquí y todo ajuste quedará en auditoría.</p><label>Motivo<textarea className="input" required minLength={10} rows={5} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Indica pieza, fecha y diferencia observada..." /></label><button className="btn btn-primary btn-block" disabled={createReview.isPending || !ownPeriod}>{createReview.isPending ? 'Enviando...' : 'Enviar a revisión'}</button></form></Modal>
    <Modal open={Boolean(resolving)} onClose={() => setResolving(null)} title="Resolver revisión XP"><form className="modal-form" onSubmit={(event) => { event.preventDefault(); resolveReview.mutate({ status: 'accepted' }); }}><p className="form-context">{resolving?.message}</p><label>Resolución<textarea className="input" required minLength={3} rows={4} value={resolution} onChange={(event) => setResolution(event.target.value)} /></label><label>Ajuste XP<input className="input" type="number" min="-500" max="500" required value={adjustment} onChange={(event) => setAdjustment(event.target.value)} /><small className="field-help">Usa 0 si se acepta la explicación pero no cambia el puntaje.</small></label><div className="modal-actions"><button type="button" className="btn btn-outline" disabled={resolveReview.isPending || resolution.trim().length < 3} onClick={() => resolveReview.mutate({ status: 'rejected' })}>Rechazar</button><button className="btn btn-primary" disabled={resolveReview.isPending}>Aceptar y aplicar</button></div></form></Modal>
  </div>;
}
