import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../../core/api';
import { Card } from '../../shared/Card';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { Link } from 'react-router-dom';
import { VitaminaPulse } from '../pulse/VitaminaPulse';
import { statusLabel } from '../../shared/status-labels';
import { useAuth } from '../../core/auth';
import { QueryErrorState } from '../../shared/QueryErrorState';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface DashboardData {
  activeClients: number;
  pendingPieces: number;
  teamXp: number;
  monthUd: number;
  ud?: { contracted: number; consumed: number; reserved: number };
  pieces?: { status: string; count: number }[];
}
interface PerformanceData {
  hasData: boolean;
  totals: { spend: number; impressions: number; reach: number; clicks: number; leads: number; conversions: number };
  derived: { cpc: number | null; cpl: number | null; ctr: number | null; conversionRate: number | null };
  providers: Array<{ provider: string; spend: number; leads: number; conversions: number; lastDataAt?: string }>;
}
const PROVIDER_LABELS: Record<string, string> = { meta: 'Meta Ads', google_ads: 'Google Ads', google_analytics: 'Google Analytics' };
type DashboardWidget = 'attention' | 'pulse' | 'kpis' | 'performance' | 'flow' | 'ud' | 'pieces';
const WIDGET_LABELS: Record<DashboardWidget, string> = { attention: 'Atencion del dia', pulse: 'Pulso La Vitamina', kpis: 'Indicadores principales', performance: 'Meta y Google', flow: 'Ciclo Maestro', ud: 'Unidades de dedicacion', pieces: 'Estado de piezas' };
const ROLE_PRESETS: Record<string, DashboardWidget[]> = {
  admin: ['attention', 'pulse', 'kpis', 'performance', 'flow', 'ud', 'pieces'],
  operations_director: ['attention', 'pulse', 'kpis', 'flow', 'ud', 'pieces'],
  commercial_director: ['attention', 'pulse', 'kpis', 'performance', 'flow'],
  community_manager: ['attention', 'pulse', 'kpis', 'performance', 'flow', 'pieces'],
  creative_director: ['attention', 'pulse', 'kpis', 'flow', 'ud', 'pieces'],
  art_director: ['attention', 'kpis', 'flow', 'ud', 'pieces'],
  av_director: ['attention', 'kpis', 'flow', 'pieces'],
  designer: ['attention', 'kpis', 'pieces'],
  audiovisual: ['attention', 'kpis', 'pieces'],
};
const PIECE_COLORS: Record<string, string> = {
  backlog: '#95a5a6', assigned: '#3498db', in_progress: '#f39c12', internal_review: '#9b59b6',
  client_validation: '#e67e22', corrections: '#e74c3c', approved: '#2ecc71', delivered: '#27ae60',
};
const CHART_COLORS = ['#173f35', '#bd4527', '#d7eb79', '#3498db', '#f39c12', '#9b59b6', '#e67e22', '#27ae60'];

