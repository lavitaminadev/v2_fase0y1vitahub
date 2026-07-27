import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

type Dimension = {
  key: string;
  label: string;
  score: number | null;
  weight: number;
  evidence: string;
  status: 'healthy' | 'attention' | 'blocked' | 'no_data';
};

type Action = {
  id: string;
  title: string;
  detail: string;
  priority: 'high' | 'medium' | 'low';
  owner: 'team' | 'client';
  route: string;
};

type ImpactRow = {
  type: string;
  title: string;
  detail: string;
  happened_at: Date | string;
};

@Injectable()
export class VitaminaPulseService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getPulse(organizationId: string, clientId?: string, clientIds?: string[]) {
    const scope = clientId
      ? ' AND client_id = ?'
      : clientIds === undefined
        ? ''
        : clientIds.length
          ? ` AND client_id IN (${clientIds.map(() => '?').join(',')})`
          : ' AND 1 = 0';
    const params = [organizationId, ...(clientId ? [clientId] : clientIds ?? [])];
    const clientScope = clientId
      ? ' AND id = ?'
      : clientIds === undefined
        ? ''
        : clientIds.length
          ? ` AND id IN (${clientIds.map(() => '?').join(',')})`
          : ' AND 1 = 0';
    const [cycleRows, pieceRows, approvalRows, meetingRows, metricRows, reservationRows, clientRows] = await Promise.all([
      this.dataSource.query(
        `SELECT COUNT(*) total,
                SUM(grid_status = 'completed') grids_completed,
                SUM(production_status = 'completed') production_completed,
                SUM(report_status = 'completed') reports_completed,
                SUM(weekly_meetings_completed) meetings_completed,
                SUM(weekly_meetings_due) meetings_due
         FROM account_cycles WHERE organization_id = ?${scope} AND year = YEAR(CURDATE()) AND month = MONTH(CURDATE())`, params),
      this.dataSource.query(
        `SELECT COUNT(*) total,
                SUM(status = 'delivered') delivered,
                SUM(status NOT IN ('delivered','cancelled')) pending,
                SUM(deadline_at < NOW() AND status NOT IN ('delivered','cancelled')) overdue,
                SUM(delivered_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)) delivered_recent
         FROM pieces WHERE organization_id = ?${scope} AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`, params),
      this.dataSource.query(
        `SELECT COUNT(*) total, SUM(status = 'pending') pending,
                SUM(status = 'approved') approved,
                SUM(status = 'pending' AND due_at < NOW()) overdue
         FROM approval_requests WHERE organization_id = ?${scope} AND created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)`, params),
      this.dataSource.query(
        `SELECT COUNT(*) total, SUM(status = 'completed') completed,
                SUM(scheduled_at >= NOW()) upcoming
         FROM meetings WHERE organization_id = ?${scope} AND scheduled_at >= DATE_SUB(NOW(), INTERVAL 45 DAY)`, params),
      this.dataSource.query(
        `SELECT COUNT(*) total, COALESCE(SUM(leads),0) leads, COALESCE(SUM(conversions),0) conversions,
                MAX(metric_date) last_data_at
         FROM integration_metrics WHERE organization_id = ?${scope} AND metric_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`, params),
      this.dataSource.query(
        `SELECT COUNT(*) total, SUM(status = 'attended') attended, SUM(status = 'no_show') no_show,
                SUM(status LIKE 'cancelled%') cancelled
         FROM reservations WHERE organization_id = ?${scope} AND starts_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`, params),
      this.dataSource.query(
        `SELECT COUNT(*) total, MIN(started_at) oldest_start, SUM(status = 'active') active
         FROM clients WHERE organization_id = ?${clientScope}`, params),
    ]);

