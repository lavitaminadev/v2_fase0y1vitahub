import { reportMoney, reportPeriod } from './monthly-report.types';
import type { MonthlyReport } from './monthly-report.types';

interface Props { report: MonthlyReport; actions?: React.ReactNode; detailed?: boolean }

export function MonthlyReportCard({ report, actions, detailed = false }: Props) {
  const metrics = report.metrics ?? {};
  return <article className={`monthly-report-card ${detailed ? 'is-detailed' : ''}`}>
    <header><div><span className="page-eyebrow">{reportPeriod(report).toUpperCase()}</span><h3>{report.title}</h3><small>{report.clientName}</small></div><div className="monthly-report-actions">{actions}<span className={`report-state ${report.status}`}>{report.status === 'published' ? 'Publicado' : 'Borrador'}</span></div></header>
    <div className="monthly-report-kpis"><span><small>Inversión</small><strong>{reportMoney(report.adSpend)}</strong></span><span><small>Leads</small><strong>{report.leads}</strong></span><span><small>Reservas</small><strong>{report.bookings}</strong></span><span><small>Conversiones</small><strong>{report.conversions}</strong></span><span><small>Ventas atribuidas</small><strong>{reportMoney(report.salesGenerated)}</strong></span></div>
    {report.executiveSummary && <p className="report-summary">{report.executiveSummary}</p>}
    {detailed && <div className="monthly-report-detail">
      <section><h4>Lecturas principales</h4>{report.insights?.length ? <ul>{report.insights.map((insight, index) => <li key={index}>{insight}</li>)}</ul> : <p>Sin hallazgos editoriales agregados.</p>}</section>
      <section><h4>Operación del período</h4><dl><div><dt>Piezas entregadas</dt><dd>{metrics.deliveredPieces ?? 0}</dd></div><div><dt>UD consumidas</dt><dd>{metrics.consumedUd ?? 0}</dd></div><div><dt>Reuniones completadas</dt><dd>{metrics.completedMeetings ?? 0}</dd></div><div><dt>Ausencias a reservas</dt><dd>{metrics.noShows ?? 0}</dd></div></dl></section>
      {report.recommendations && <section><h4>Próximas decisiones</h4><p>{report.recommendations}</p></section>}
    </div>}
  </article>;
}
