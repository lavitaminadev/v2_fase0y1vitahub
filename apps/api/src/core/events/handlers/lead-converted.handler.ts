import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lead } from '../../../modules/crm/leads/lead.entity';
import { Client } from '../../../modules/clients/client.entity';
import { Onboarding } from '../../../modules/onboarding/onboarding.entity';
import { Notification } from '../../notifications/notification.entity';
import { WorkflowsService } from '../../../modules/workflows/workflows.service';

@Injectable()
export class LeadConvertedHandler {
  private readonly logger = new Logger(LeadConvertedHandler.name);

  constructor(
    @InjectRepository(Lead) private leadRepo: Repository<Lead>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(Onboarding) private onboardingRepo: Repository<Onboarding>,
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    private readonly workflows: WorkflowsService,
  ) {}

  @OnEvent('lead.converted')
  async handle(payload: { organizationId: string; leadId: string; clientId: string }) {
    // Los listeners de eventos corren fuera del ciclo request-response de Nest,
    // por lo que una excepcion aqui no la captura ningun exception filter global:
    // sin este try/catch se pierde silenciosamente (o revienta como unhandled
    // rejection) la creacion de la notificacion y los pasos de onboarding.
    try {
      const lead = await this.leadRepo.findOne({ where: { id: payload.leadId, organizationId: payload.organizationId } });
      if (!lead) return;

      const client = await this.clientRepo.findOne({ where: { id: payload.clientId, organizationId: payload.organizationId } });
      if (!client) return;

      if (lead.assignedTo) {
        const notif = this.notifRepo.create({
          organizationId: lead.organizationId,
          userId: lead.assignedTo,
          type: 'lead.converted',
          title: 'Lead convertido',
          message: `El lead ${lead.name} se ha convertido en cliente.`,
          data: { leadId: payload.leadId, clientId: payload.clientId },
        });
        await this.notifRepo.save(notif);
      }

      const steps = await this.workflows.getSteps(client.organizationId, 'onboarding');
      if (steps.length) {
        await this.onboardingRepo.save(steps.map((step, index) => this.onboardingRepo.create({
          clientId: payload.clientId,
          organizationId: client.organizationId,
          step: step.label,
          status: 'pending',
          assignedTo: index === 0 ? lead.assignedTo : undefined,
          notes: step.slaHours ? `SLA sugerido: ${step.slaHours} horas${step.responsibleRole ? ` · Responsable: ${step.responsibleRole}` : ''}` : undefined,
        })));
      }
    } catch (error) {
      this.logger.error(`Error procesando lead.converted para lead ${payload.leadId}: ${error instanceof Error ? error.message : error}`);
    }
  }
}
