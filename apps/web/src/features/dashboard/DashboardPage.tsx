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
const WIDGET_LABELS: Record<DashboardWidget, string> = { attention: 'Atención del día', pulse: 'Pulso La Vitamina', kpis: 'Indicadores principales', performance: 'Meta y Google', flow: 'Ciclo Maestro', ud: 'Unidades de dedicación', pieces: 'Estado de piezas' };
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

export function DashboardPage() {
  const { user } = useAuth();
  const personalView = ['designer', 'audiovisual'].includes(user?.role ?? '');
  const accountView = user?.role === 'community_manager';
  const canViewPerformance = !personalView;
  const role = user?.role || 'admin';
  const dashboardKey = `vitahub:dashboard:${role}`;
  const rolePreset = ROLE_PRESETS[role] || ROLE_PRESETS.admin;
  const [configureOpen, setConfigureOpen] = useState(false);
  const [visibleWidgets, setVisibleWidgets] = useState<DashboardWidget[]>(() => {
    try { const stored = window.localStorage.getItem(dashboardKey); return stored ? JSON.parse(stored) as DashboardWidget[] : rolePreset; } catch { return rolePreset; }
  });
  const setWidgets = (widgets: DashboardWidget[]) => { setVisibleWidgets(widgets); window.localStorage.setItem(dashboardKey, JSON.stringify(widgets)); };
  const widgetVisible = (widget: DashboardWidget) => visibleWidgets.includes(widget);
  const availableWidgets = (Object.keys(WIDGET_LABELS) as DashboardWidget[]).filter((widget) => canViewPerformance || widget !== 'performance').filter((widget) => !personalView || !['pulse', 'flow', 'ud'].includes(widget));
  const { data, isLoading, error, refetch, isFetching } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/reporting/dashboard'),
  });
  const { data: performance } = useQuery<PerformanceData>({
    queryKey: ['performance'],
    queryFn: () => api.get('/reporting/performance'),
    enabled: canViewPerformance,
  });

  if (isLoading) return <LoadingSpinner text="Cargando dashboard..." />;
  if (error) return <QueryErrorState title="No pudimos cargar tu dashboard" message={error.message} onRetry={() => void refetch()} retrying={isFetching} />;
  if (!data) return <div className="alert alert-info">No hay datos disponibles</div>;
  const maxProviderSpend = Math.max(...(performance?.providers.map((provider) => provider.spend) ?? [0]), 1);

  return (
    <div className="page">
      <div className="page-header hero-header"><div><span className="page-eyebrow">CENTRO DE CONTROL · {role.replaceAll('_', ' ')}</span><h1>{personalView ? 'Mi jornada' : 'Dashboard'}</h1><p className="page-subtitle">{personalView ? 'Prioridades, carga y avance de tu trabajo creativo.' : 'Una lectura clara de clientes, capacidad, producción y rendimiento digital.'}</p></div><div className="dashboard-header-actions"><span className="date-chip">{new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</span><button className="btn btn-outline btn-sm" onClick={() => setConfigureOpen(true)}>Configurar widgets</button></div></div>
      {widgetVisible('attention') && <div className="attention-strip">
        <div><span className="attention-kicker">Atención de hoy</span><strong>{data.pendingPieces ?? 0} piezas esperan movimiento</strong><small>Revisa bloqueos y mantén el ciclo de entrega avanzando.</small></div>
        <Link className="btn btn-primary btn-sm" to="/production">Ir a producción</Link>
      </div>}
      {!personalView && widgetVisible('pulse') && <VitaminaPulse />}
      {widgetVisible('kpis') && <div className="card-grid">
        {!personalView && <Card title={accountView ? 'Mis cuentas activas' : 'Clientes Activos'} value={data.activeClients ?? 0} icon="👥" color="#1a1a2e" />}
        <Card title="Piezas Pendientes" value={data.pendingPieces ?? 0} icon="⏳" color="#f39c12" />
        <Card title={personalView || accountView ? 'Mi XP del mes' : 'XP del Equipo'} value={data.teamXp ?? 0} icon="⭐" color="#9b59b6" />
        {!personalView && <Card title="UD este Mes" value={data.monthUd ?? 0} icon="📊" color="#27ae60" />}
      </div>}
      {canViewPerformance && widgetVisible('performance') && <div className="section performance-section">
        <div className="section-title-row"><div><h2>Rendimiento digital</h2><p className="page-subtitle">Últimos 30 días consolidados desde Meta y Google.</p></div><span className={`data-health ${performance?.hasData ? 'is-live' : ''}`}>{performance?.hasData ? 'Datos conectados' : 'Sin datos sincronizados'}</span></div>
        {performance?.hasData ? <>
          <div className="card-grid">
            <Card title="Inversion" value={`$${Math.round(performance.totals.spend).toLocaleString('es-CL')}`} color="#e76f51" />
            <Card title="Leads" value={performance.totals.leads} color="#2a9d8f" />
            <Card title="Costo por lead" value={performance.derived.cpl == null ? 'N/D' : `$${Math.round(performance.derived.cpl).toLocaleString('es-CL')}`} color="#264653" />
            <Card title="Conversiones" value={performance.totals.conversions} color="#e9c46a" />
          </div>
          <div className="performance-visual">
            <div className="provider-chart" aria-label="Inversión por plataforma">{performance.providers.map((provider) => <div className="provider-row" key={provider.provider}><span>{PROVIDER_LABELS[provider.provider] ?? statusLabel(provider.provider)}</span><div className="provider-track"><i style={{ width: `${Math.max((provider.spend / maxProviderSpend) * 100, 3)}%` }} /></div><strong>${Math.round(provider.spend).toLocaleString('es-CL')}</strong></div>)}</div>
            <div className="performance-ratios"><div><span>CTR</span><strong>{performance.derived.ctr == null ? 'N/D' : `${performance.derived.ctr.toFixed(1)}%`}</strong></div><div><span>CPC</span><strong>{performance.derived.cpc == null ? 'N/D' : `$${Math.round(performance.derived.cpc).toLocaleString('es-CL')}`}</strong></div><div><span>Tasa de conversión</span><strong>{performance.derived.conversionRate == null ? 'N/D' : `${performance.derived.conversionRate.toFixed(1)}%`}</strong></div></div>
          </div>
        </> : <div className="empty-insight"><strong>Conecta y asigna cuentas publicitarias</strong><span>El dashboard mostrará métricas cuando exista una sincronización válida. No se completan ceros artificiales.</span></div>}
      </div>}
      {widgetVisible('flow') && <div className="section master-flow-section">
        <div className="section-title-row"><div><h2>Ciclo Maestro</h2><p className="page-subtitle">Como se conecta la venta con el resultado mensual del cliente.</p></div><span className="flow-caption">Fuente unica de verdad</span></div>
        <div className="master-flow" aria-label="Flujo operativo principal">
          {[
            ['01', 'Lead', 'CRM y origen'], ['02', 'Cierre', 'Contrato y plan'], ['03', 'Onboarding', 'Brief y estrategia'],
            ['04', 'Planificacion', 'Grilla y moodboard'], ['05', 'Produccion', 'UD, versiones y XP'],
            ['06', 'Cliente', 'Validacion y reuniones'], ['07', 'Resultados', 'Meta, Google y CRM'],
          ].map(([number, title, detail], index) => <div className="master-flow-step" key={number}>
            <span className="flow-number">{number}</span><div><strong>{title}</strong><small>{detail}</small></div>{index < 6 && <span className="flow-line" />}
          </div>)}
        </div>
      </div>}
      {!personalView && widgetVisible('ud') && data.ud && (
        <div className="section">
          <h2>Unidades de Dedicatoria</h2>
          <div className="card-grid">
            <Card title="Contratadas" value={data.ud.contracted} color="#e67e22" />
            <Card title="Consumidas" value={data.ud.consumed} color="#27ae60" />
            <Card title="Reservadas" value={data.ud.reserved} color="#3498db" />
          </div>
        </div>
      )}
      {widgetVisible('pieces') && data.pieces && data.pieces.length > 0 && (
        <div className="section">
          <h2>Estado de Piezas</h2>
          <div className="card-grid">
            {data.pieces.map((p) => (
              <Card key={p.status} title={statusLabel(p.status)} value={p.count} color="#8e44ad" />
            ))}
          </div>
        </div>
      )}
      {configureOpen && <div className="dashboard-config-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfigureOpen(false); }}><aside className="dashboard-config" role="dialog" aria-modal="true" aria-label="Configurar dashboard"><header><div><span className="page-eyebrow">VISTA POR ROL</span><h2>Configura tu centro de control</h2><p>El preset parte del rol {role.replaceAll('_', ' ')} y tus cambios quedan guardados en este navegador.</p></div><button onClick={() => setConfigureOpen(false)} aria-label="Cerrar">×</button></header><div>{availableWidgets.map((widget) => <label key={widget}><span><strong>{WIDGET_LABELS[widget]}</strong><small>{widget === 'performance' ? 'Datos reales sincronizados de plataformas' : 'Información operativa del sistema'}</small></span><input type="checkbox" checked={widgetVisible(widget)} onChange={() => setWidgets(widgetVisible(widget) ? visibleWidgets.filter((item) => item !== widget) : [...visibleWidgets, widget])} /></label>)}</div><footer><button className="btn btn-outline" onClick={() => setWidgets(rolePreset)}>Restaurar preset del rol</button><button className="btn btn-primary" onClick={() => setConfigureOpen(false)}>Aplicar vista</button></footer></aside></div>}
    </div>
  );
}