export function DashboardPage() {
  const { user } = useAuth();
  const personalView = ['designer', 'audiovisual'].includes(user?.role ?? '');
  const canViewPerformance = !personalView;
  const role = user?.role || 'admin';
  const dashboardKey = `vitahub:dashboard:${role}`;
  const rolePreset = ROLE_PRESETS[role] || ROLE_PRESETS.admin;
  const [configureOpen, setConfigureOpen] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState<DashboardWidget[]>(() => {
    try { const stored = window.localStorage.getItem(dashboardKey); return stored ? JSON.parse(stored) as DashboardWidget[] : rolePreset; } catch { return rolePreset; }
  });
  const setWidgets = (widgets: DashboardWidget[]) => { setVisibleWidgets(widgets); try { window.localStorage.setItem(dashboardKey, JSON.stringify(widgets)); } catch {} };
  const widgetVisible = (widget: DashboardWidget) => visibleWidgets.includes(widget);
  const availableWidgets = (Object.keys(WIDGET_LABELS) as DashboardWidget[]).filter((widget) => canViewPerformance || widget !== 'performance');
  const { data, isLoading, error, refetch, isFetching } = useQuery<DashboardData>({ queryKey: ['dashboard'], queryFn: () => api.get('/reporting/dashboard') });
  const { data: performance } = useQuery<PerformanceData>({ queryKey: ['performance'], queryFn: () => api.get('/reporting/performance'), enabled: canViewPerformance });
  if (isLoading) return <LoadingSpinner text="Cargando dashboard..." />;
  if (error) return <QueryErrorState title="No pudimos cargar tu dashboard" message={error.message} onRetry={() => void refetch()} retrying={isFetching} />;
  if (!data) return <div className="alert alert-info">No hay datos disponibles</div>;

  return (
    <div className="page">
      <div className="page-header hero-header"><div><span className="page-eyebrow">CENTRO DE CONTROL</span><h1>Dashboard</h1><p className="page-subtitle">Visión general de la operación.</p></div><div className="dashboard-header-actions"><span className="date-chip">{new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</span><button className="btn btn-outline btn-sm" onClick={() => setConfigureOpen(true)}>Configurar widgets</button></div></div>

      {widgetVisible('attention') && <div className="attention-strip"><div><span className="attention-kicker">Atencion de hoy</span><strong>{data.pendingPieces ?? 0} piezas esperan movimiento</strong><small>Revisa bloqueos y mantene el ciclo de entrega avanzando.</small></div><Link className="btn btn-primary btn-sm" to="/production">Ir a produccion</Link></div>}

      {!personalView && widgetVisible('pulse') && <VitaminaPulse />}

      {widgetVisible('kpis') && <div className="card-grid">
        {!personalView && <Card title="Clientes Activos" value={data.activeClients ?? 0} icon="👥" color="#1a1a2e" />}
        <Card title="Piezas Pendientes" value={data.pendingPieces ?? 0} icon="⏳" color="#f39c12" />
        <Card title="XP del Equipo" value={data.teamXp ?? 0} icon="⭐" color="#9b59b6" />
        {!personalView && <Card title="UD este Mes" value={data.monthUd ?? 0} icon="📊" color="#27ae60" />}
      </div>}

      {canViewPerformance && widgetVisible('performance') && <div className="section performance-section">
        <div className="section-title-row"><div><h2>Rendimiento digital</h2><p className="page-subtitle">Métricas de Meta y Google.</p></div><span className={`data-health ${performance?.hasData ? 'is-live' : ''}`}>{performance?.hasData ? 'Datos conectados' : 'Sin datos sincronizados'}</span></div>
        {performance?.hasData ? <div className="dashboard-charts-row">
          <div className="dashboard-chart-card"><h3>Inversion por plataforma</h3>
            <ResponsiveContainer width="100%" height={200}><BarChart data={performance.providers.map((p) => ({ name: PROVIDER_LABELS[p.provider] ?? p.provider, spend: p.spend, leads: p.leads }))}><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis dataKey="name" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip formatter={(v: number) => `$${v.toLocaleString('es-CL')}`} /><Bar dataKey="spend" fill="#173f35" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
          </div>
          <div className="dashboard-chart-card"><h3>Metricas de conversion</h3>
            <div className="metric-grid">
              <div><span>CTR</span><strong>{performance.derived.ctr == null ? '—' : `${performance.derived.ctr.toFixed(1)}%`}</strong></div>
              <div><span>CPC</span><strong>{performance.derived.cpc == null ? '—' : `$${Math.round(performance.derived.cpc).toLocaleString('es-CL')}`}</strong></div>
              <div><span>CPL</span><strong>{performance.derived.cpl == null ? '—' : `$${Math.round(performance.derived.cpl).toLocaleString('es-CL')}`}</strong></div>
              <div><span>Conv. Rate</span><strong>{performance.derived.conversionRate == null ? '—' : `${performance.derived.conversionRate.toFixed(1)}%`}</strong></div>
            </div>
          </div>
        </div> : <div className="empty-insight"><strong>Conecta y asigna cuentas publicitarias</strong><span>El dashboard mostrara metricas cuando exista una sincronizacion valida.</span></div>}
      </div>}

      {widgetVisible('flow') && <div className="section master-flow-section">
        <div className="section-title-row"><div><h2>Ciclo Maestro</h2><p className="page-subtitle">Flujo de venta a resultado.</p></div></div>
        <div className="master-flow" aria-label="Flujo operativo principal">
          {['01 Lead', '02 Cierre', '03 Onboarding', '04 Planificacion', '05 Produccion', '06 Cliente', '07 Resultados'].map((label, i) => <div className="master-flow-step" key={i}><span className="flow-number">{label.split(' ')[0]}</span><div><strong>{label.split(' ').slice(1).join(' ')}</strong></div>{i < 6 && <span className="flow-line" />}</div>)}
        </div>
      </div>}

      {!personalView && widgetVisible('ud') && data.ud && <div className="section">
        <h2>Unidades de Dedicacion</h2>
        <div className="dashboard-charts-row">
          <div className="dashboard-chart-card"><h3>Consumo UD</h3>
            <ResponsiveContainer width="100%" height={200}><BarChart data={[{ name: 'Contratadas', value: data.ud.contracted, fill: '#e67e22' }, { name: 'Consumidas', value: data.ud.consumed, fill: '#27ae60' }, { name: 'Reservadas', value: data.ud.reserved, fill: '#3498db' }]} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#eee" /><XAxis type="number" tick={{ fontSize: 11 }} /><YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="value" radius={[0, 4, 4, 0]}><Cell fill="#e67e22" /><Cell fill="#27ae60" /><Cell fill="#3498db" /></Bar></BarChart></ResponsiveContainer>
          </div>
          <div className="dashboard-chart-card"><h3>% Consumo</h3>
            <ResponsiveContainer width="100%" height={200}><PieChart><Pie data={[{ name: 'Consumido', value: data.ud.consumed }, { name: 'Disponible', value: Math.max(0, data.ud.contracted - data.ud.consumed) }]} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}><Cell fill="#27ae60" /><Cell fill="#e8ece8" /></Pie><Tooltip /></PieChart></ResponsiveContainer>
          </div>
        </div>
      </div>}

      {widgetVisible('pieces') && data.pieces && data.pieces.length > 0 && <div className="section">
        <h2>Estado de Piezas</h2>
        <div className="dashboard-charts-row">
          <div className="dashboard-chart-card"><h3>Distribucion por estado</h3>
            <ResponsiveContainer width="100%" height={250}><PieChart><Pie data={data.pieces.map((p) => ({ name: statusLabel(p.status), value: p.count, color: PIECE_COLORS[p.status] || '#8e44ad' }))} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, value }: any) => `${name}: ${value}`}>{data.pieces.map((p, i) => <Cell key={p.status} fill={PIECE_COLORS[p.status] || CHART_COLORS[i % CHART_COLORS.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
          </div>
          <div className="dashboard-chart-card"><h3>Rendimiento por tipo</h3>
            <ResponsiveContainer width="100%" height={250}><RadarChart data={data.pieces.map((p) => ({ status: statusLabel(p.status), count: p.count, fullMark: Math.max(...data.pieces!.map((x) => x.count)) }))}><PolarGrid /><PolarAngleAxis dataKey="status" tick={{ fontSize: 10 }} /><PolarRadiusAxis tick={{ fontSize: 10 }} /><Radar dataKey="count" stroke="#173f35" fill="#173f35" fillOpacity={0.2} /></RadarChart></ResponsiveContainer>
          </div>
        </div>
      </div>}

      {configureOpen && <div className="dashboard-config-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfigureOpen(false); }}><aside className="dashboard-config" role="dialog" aria-modal="true"><header><div><span className="page-eyebrow">VISTA POR ROL</span><h2>Configura tu centro de control</h2></div><button onClick={() => setConfigureOpen(false)} aria-label="Cerrar">x</button></header><div>{availableWidgets.map((widget) => <label key={widget}><span><strong>{WIDGET_LABELS[widget]}</strong></span><input type="checkbox" checked={widgetVisible(widget)} onChange={() => setWidgets(widgetVisible(widget) ? visibleWidgets.filter((item) => item !== widget) : [...visibleWidgets, widget])} /></label>)}</div><footer><button className="btn btn-outline" onClick={() => setWidgets(rolePreset)}>Restaurar preset</button><button className="btn btn-primary" onClick={() => setConfigureOpen(false)}>Aplicar vista</button></footer></aside></div>}
    </div>
  );
}
