import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { MonthlyReportsPanel } from './MonthlyReportsPanel';

interface ReportData {
  totalRevenue: number;
  activeProjects: number;
  avgUdPerClient: number;
  monthlyData?: { month: string; revenue: number; ud: number }[];
  topClients?: { name: string; revenue: number }[];
}

const money = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value || 0);
const monthLabel = (value: string) => new Date(`${value}-01T12:00:00`).toLocaleDateString('es-CL', { month: 'short', year: '2-digit' }).replace('.', '');

export function ReportsPage() {
  const reportQuery = useQuery<ReportData>({ queryKey: ['reports'], queryFn: () => api.get('/reporting/reports') });
  if (reportQuery.isLoading) return <LoadingSpinner text="Construyendo reporte operativo..." />;
  if (reportQuery.error) return <div className="page"><div className="page-load-error"><span>!</span><h1>No pudimos construir el reporte</h1><p>{reportQuery.error.message}</p><button className="btn btn-primary" onClick={() => reportQuery.refetch()}>Reintentar</button></div></div>;
  if (!reportQuery.data) return null;

  const data = reportQuery.data;
  const monthly = data.monthlyData ?? [];
  const topClients = data.topClients ?? [];
  const maxRevenue = Math.max(...monthly.map((row) => row.revenue), 1);
  const maxUd = Math.max(...monthly.map((row) => row.ud), 1);
  const maxClientRevenue = Math.max(...topClients.map((row) => row.revenue), 1);
  const current = monthly.at(-1);
  const previous = monthly.at(-2);
  const revenueChange = current && previous && previous.revenue > 0 ? Math.round((current.revenue - previous.revenue) * 100 / previous.revenue) : null;

  return (
    <div className="page reports-page">
      <section className="module-hero reports-hero"><div><span className="page-eyebrow">LECTURA EJECUTIVA</span><h1>Reportes</h1><p>Ingresos pagados, carga productiva y distribución de cuentas a partir de registros reales de VITAHUB.</p></div><div className="report-period"><small>Ventana analítica</small><strong>Últimos 12 meses</strong><span>{monthly.length ? `${monthLabel(monthly[0].month)} - ${monthLabel(monthly.at(-1)!.month)}` : 'Sin movimientos registrados'}</span></div></section>

      <section className="report-kpis" aria-label="Indicadores principales">
        <article className="report-kpi-primary"><span>Ingresos pagados</span><strong>{money(data.totalRevenue)}</strong><small>{revenueChange == null ? 'Sin base mensual para comparar' : `${revenueChange >= 0 ? '+' : ''}${revenueChange}% respecto al mes anterior`}</small></article>
        <article><span>Piezas activas</span><strong>{data.activeProjects}</strong><small>En producción o revisión</small></article>
        <article><span>Capacidad promedio</span><strong>{data.avgUdPerClient} <i>UD</i></strong><small>Presupuesto base por cliente</small></article>
      </section>

      <div className="report-layout">
        <section className="report-panel report-trend"><header><div><span className="page-eyebrow">EVOLUCIÓN</span><h2>Actividad mensual</h2></div><div className="report-legend"><span><i className="revenue" />Ingresos</span><span><i className="ud" />UD producidas</span></div></header>
          {monthly.length ? <div className="monthly-tracks">{monthly.map((row) => <article key={row.month}><time>{monthLabel(row.month)}</time><div className="metric-track"><span className="revenue" style={{ width: `${Math.max(row.revenue ? 3 : 0, row.revenue * 100 / maxRevenue)}%` }} /><b>{money(row.revenue)}</b></div><div className="metric-track"><span className="ud" style={{ width: `${Math.max(row.ud ? 3 : 0, row.ud * 100 / maxUd)}%` }} /><b>{row.ud} UD</b></div></article>)}</div> : <div className="panel-empty"><strong>Aún no existe una serie mensual</strong><span>Se formará automáticamente al registrar entregas e ingresos pagados.</span></div>}
          <p className="data-note">Ingresos y UD usan escalas independientes para evitar comparaciones visuales engañosas.</p>
        </section>

        <section className="report-panel top-clients"><header><div><span className="page-eyebrow">CONCENTRACIÓN</span><h2>Clientes por ingresos</h2></div></header>
          {topClients.length ? <div className="ranked-clients">{topClients.map((client, index) => <article key={`${client.name}-${index}`}><b>{String(index + 1).padStart(2, '0')}</b><div><span><strong>{client.name}</strong><small>{money(client.revenue)}</small></span><i><em style={{ width: `${client.revenue * 100 / maxClientRevenue}%` }} /></i></div></article>)}</div> : <div className="panel-empty"><strong>Sin ingresos atribuidos</strong><span>Los clientes aparecerán al existir registros pagados.</span></div>}
        </section>
      </div>
      <MonthlyReportsPanel />
    </div>
  );
}