    const cycle = cycleRows[0] ?? {};
    const pieces = pieceRows[0] ?? {};
    const approvals = approvalRows[0] ?? {};
    const meetings = meetingRows[0] ?? {};
    const metrics = metricRows[0] ?? {};
    const reservationActivity = reservationRows[0] ?? {};
    const clients = clientRows[0] ?? {};
    const ratio = (value: number, total: number) => total > 0 ? Math.round(Math.min(value / total, 1) * 100) : null;
    const statusFor = (score: number | null): Dimension['status'] => score == null ? 'no_data' : score >= 80 ? 'healthy' : score >= 55 ? 'attention' : 'blocked';

    const cycleTotal = Number(cycle.total || 0);
    const planningScore = cycleTotal > 0 ? Math.round((Number(cycle.grids_completed || 0) / cycleTotal) * 100) : null;
    const productionTotal = Number(pieces.total || 0);
    const overduePieces = Number(pieces.overdue || 0);
    const productionScore = productionTotal > 0 ? Math.max(0, Math.round(100 - overduePieces * 15 - (Number(pieces.pending || 0) / productionTotal) * 25)) : null;
    const approvalTotal = Number(approvals.total || 0);
    const approvalScore = ratio(Number(approvals.approved || 0), approvalTotal);
    const meetingDue = Number(cycle.meetings_due || 0);
    const cadenceScore = meetingDue > 0 ? ratio(Number(cycle.meetings_completed || 0), meetingDue) : ratio(Number(meetings.completed || 0), Number(meetings.total || 0));
    const measurementScore = Number(metrics.total || 0) > 0 ? 100 : null;
    const reservationTotal = Number(reservationActivity.total || 0);
    const reservationScore = reservationTotal > 0 ? Math.max(0, Math.round(100 - (Number(reservationActivity.cancelled || 0) / reservationTotal) * 45 - (Number(reservationActivity.no_show || 0) / reservationTotal) * 55)) : null;

    const dimensions: Dimension[] = [
      { key: 'planning', label: 'Planificación', score: planningScore, weight: 20, evidence: cycleTotal ? `${cycle.grids_completed || 0}/${cycleTotal} grillas del ciclo completadas` : 'Sin ciclo mensual activo', status: statusFor(planningScore) },
      { key: 'production', label: 'Producción', score: productionScore, weight: 20, evidence: productionTotal ? `${pieces.delivered_recent || 0} entregas recientes · ${overduePieces} vencidas` : 'Sin piezas recientes', status: statusFor(productionScore) },
      { key: 'collaboration', label: 'Colaboración', score: approvalScore, weight: 15, evidence: approvalTotal ? `${approvals.pending || 0} aprobaciones pendientes` : 'Sin solicitudes recientes', status: statusFor(approvalScore) },
      { key: 'cadence', label: 'Cadencia estratégica', score: cadenceScore, weight: 15, evidence: meetingDue ? `${cycle.meetings_completed || 0}/${meetingDue} reuniones del ciclo` : `${meetings.completed || 0} reuniones completadas`, status: statusFor(cadenceScore) },
      { key: 'measurement', label: 'Medición', score: measurementScore, weight: 15, evidence: measurementScore ? `Datos al ${new Date(metrics.last_data_at).toLocaleDateString('es-CL')}` : 'Sin métricas sincronizadas', status: statusFor(measurementScore) },
      { key: 'reservations', label: 'Reservas', score: reservationScore, weight: 15, evidence: reservationTotal ? `${reservationActivity.attended || 0} asistencias · ${reservationActivity.no_show || 0} no-show` : 'Módulo sin actividad', status: statusFor(reservationScore) },
    ];
    const measured = dimensions.filter((item) => item.score != null);
    const measuredWeight = measured.reduce((sum, item) => sum + item.weight, 0);
    const score = measuredWeight ? Math.round(measured.reduce((sum, item) => sum + Number(item.score) * item.weight, 0) / measuredWeight) : null;
    const coverage = Math.round(measuredWeight);

