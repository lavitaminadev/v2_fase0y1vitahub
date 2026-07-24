import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../clients/client.entity';
import { ClientStatus } from '../clients/client-status.enum';
import { Contract } from '../contracts/contract.entity';
import { Lead } from '../crm/leads/lead.entity';
import { LeadStatus } from '../crm/leads/lead-status.enum';
import { CreateQuoteDto, UpdateQuoteDto } from './dto/quote.dto';
import { Quote } from './quote.entity';
import { QuoteStatus } from './quote-status.enum';
import { Service } from './service.entity';

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(Quote) private readonly quotes: Repository<Quote>,
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    @InjectRepository(Lead) private readonly leads: Repository<Lead>,
    @InjectRepository(Service) private readonly services: Repository<Service>,
    @InjectRepository(Contract) private readonly contracts: Repository<Contract>,
    private readonly events: EventEmitter2,
  ) {}

  list(organizationId: string) { return this.quotes.find({ where: { organizationId }, relations: ['client', 'lead'], order: { createdAt: 'DESC' }, take: 300 }); }

  async create(organizationId: string, userId: string, dto: CreateQuoteDto): Promise<Quote> {
    await this.validateTarget(organizationId, dto.clientId, dto.leadId);
    const items = await this.normalizeItems(organizationId, dto.items);
    return this.quotes.save(this.quotes.create({
      organizationId, createdBy: userId, clientId: dto.clientId, leadId: dto.leadId,
      number: `COT-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`,
      title: dto.title.trim(), currency: dto.currency ?? 'CLP', validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      notes: dto.notes?.trim() || undefined, items, amount: this.total(items), status: QuoteStatus.DRAFT, version: 1,
    }));
  }

  async update(id: string, organizationId: string, dto: UpdateQuoteDto): Promise<Quote> {
    const quote = await this.find(id, organizationId);
    if (quote.status !== QuoteStatus.DRAFT) throw new BadRequestException('Solo se puede editar una cotización en borrador');
    await this.validateTarget(organizationId, dto.clientId, dto.leadId);
    const items = await this.normalizeItems(organizationId, dto.items);
    Object.assign(quote, { clientId: dto.clientId, leadId: dto.leadId, title: dto.title.trim(), currency: dto.currency ?? quote.currency, validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined, notes: dto.notes?.trim() || undefined, items, amount: this.total(items) });
    return this.quotes.save(quote);
  }

  async createVersion(id: string, organizationId: string, userId: string): Promise<Quote> {
    const source = await this.find(id, organizationId);
    const rootId = source.parentQuoteId ?? source.id;
    const latest = await this.quotes.find({ where: [{ id: rootId, organizationId }, { parentQuoteId: rootId, organizationId }], order: { version: 'DESC' }, take: 1 });
    return this.quotes.save(this.quotes.create({ ...source, id: undefined, createdAt: undefined, updatedAt: undefined, number: `COT-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}`, status: QuoteStatus.DRAFT, acceptedAt: undefined, sentAt: undefined, parentQuoteId: rootId, version: Number(latest[0]?.version ?? source.version ?? 1) + 1, createdBy: userId }));
  }

  async send(id: string, organizationId: string): Promise<Quote> {
    const quote = await this.find(id, organizationId);
    if (quote.status !== QuoteStatus.DRAFT) throw new BadRequestException('La cotización ya fue enviada o cerrada');
    quote.status = QuoteStatus.SENT;
    quote.sentAt = new Date();
    if (quote.leadId) await this.leads.update({ id: quote.leadId, organizationId }, { status: LeadStatus.QUOTE_SENT });
    return this.quotes.save(quote);
  }

  async accept(id: string, organizationId: string, userId: string): Promise<{ quote: Quote; client: Client; contract: Contract }> {
    const quote = await this.find(id, organizationId);
    if (![QuoteStatus.DRAFT, QuoteStatus.SENT].includes(quote.status)) throw new BadRequestException('La cotización no se puede aceptar en su estado actual');
    const result = await this.quotes.manager.transaction(async (manager) => {
      let client = quote.clientId ? await manager.findOne(Client, { where: { id: quote.clientId, organizationId } }) : null;
      if (!client && quote.leadId) {
        const lead = await manager.findOne(Lead, { where: { id: quote.leadId, organizationId } });
        if (!lead) throw new NotFoundException('Lead no encontrado');
        client = await manager.save(Client, manager.create(Client, { organizationId, leadId: lead.id, name: lead.name, status: ClientStatus.ONBOARDING, retainerAmount: quote.amount }));
        lead.status = LeadStatus.WON; lead.convertedAt = new Date(); lead.convertedToClientId = client.id; await manager.save(Lead, lead);
        quote.clientId = client.id;
      }
      if (!client) throw new BadRequestException('La cotización debe estar asociada a un lead o cliente');
      quote.status = QuoteStatus.ACCEPTED; quote.acceptedAt = new Date(); await manager.save(Quote, quote);
      const serviceIds = (quote.items ?? []).map((item) => item.serviceId).filter((value): value is string => typeof value === 'string');
      const serviceRows = serviceIds.length ? await manager.find(Service, { where: serviceIds.map((serviceId) => ({ id: serviceId, organizationId })) }) : [];
      const monthlyUd = (quote.items ?? []).reduce((sum, item) => sum + Number(serviceRows.find((service) => service.id === item.serviceId)?.udPerUnit ?? 0) * Number(item.quantity ?? 1), 0);
      const contract = await manager.save(Contract, manager.create(Contract, { organizationId, clientId: client.id, name: quote.title, serviceType: (quote.items ?? []).map((item) => item.description).join(', ').slice(0, 255), startDate: new Date(), monthlyUd, monthlyPrice: quote.amount, status: 'active', terms: quote.notes }));
      client.retainerAmount = quote.amount; if (monthlyUd > 0) client.defaultUdBudget = monthlyUd; await manager.save(Client, client);
      return { quote, client, contract };
    });
    if (quote.leadId) this.events.emit('lead.converted', { organizationId, leadId: quote.leadId, clientId: result.client.id });
    return result;
  }

  private async find(id: string, organizationId: string): Promise<Quote> {
    const quote = await this.quotes.findOne({ where: { id, organizationId }, relations: ['client', 'lead'] });
    if (!quote) throw new NotFoundException('Cotización no encontrada');
    return quote;
  }
  private async validateTarget(organizationId: string, clientId?: string, leadId?: string) {
    if ((!clientId && !leadId) || (clientId && leadId)) throw new BadRequestException('Selecciona un lead o un cliente');
    if (clientId && !await this.clients.findOne({ where: { id: clientId, organizationId } })) throw new BadRequestException('El cliente no pertenece a la organización');
    if (leadId && !await this.leads.findOne({ where: { id: leadId, organizationId } })) throw new BadRequestException('El lead no pertenece a la organización');
  }
  private async normalizeItems(organizationId: string, items: CreateQuoteDto['items']) {
    if (!items.length) throw new BadRequestException('Agrega al menos un ítem a la cotización');
    const serviceIds = items.map((item) => item.serviceId).filter((value): value is string => Boolean(value));
    if (serviceIds.length && await this.services.count({ where: serviceIds.map((id) => ({ id, organizationId })) }) !== new Set(serviceIds).size) throw new BadRequestException('Uno de los servicios no pertenece al catálogo');
    return items.map((item) => ({ serviceId: item.serviceId, description: item.description.trim(), quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), total: Number(item.quantity) * Number(item.unitPrice) }));
  }
  private total(items: Array<Record<string, unknown>>) { return items.reduce((sum, item) => sum + Number(item.total ?? 0), 0); }
}
