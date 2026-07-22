import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { EmptyState } from '../../shared/EmptyState';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { MonthlyReportCard } from '../reports/MonthlyReportCard';
import type { MonthlyReport } from '../reports/monthly-report.types';

export function ClientReports() {
  const { data: reports = [], isLoading, error, refetch } = useQuery<MonthlyReport[]>({ queryKey: ['client-monthly-reports'], queryFn: () => api.get('/reporting/monthly-reports') });
  if (isLoading) return <LoadingSpinner text="Cargando informes publicados..." />;
  if (error) return <div className="page"><div className="page-load-error"><span>!</span><h1>No pudimos cargar tus informes</h1><p>{error.message}</p><button className="btn btn-primary" onClick={() => refetch()}>Reintentar</button></div></div>;
  return <div className="page client-reports-page">
    <section className="portal-welcome"><div><span className="page-eyebrow">TRANSPARENCIA DE RESULTADOS</span><h1>Mis informes</h1><p>Resultados publicados por La Vitamina, con métricas verificables, lectura ejecutiva y próximos pasos.</p></div><button className="btn btn-outline" disabled={!reports.length} onClick={() => window.print()}>Imprimir / guardar PDF</button></section>
    {reports.length ? <div className="client-monthly-reports">{reports.map((report) => <MonthlyReportCard key={report.id} report={report} detailed />)}</div> : <EmptyState icon="[]" title="Sin informes publicados" description="Cuando el equipo termine y apruebe un informe mensual, aparecerá aquí automáticamente." />}
  </div>;
}