    const actions: Action[] = [];
    if (overduePieces > 0) actions.push({ id: 'overdue-pieces', title: `Resolver ${overduePieces} pieza${overduePieces === 1 ? '' : 's'} vencida${overduePieces === 1 ? '' : 's'}`, detail: 'Desbloquea responsables o redefine la fecha antes de comprometer nuevas entregas.', priority: 'high', owner: 'team', route: '/production' });
    if (Number(approvals.overdue || 0) > 0) actions.push({ id: 'overdue-approvals', title: 'Responder aprobaciones fuera de plazo', detail: 'La producción está esperando una decisión del cliente.', priority: 'high', owner: 'client', route: clientId ? '/portal/approvals' : '/approvals' });
    else if (Number(approvals.pending || 0) > 0) actions.push({ id: 'pending-approvals', title: `${approvals.pending} aprobaciones requieren atención`, detail: 'Revisarlas mantiene el calendario creativo en movimiento.', priority: 'medium', owner: 'client', route: clientId ? '/portal/approvals' : '/approvals' });
    if (planningScore == null || planningScore < 100) actions.push({ id: 'planning', title: 'Completar la planificación del ciclo', detail: 'Confirma grilla, prioridades y ventanas de publicación.', priority: planningScore == null ? 'medium' : 'low', owner: 'team', route: clientId ? '/portal/grid' : '/content' });
    if (measurementScore == null) actions.push({ id: 'measurement', title: 'Activar medición de resultados', detail: 'Asigna y sincroniza las cuentas publicitarias para conectar trabajo e impacto.', priority: 'medium', owner: 'team', route: '/integrations' });
    if (Number(reservationActivity.no_show || 0) > 0) actions.push({ id: 'reservation-no-show', title: `Reducir ${reservationActivity.no_show} inasistencia${Number(reservationActivity.no_show) === 1 ? '' : 's'}`, detail: 'Revisa anticipación, horarios de mayor abandono y recordatorios del local.', priority: 'medium', owner: 'team', route: clientId ? '/portal/reservations' : '/reservations' });
    if (!actions.length) actions.push({ id: 'healthy-cycle', title: 'Mantener el ritmo del ciclo', detail: 'La cuenta no presenta bloqueos operativos prioritarios.', priority: 'low', owner: 'team', route: clientId ? '/portal/reports' : '/reports' });

    const timelineParams = [params, params, params].flat();
    const timeline = await this.dataSource.query<ImpactRow[]>(
      `SELECT * FROM (
        SELECT 'delivery' type, title, delivered_at happened_at, 'Pieza entregada' detail FROM pieces WHERE organization_id = ?${scope} AND delivered_at IS NOT NULL
        UNION ALL
        SELECT 'approval' type, title, decision_at happened_at, IF(status='approved','Aprobación confirmada','Cambios solicitados') detail FROM approval_requests WHERE organization_id = ?${scope} AND decision_at IS NOT NULL
        UNION ALL
        SELECT 'meeting' type, title, scheduled_at happened_at, 'Encuentro de seguimiento' detail FROM meetings WHERE organization_id = ?${scope} AND status = 'completed'
      ) impact WHERE happened_at >= DATE_SUB(NOW(), INTERVAL 90 DAY) ORDER BY happened_at DESC LIMIT 12`, timelineParams);

    const ageDays = clients.oldest_start ? Math.floor((Date.now() - new Date(clients.oldest_start).getTime()) / 86400000) : 0;
    const stage = ageDays < 45 ? 'activation' : Number(metrics.conversions || 0) > 0 ? 'optimization' : Number(metrics.leads || 0) > 0 ? 'traction' : productionTotal > 0 ? 'building' : 'activation';
    return {
      score,
      coverage,
      status: statusFor(score),
      stage,
      generatedAt: new Date().toISOString(),
      dimensions,
      actions: actions.slice(0, 5),
      commitments: {
        team: actions.filter((item) => item.owner === 'team').length,
        client: actions.filter((item) => item.owner === 'client').length,
      },
      impact: timeline.map((item) => ({
        type: item.type,
        title: item.title,
        detail: item.detail,
        happenedAt: item.happened_at,
      })),
    };
  }
}
