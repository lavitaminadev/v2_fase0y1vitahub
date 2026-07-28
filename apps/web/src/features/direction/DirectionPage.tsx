import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { PageHero } from '../../shared/PageHero';
import { QueryErrorState } from '../../shared/QueryErrorState';

interface KpiData {
  revenueYtd: number; revenueTarget: number | null; activeClients: number; clientTarget: number | null;
  udSold: number; udTarget: number | null; teamUtilization: number | null; utilizationTarget: number | null;
  clientRetention: number; nps: number | null; growthRate: number | null;
}

const money = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value || 0);

export function DirectionPage() {
  const directionQuery = useQuery<KpiData>({ queryKey: ['direction'], queryFn: () => api.get('/reporting/kpi') });
  if (directionQuery.isLoading) return <LoadingSpinner text="Consolidando indicadores estratégicos..." />;
  if (directionQuery.error) return <QueryErrorState title="No pudimos cargar Dirección" message={directionQuery.error.message} onRetry={() => directionQuery.refetch()} />;
  if (!directionQuery.data) return null;

  const data = directionQuery.data;
  const metrics = [
    { title: 'Ingresos del año', value: money(data.revenueYtd), detail: 'Facturas registradas como pagadas', target: data.revenueTarget, targetText: data.revenueTarget == null ? null : money(data.revenueTarget), current: data.revenueYtd, source: 'Facturación', tone: 'green' },
    { title: 'Clientes activos', value: String(data.activeClients), detail: 'Cuentas activas en la organización', target: data.clientTarget, targetText: data.clientTarget == null ? null : String(data.clientTarget), current: data.activeClients, source: 'Clientes', tone: 'lime' },
    { title: 'UD contratadas', value: `${data.udSold} UD`, detail: 'Capacidad total abierta en presupuestos', target: data.udTarget, targetText: data.udTarget == null ? null : `${data.udTarget} UD`, current: data.udSold, source: 'Presupuesto UD', tone: 'sand' },
    { title: 'Cobertura de entregas', value: `${data.clientRetention}%`, detail: 'Clientes con al menos una pieza entregada', target: null, targetText: null, current: data.clientRetention, source: 'Producción', tone: 'terracotta' },
  ];
  const pending = [
    { title: 'Utilización del equipo', value: data.teamUtilization == null ? 'Sin fuente' : `${data.teamUtilization}%`, detail: 'Requiere capacidad horaria y carga por persona.' },
    { title: 'NPS de clientes', value: data.nps == null ? 'Sin fuente' : String(data.nps), detail: 'Requiere una encuesta NPS validada y asociada a cliente.' },
    { title: 'Crecimiento', value: data.growthRate == null ? 'Sin fuente' : `${data.growthRate}%`, detail: 'Requiere una base comparable del período anterior.' },
  ];

  return <div className="page direction-page">
    <PageHero
      variant="feature"
      eyebrow="DIRECCIÓN GENERAL"
      title="Radar estratégico"
      subtitle="Lectura estratégica del negocio."
      aside={<div className="direction-confidence"><strong>4</strong><span>indicadores<br />verificados</span><small>Datos trazables en VITAHUB</small></div>}
    />
    <div className="direction-source-note"><span>i</span><p><strong>La métrica fue corregida.</strong> Mide cobertura de entregas, no permanencia.</p></div>
    <section className="strategic-grid">{metrics.map((metric) => { const progress = metric.target ? Math.min(100, Math.round(metric.current * 100 / metric.target)) : null; return <article className={`strategic-card ${metric.tone}`} key={metric.title}><header><span>{metric.source}</span><i>Dato real</i></header><h2>{metric.title}</h2><strong>{metric.value}</strong><p>{metric.detail}</p>{progress == null ? <div className="metric-verified"><b>✓</b> Fuente operativa conectada</div> : <div className="target-progress"><span><i style={{ width: `${progress}%` }} /></span><small>{progress}% de meta {metric.targetText}</small></div>}</article>; })}</section>
    <section className="measurement-backlog"><header><div><span className="page-eyebrow">INSTRUMENTACIÓN PENDIENTE</span><h2>No inventamos lo que aún no se mide</h2></div><Link className="btn btn-outline" to="/settings">Revisar configuración</Link></header><div>{pending.map((item) => <article key={item.title}><span>Fuente pendiente</span><h3>{item.title}</h3><strong>{item.value}</strong><p>{item.detail}</p></article>)}</div></section>
  </div>;
}
