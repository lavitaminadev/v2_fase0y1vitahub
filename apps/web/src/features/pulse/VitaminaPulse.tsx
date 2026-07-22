import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../core/api';
import type { CSSProperties } from 'react';

interface PulseDimension { key: string; label: string; score: number | null; weight: number; evidence: string; status: string }
interface PulseAction { id: string; title: string; detail: string; priority: string; owner: 'team' | 'client'; route: string }
interface ImpactItem { type: string; title: string; detail: string; happenedAt: string }
interface PulseData {
  score: number | null;
  coverage: number;
  status: string;
  stage: string;
  generatedAt: string;
  dimensions: PulseDimension[];
  actions: PulseAction[];
  commitments: { team: number; client: number };
  impact: ImpactItem[];
}

type PulseResponse = Partial<PulseData>;

const STAGES: Record<string, { label: string; detail: string }> = {
  activation: { label: 'Activación', detail: 'Ordenando activos, estrategia y forma de trabajo.' },
  building: { label: 'Construcción', detail: 'Desarrollando consistencia y ritmo de producción.' },
  traction: { label: 'Tracción', detail: 'La actividad ya genera señales medibles.' },
  optimization: { label: 'Optimización', detail: 'Convirtiendo evidencia en mejores decisiones.' },
  scaling: { label: 'Escalamiento', detail: 'Expandiendo lo que ya demuestra resultados.' },
  recovery: { label: 'Recuperación', detail: 'Resolviendo bloqueos antes de acelerar.' },
};

export function VitaminaPulse({ compact = false }: { compact?: boolean }) {
  const { data: response, isLoading, error } = useQuery<PulseResponse>({ queryKey: ['vitamina-pulse'], queryFn: () => api.get('/reporting/pulse') });
  if (isLoading) return <section className="pulse-shell pulse-loading" aria-label="Cargando Pulso Vitamina"><div className="skeleton-line wide" /><div className="skeleton-line" /><div className="skeleton-line short" /></section>;
  if (error || !response) return <section className="pulse-shell"><span className="page-eyebrow">PULSO VITAMINA</span><h2>Pulso temporalmente no disponible</h2><p className="page-subtitle">La operación continúa funcionando. Intenta actualizar esta lectura en unos minutos.</p></section>;
  const data: PulseData = {
    score: typeof response.score === 'number' && Number.isFinite(response.score) ? Math.min(100, Math.max(0, response.score)) : null,
    coverage: typeof response.coverage === 'number' && Number.isFinite(response.coverage) ? Math.min(100, Math.max(0, response.coverage)) : 0,
    status: ['healthy', 'attention', 'blocked', 'no_data'].includes(response.status ?? '') ? response.status! : 'no_data',
    stage: typeof response.stage === 'string' ? response.stage : 'activation',
    generatedAt: response.generatedAt && !Number.isNaN(Date.parse(response.generatedAt)) ? response.generatedAt : new Date().toISOString(),
    dimensions: Array.isArray(response.dimensions) ? response.dimensions : [],
    actions: Array.isArray(response.actions) ? response.actions.filter((action) => action?.id && action?.title && action.route?.startsWith('/')) : [],
    commitments: {
      team: Number.isFinite(response.commitments?.team) ? Number(response.commitments?.team) : 0,
      client: Number.isFinite(response.commitments?.client) ? Number(response.commitments?.client) : 0,
    },
    impact: Array.isArray(response.impact) ? response.impact : [],
  };
  const stage = STAGES[data.stage] ?? STAGES.activation;
  const statusLabel = data.status === 'healthy' ? 'Saludable' : data.status === 'attention' ? 'Requiere atención' : data.status === 'blocked' ? 'Con bloqueos' : 'Sin evidencia';

  return <section className={`pulse-shell ${compact ? 'is-compact' : ''}`}>
    <header className="pulse-header"><div><span className="page-eyebrow">METODOLOGÍA PROPIA · PULSO VITAMINA</span><h2>El pulso de {compact ? 'tu marca' : 'la operación'}</h2><p>Una lectura trazable de lo que avanza, lo que está bloqueado y la próxima mejor acción.</p></div><span className={`pulse-status is-${data.status}`}>{statusLabel}</span></header>
    <div className="pulse-overview">
      <div className="pulse-score-wrap"><div className="pulse-score" style={{ '--pulse': `${data.score ?? 0}%` } as CSSProperties}><div><strong>{data.score ?? '—'}</strong><span>/ 100</span></div></div><small>{data.coverage}% de cobertura de datos</small></div>
      <div className="pulse-stage"><span>Momento actual</span><strong>{stage.label}</strong><p>{stage.detail}</p><div className="stage-track"><i style={{ width: `${Math.max(['activation','building','traction','optimization','scaling'].indexOf(data.stage) + 1, 1) * 20}%` }} /></div></div>
      <div className="commitment-card"><span>Compromisos abiertos</span><div><strong>{data.commitments.team}</strong><small>La Vitamina</small></div><div><strong>{data.commitments.client}</strong><small>Cliente</small></div></div>
    </div>
    <div className="pulse-dimensions">{data.dimensions.map((dimension) => <article key={dimension.key} className={`pulse-dimension is-${dimension.status}`}><div><span>{dimension.label}</span><strong>{dimension.score ?? 'S/E'}</strong></div><div className="dimension-track"><i style={{ width: `${dimension.score ?? 0}%` }} /></div><small>{dimension.evidence}</small><em>Peso {dimension.weight}%</em></article>)}</div>
    <div className="pulse-lower">
      <div className="next-actions"><div className="pulse-subhead"><div><span className="page-eyebrow">PRÓXIMA MEJOR ACCIÓN</span><h3>Qué hacemos ahora</h3></div><small>Ordenado por impacto operativo</small></div>{data.actions.map((action) => <Link to={action.route} className="pulse-action" key={action.id}><span className={`priority-dot is-${action.priority}`} /><div><strong>{action.title}</strong><small>{action.detail}</small></div><em>{action.owner === 'client' ? 'Cliente' : 'Equipo'} →</em></Link>)}</div>
      {!compact && <div className="impact-log"><div className="pulse-subhead"><div><span className="page-eyebrow">BITÁCORA DE IMPACTO</span><h3>Trabajo que deja huella</h3></div></div>{data.impact.length ? data.impact.slice(0, 6).map((item, index) => <div className="impact-item" key={`${item.type}-${item.happenedAt}-${index}`}><span className={`impact-marker is-${item.type}`} /><div><strong>{item.title}</strong><small>{item.detail} · {new Date(item.happenedAt).toLocaleDateString('es-CL')}</small></div></div>) : <p className="pulse-empty">Los hitos aparecerán cuando existan entregas, reuniones o decisiones registradas.</p>}</div>}
    </div>
    <footer className="pulse-footnote">Calculado con evidencia operativa disponible al {new Date(data.generatedAt).toLocaleString('es-CL')}. Las dimensiones sin evidencia no afectan el puntaje.</footer>
  </section>;
}
