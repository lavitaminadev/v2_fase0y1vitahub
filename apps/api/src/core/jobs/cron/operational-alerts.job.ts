import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Notification } from '../../notifications/notification.entity';
import { ParameterResolver } from '../../parameters/parameter-resolver.service';

interface RecipientRow { id: string }

@Injectable()
export class OperationalAlertsJob {
  private readonly logger = new Logger(OperationalAlertsJob.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    private readonly parameters: ParameterResolver,
  ) {}

  async handle(): Promise<void> {
    const organizations = await this.dataSource.query<Array<{ id: string }>>('SELECT id FROM organizations');
    let created = 0;
    // try/catch por organizacion: esta app es multi-tenant — un error en los datos
    // de una organizacion no debe dejar sin alertas al resto de las organizaciones.
    for (const organization of organizations) {
      try {
        created += await this.deadlineAlerts(organization.id);
        created += await this.actionItemAlerts(organization.id);
        created += await this.budgetAlerts(organization.id);
        created += await this.cycleAlerts(organization.id);
      } catch (error) {
        this.logger.error(`Failed to scan alerts for organization ${organization.id}: ${error instanceof Error ? error.message : error}`);
      }
    }
    this.logger.log(`Operational alert scan completed: ${created} notifications created`);
  }

  private async deadlineAlerts(organizationId: string): Promise<number> {
    const hours = Number(await this.parameters.get('alerts.deadline_notice_hours', null, null, organizationId) ?? 24);
    const pieces = await this.dataSource.query<Array<{ id: string; title: string; assignedTo?: string; deadlineAt: Date; clientId: string }>>(
      "SELECT id, title, assigned_to assignedTo, deadline_at deadlineAt, client_id clientId FROM pieces WHERE organization_id = ? AND status <> 'delivered' AND deadline_at IS NOT NULL AND deadline_at <= DATE_ADD(NOW(), INTERVAL ? HOUR)",
      [organizationId, hours],
    );
    let total = 0;
    const fallback = await this.directors(organizationId);
    for (const piece of pieces) {
      const overdue = new Date(piece.deadlineAt).getTime() < Date.now();
      const recipients = piece.assignedTo ? [piece.assignedTo, ...fallback] : fallback;
      total += await this.notifyOnce(organizationId, [...new Set(recipients)], overdue ? 'deadline.overdue' : 'deadline.upcoming', `${piece.id}:${overdue ? 'overdue' : 'upcoming'}`, overdue ? 'Entrega vencida' : 'Entrega próxima', `La pieza "${piece.title}" ${overdue ? 'superó su fecha de entrega' : `vence dentro de ${hours} horas`}.`, { pieceId: piece.id, clientId: piece.clientId, deadlineAt: piece.deadlineAt });
    }
    return total;
  }

  private async actionItemAlerts(organizationId: string): Promise<number> {
    const items = await this.dataSource.query<Array<{ id: string; description: string; assignedTo?: string; meetingId: string }>>(
      "SELECT ai.id, ai.description, ai.assigned_to assignedTo, ai.meeting_id meetingId FROM action_items ai JOIN meetings m ON m.id = ai.meeting_id WHERE m.organization_id = ? AND ai.status <> 'completed' AND ai.due_at IS NOT NULL AND ai.due_at < NOW()",
      [organizationId],
    );
    let total = 0;
    const fallback = await this.directors(organizationId);
    for (const item of items) total += await this.notifyOnce(organizationId, item.assignedTo ? [item.assignedTo] : fallback, 'meeting.action_overdue', item.id, 'Compromiso vencido', item.description, { actionItemId: item.id, meetingId: item.meetingId });
    return total;
  }

  private async budgetAlerts(organizationId: string): Promise<number> {
    const threshold = Number(await this.parameters.get('ud.warning_threshold_percent', null, null, organizationId) ?? 80);
    const budgets = await this.dataSource.query<Array<{ id: string; clientId: string; clientName: string; communityManagerId?: string; contracted: number; reserved: number; consumed: number }>>(
      'SELECT b.id, b.client_id clientId, c.name clientName, c.community_manager_id communityManagerId, b.contracted, b.reserved, b.consumed FROM ud_budgets b JOIN clients c ON c.id = b.client_id WHERE c.organization_id = ? AND b.year = YEAR(CURDATE()) AND b.month = MONTH(CURDATE()) AND b.contracted > 0 AND ((b.reserved + b.consumed) * 100 / b.contracted) >= ?',
      [organizationId, threshold],
    );
    let total = 0;
    const fallback = await this.directors(organizationId);
    for (const budget of budgets) {
      const percent = Math.round((Number(budget.reserved) + Number(budget.consumed)) * 100 / Number(budget.contracted));
      const recipients = budget.communityManagerId ? [budget.communityManagerId, ...fallback] : fallback;
      total += await this.notifyOnce(organizationId, [...new Set(recipients)], 'ud.threshold', `${budget.id}:${percent >= 100 ? 'limit' : 'warning'}`, percent >= 100 ? 'Presupuesto UD agotado' : 'Consumo UD preventivo', `${budget.clientName} alcanzó ${percent}% de su presupuesto mensual.`, { budgetId: budget.id, clientId: budget.clientId, percent });
    }
    return total;
  }

  private async cycleAlerts(organizationId: string): Promise<number> {
    if (new Date().getDate() < 8) return 0;
    const cycles = await this.dataSource.query<Array<{ id: string; clientId: string; clientName: string; communityManagerId?: string; gridStatus: string; reportStatus: string; weeklyDone: number; weeklyDue: number; strategyStatus: string }>>(
      'SELECT ac.id, ac.client_id clientId, c.name clientName, c.community_manager_id communityManagerId, ac.grid_status gridStatus, ac.report_status reportStatus, ac.weekly_meetings_completed weeklyDone, ac.weekly_meetings_due weeklyDue, ac.strategy_meeting_status strategyStatus FROM account_cycles ac JOIN clients c ON c.id = ac.client_id WHERE ac.organization_id = ? AND ac.year = YEAR(CURDATE()) AND ac.month = MONTH(CURDATE()) AND ac.status <> \'closed\'',
      [organizationId],
    );
    let total = 0;
    const fallback = await this.directors(organizationId);
    for (const cycle of cycles) {
      const pending = [cycle.gridStatus !== 'completed' ? 'parrilla' : '', Number(cycle.weeklyDone) < Number(cycle.weeklyDue) ? 'reuniones semanales' : '', cycle.strategyStatus !== 'completed' ? 'reunión estratégica' : '', cycle.reportStatus !== 'completed' ? 'informe' : ''].filter(Boolean);
      if (!pending.length) continue;
      const recipients = cycle.communityManagerId ? [cycle.communityManagerId, ...fallback] : fallback;
      total += await this.notifyOnce(organizationId, [...new Set(recipients)], 'cycle.pending', `${cycle.id}:${pending.join('|')}`, 'Ciclo mensual con pendientes', `${cycle.clientName}: falta completar ${pending.join(', ')}.`, { cycleId: cycle.id, clientId: cycle.clientId, pending });
    }
    return total;
  }

  private directors(organizationId: string): Promise<RecipientRow[]> {
    return this.dataSource.query("SELECT id FROM users WHERE organization_id = ? AND is_active = 1 AND role IN ('admin','operations_director')", [organizationId]);
  }

  private async notifyOnce(organizationId: string, recipients: Array<string | RecipientRow>, type: string, fingerprint: string, title: string, message: string, data: Record<string, unknown>): Promise<number> {
    let created = 0;
    for (const recipient of recipients) {
      const userId = typeof recipient === 'string' ? recipient : recipient.id;
      if (!userId) continue;
      const existing = await this.dataSource.query('SELECT id FROM notifications WHERE organization_id = ? AND user_id = ? AND type = ? AND JSON_UNQUOTE(JSON_EXTRACT(data, \'$.fingerprint\')) = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 20 HOUR) LIMIT 1', [organizationId, userId, type, fingerprint]);
      if (existing.length) continue;
      await this.notifications.save(this.notifications.create({ organizationId, userId, type, title, message, data: { ...data, fingerprint } }));
      created += 1;
    }
    return created;
  }
}
