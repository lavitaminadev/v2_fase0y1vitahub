import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { ReservationForm } from '../domain/reservation-form.entity';
import { Reservation } from '../domain/reservation.entity';
import { AvailabilityBlock } from '../domain/availability-block.entity';
import { ReservationEvent } from '../domain/reservation-event.entity';
import { ReservationFormEvent } from '../domain/reservation-form-event.entity';
import { ReservationCoupon } from '../domain/reservation-coupon.entity';
import { addPlainDays, assertTimeZone, localToUtc, plainDateParts, zonedParts } from '../domain/timezone';
import { CreateBlockDto, CreateCouponDto, CreateManualReservationDto, CreateReservationFormDto, ListReservationsDto, PublicFormEventDto, PublicReservationDto, UpdateCouponDto, UpdateReservationDto, UpdateReservationFormDto } from '../dto/reservation.dto';
import { LeadIntakeService } from '../../crm/leads/lead-intake.service';
import { GoogleCalendarService } from '../../integrations/google/google-calendar.service';
import { MetaConversionOutboxService } from '../../integrations/meta/meta-conversion-outbox.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { EmailService } from '../../../core/notifications/email.service';
import { MetaClientPixelService } from '../../integrations/meta/meta-client-pixel.service';
import { normalizeClientCapabilities } from '../../clients/client-capabilities';

type ScheduleWindow = { day: number; start: string; end: string };
type ServiceConfig = { id: string; name: string; durationMinutes?: number; capacity?: number };
type ResourceConfig = { id: string; name: string; capacity?: number; windows?: ScheduleWindow[] };
type FieldConfig = { id: string; type: string; label: string; required?: boolean; internal?: boolean; options?: string[] };
type DesignConfig = {
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  textColor?: string;
  title?: string;
  welcome?: string;
  confirmationMessage?: string;
  logoUrl?: string;
  backgroundImage?: string;
  backgroundMode?: string;
  backgroundGradient?: string;
  backgroundOpacity?: string;
  backgroundPosition?: string;
  backgroundSize?: string;
  layoutPosition?: string;
  logoPosition?: string;
  buttonRadius?: string;
  fieldRadius?: string;
  fontFamily?: string;
};

const FIELD_TYPES = new Set(['text', 'textarea', 'email', 'phone', 'select', 'multi_select', 'number', 'date', 'consent', 'coupon']);
// Only reservations that still own a future slot consume capacity.
const ACTIVE_STATUSES = ['pending', 'confirmed', 'rescheduled'];
const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled_client', 'cancelled_business', 'waitlist'],
  confirmed: ['rescheduled', 'cancelled_client', 'cancelled_business', 'attended', 'no_show'],
  rescheduled: ['confirmed', 'cancelled_client', 'cancelled_business', 'attended', 'no_show'],
  waitlist: ['confirmed', 'cancelled_client', 'cancelled_business'],
  attended: [], no_show: [], cancelled_client: [], cancelled_business: [],
};

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(ReservationForm) private readonly forms: Repository<ReservationForm>,
    @InjectRepository(Reservation) private readonly reservations: Repository<Reservation>,
    @InjectRepository(AvailabilityBlock) private readonly blocks: Repository<AvailabilityBlock>,
    @InjectRepository(ReservationEvent) private readonly events: Repository<ReservationEvent>,
    @InjectRepository(ReservationFormEvent) private readonly formEvents: Repository<ReservationFormEvent>,
    @InjectRepository(ReservationCoupon) private readonly coupons: Repository<ReservationCoupon>,
    private readonly dataSource: DataSource,
    private readonly leadIntake: LeadIntakeService,
    private readonly calendar: GoogleCalendarService,
    private readonly metaOutbox: MetaConversionOutboxService,
    private readonly clientPixels: MetaClientPixelService,
    private readonly notifications: NotificationService,
    private readonly emails: EmailService,
  ) {}

  private slug(value: string) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 140); }
  private scope(organizationId: string, clientId?: string, clientIds?: string[]) { return { organizationId, ...(clientId ? { clientId } : clientIds !== undefined ? { clientId: In(clientIds) } : {}) }; }
  private sqlClientScope(clientId?: string, clientIds?: string[]) {
    if (clientId) return { clause: ' AND client_id = ?', params: [clientId] };
    if (clientIds === undefined) return { clause: '', params: [] as string[] };
    if (clientIds.length === 0) return { clause: ' AND 1 = 0', params: [] as string[] };
    return { clause: ` AND client_id IN (${clientIds.map(() => '?').join(',')})`, params: clientIds };
  }
  private minutes(value: string) { const match = /^(\d{2}):(\d{2})$/.exec(value); if (!match) return -1; const total = Number(match[1]) * 60 + Number(match[2]); return Number(match[1]) < 24 && Number(match[2]) < 60 ? total : -1; }
  private configs(form: ReservationForm) { return { services: (form.servicesConfig || []) as ServiceConfig[], resources: (form.resourcesConfig || []) as ResourceConfig[] }; }

  private validateConfiguration(form: Pick<ReservationForm, 'timezone'|'fieldSchema'|'designConfig'|'scheduleConfig'|'servicesConfig'|'resourcesConfig'|'durationMinutes'|'bufferMinutes'|'capacityPerSlot'>) {
    assertTimeZone(form.timezone);
    const fields = form.fieldSchema as FieldConfig[];
    if (!Array.isArray(fields) || fields.length === 0 || fields.length > 80) throw new BadRequestException('El formulario debe contener entre 1 y 80 campos');
    const fieldIds = new Set<string>();
    for (const field of fields) {
      if (!field || typeof field.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(field.id) || fieldIds.has(field.id)) throw new BadRequestException('Los campos deben tener identificadores únicos y válidos');
      if (!FIELD_TYPES.has(field.type) || typeof field.label !== 'string' || !field.label.trim() || field.label.length > 180) throw new BadRequestException(`Configuración inválida en el campo ${field.id}`);
      if (['select', 'multi_select'].includes(field.type) && (!Array.isArray(field.options) || field.options.length < 1 || field.options.length > 100)) throw new BadRequestException(`El campo ${field.id} requiere opciones válidas`);
      if (field.options && (new Set(field.options).size !== field.options.length || field.options.some((option) => typeof option !== 'string' || !option.trim() || option.length > 180))) throw new BadRequestException(`El campo ${field.id} contiene opciones inválidas o duplicadas`);
      fieldIds.add(field.id);
    }
    if (!fields.some((field) => field.id === 'name' && field.required)) throw new BadRequestException('El nombre debe permanecer como campo obligatorio');
    if (!fields.some((field) => field.type === 'consent' && field.required)) throw new BadRequestException('El formulario requiere una aceptación de tratamiento de datos');
    const validateWindows = (windows: unknown, label: string) => {
      if (!Array.isArray(windows) || windows.length > 40) throw new BadRequestException(`${label} no es válida`);
      for (const window of windows as ScheduleWindow[]) if (!Number.isInteger(window.day) || window.day < 0 || window.day > 6 || this.minutes(window.start) < 0 || this.minutes(window.end) <= this.minutes(window.start)) throw new BadRequestException(`Existe una ventana horaria inválida en ${label}`);
      for (let day = 0; day < 7; day += 1) {
        const dayWindows = (windows as ScheduleWindow[]).filter((window) => window.day === day).sort((a, b) => this.minutes(a.start) - this.minutes(b.start));
        if (dayWindows.some((window, index) => index > 0 && this.minutes(window.start) < this.minutes(dayWindows[index - 1].end))) throw new BadRequestException(`${label} contiene horarios superpuestos`);
      }
    };
    const validateWindowsIfPresent = (windows: unknown, label: string) => { if (windows !== undefined && windows !== null) validateWindows(windows, label); };
    const windows = (form.scheduleConfig as { windows?: ScheduleWindow[] })?.windows;
    validateWindowsIfPresent(windows, 'La agenda semanal');
    for (const collection of [form.servicesConfig || [], form.resourcesConfig || []] as Array<Array<{ id?: unknown; name?: unknown; durationMinutes?: unknown; capacity?: unknown; windows?: unknown }>>) {
      const ids = new Set<string>();
      for (const item of collection) {
        if (typeof item?.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(item.id) || ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 180) throw new BadRequestException('Servicios y recursos requieren ID y nombre únicos');
        if (item.durationMinutes !== undefined && (!Number.isInteger(item.durationMinutes) || Number(item.durationMinutes) < 5 || Number(item.durationMinutes) > 1440)) throw new BadRequestException('La duración del servicio no es válida');
        if (item.capacity !== undefined && (!Number.isInteger(item.capacity) || Number(item.capacity) < 1 || Number(item.capacity) > 500)) throw new BadRequestException('La capacidad del servicio o recurso no es válida');
        if (item.windows !== undefined && item.windows !== null) validateWindowsIfPresent(item.windows, `La agenda de ${item.name}`);
        ids.add(item.id);
      }
    }
    const design = form.designConfig as DesignConfig;
    for (const color of [design.primaryColor, design.accentColor, design.backgroundColor, design.textColor].filter(Boolean)) if (!/^#[0-9a-fA-F]{6}$/.test(color!)) throw new BadRequestException('Los colores deben usar formato hexadecimal');
    if (design.title && design.title.length > 180 || design.welcome && design.welcome.length > 1200 || design.confirmationMessage && design.confirmationMessage.length > 1200) throw new BadRequestException('Los textos de diseño exceden el largo permitido');
    if (design.backgroundMode && !['color', 'gradient', 'image'].includes(design.backgroundMode)) throw new BadRequestException('El tipo de fondo no es válido');
    if (design.backgroundGradient && (design.backgroundGradient.length > 500 || !/^linear-gradient\(/i.test(design.backgroundGradient.trim()))) throw new BadRequestException('El degradado de fondo no es válido');
    if (design.backgroundOpacity !== undefined && (!Number.isFinite(Number(design.backgroundOpacity)) || Number(design.backgroundOpacity) < 0 || Number(design.backgroundOpacity) > 100)) throw new BadRequestException('La opacidad de fondo no es válida');
    if (design.backgroundPosition && !['center', 'top', 'bottom', 'left', 'right'].includes(design.backgroundPosition)) throw new BadRequestException('La posición del fondo no es válida');
    if (design.buttonRadius !== undefined && (!Number.isFinite(Number(design.buttonRadius)) || Number(design.buttonRadius) < 0 || Number(design.buttonRadius) > 999)) throw new BadRequestException('La forma de botones no es válida');
    if (design.fieldRadius !== undefined && (!Number.isFinite(Number(design.fieldRadius)) || Number(design.fieldRadius) < 0 || Number(design.fieldRadius) > 80)) throw new BadRequestException('La forma de campos no es válida');
    if (design.fontFamily && (design.fontFamily.length > 120 || /[;{}]/.test(design.fontFamily))) throw new BadRequestException('La tipografía no es válida');
    const isValidImageUrl = (url?: string) => !url || (/^https:\/\//i.test(url) && url.length <= 2048);
    if (!isValidImageUrl(design.logoUrl)) throw new BadRequestException('El logo debe usar una URL HTTPS válida');
    if (!isValidImageUrl(design.backgroundImage)) throw new BadRequestException('La imagen de fondo debe usar una URL HTTPS válida');
  }

  private validateAnswers(form: ReservationForm, answers: Record<string, unknown>): void {
    const fields = (form.fieldSchema as FieldConfig[]).filter((f) => f.type !== 'coupon'); const byId = new Map(fields.map((field) => [field.id, field]));
    const keys = Object.keys(answers); if (keys.length > fields.length || keys.some((key) => !byId.has(key))) throw new BadRequestException('Las respuestas contienen campos no publicados');
    for (const [key, value] of Object.entries(answers)) {
      const field = byId.get(key)!;
      if (typeof value === 'string' && value.length > 5000) throw new BadRequestException(`La respuesta de ${field.label} es demasiado extensa`);
      if (Array.isArray(value) && (value.length > 100 || value.some((entry) => typeof entry !== 'string' || entry.length > 500))) throw new BadRequestException(`La respuesta de ${field.label} no es válida`);
      if (field.type === 'number' && (typeof value !== 'number' && typeof value !== 'string' || !Number.isFinite(Number(value)))) throw new BadRequestException(`La respuesta de ${field.label} debe ser numérica`);
      if (field.type === 'consent' && typeof value !== 'boolean') throw new BadRequestException(`La respuesta de ${field.label} debe ser una aceptación`);
    }
  }

  private async assertClientOwnership(organizationId: string, clientId: string) {
    const rows = await this.dataSource.query('SELECT id FROM clients WHERE id = ? AND organization_id = ? LIMIT 1', [clientId, organizationId]);
    if (!Array.isArray(rows) || rows.length === 0) throw new ForbiddenException('El cliente no pertenece a esta organización');
  }

  private async clientCapabilities(organizationId: string, clientId: string) {
    const rows = await this.dataSource.query('SELECT capabilities FROM clients WHERE id = ? AND organization_id = ? LIMIT 1', [clientId, organizationId]);
    if (!Array.isArray(rows) || rows.length === 0) throw new ForbiddenException('El cliente no pertenece a esta organización');
    const raw = rows[0]?.capabilities;
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return normalizeClientCapabilities(parsed);
  }

  private async uniqueSlug(baseValue: string) {
    const base = this.slug(baseValue) || 'reservas'; let candidate = base;
    while (await this.forms.exist({ where: { publicSlug: candidate } })) candidate = `${base}-${randomBytes(4).toString('hex')}`;
    return candidate;
  }

  async createForm(organizationId: string, userId: string, dto: CreateReservationFormDto) {
    await this.assertClientOwnership(organizationId, dto.clientId);
    const capabilities = await this.clientCapabilities(organizationId, dto.clientId);
    if (!capabilities.reservations) throw new ForbiddenException('Reservas no está habilitado para esta empresa');
    const form = this.forms.create({
      organizationId, clientId: dto.clientId, createdBy: userId, name: dto.name.trim(), publicSlug: await this.uniqueSlug(dto.publicSlug || dto.name), mode: dto.mode || 'appointment',
      fieldSchema: [{ id: 'name', type: 'text', label: 'Nombre completo', required: true, system: true }, { id: 'email', type: 'email', label: 'Correo', required: false, system: true }, { id: 'phone', type: 'phone', label: 'Teléfono', required: true, system: true }, { id: 'consent', type: 'consent', label: 'Acepto el tratamiento de mis datos para gestionar esta reserva.', required: true }],
      designConfig: { primaryColor: '#173f35', accentColor: '#ea0f63', backgroundColor: '#f3f5ef', textColor: '#3f4e49', title: dto.name, welcome: 'Elige el horario que mejor te acomode.', backgroundMode: 'gradient', backgroundGradient: 'linear-gradient(135deg, #f3f5ef 0%, #dce9df 100%)', backgroundOpacity: '88', backgroundPosition: 'center', buttonRadius: '12', fieldRadius: '10', fontFamily: 'system-ui' },
      scheduleConfig: { windows: [1,2,3,4,5].map((day) => ({ day, start: '09:00', end: '18:00' })) }, servicesConfig: [], resourcesConfig: [], crmEnabled: capabilities.crm, calendarEnabled: false, metaCapiEnabled: false,
    });
    this.validateConfiguration(form); return this.forms.save(form);
  }

  listForms(organizationId: string, clientId?: string, clientIds?: string[]) { return this.forms.find({ where: this.scope(organizationId, clientId, clientIds), order: { updatedAt: 'DESC' } }); }
  async getForm(organizationId: string, id: string, clientId?: string, clientIds?: string[]) { const form = await this.forms.findOne({ where: { id, ...this.scope(organizationId, clientId, clientIds) } }); if (!form) throw new NotFoundException('Formulario no encontrado'); return form; }
  async updateForm(organizationId: string, id: string, dto: UpdateReservationFormDto, clientId?: string, clientIds?: string[]) {
    const form = await this.getForm(organizationId, id, clientId, clientIds);
    const capabilities = await this.clientCapabilities(organizationId, form.clientId);
    if (!capabilities.reservations) throw new ForbiddenException('Reservas no está habilitado para esta empresa');
    if (dto.crmEnabled && !capabilities.crm) throw new BadRequestException('CRM no está habilitado para esta empresa');
    if (dto.metaCapiEnabled && !capabilities.metaConversions) throw new BadRequestException('Meta Pixel + CAPI no está habilitado para esta empresa');
    Object.assign(form, Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)));
    if (!capabilities.crm) form.crmEnabled = false;
    if (!capabilities.metaConversions) form.metaCapiEnabled = false;
    this.validateConfiguration(form);
    if (dto.status === 'published' && ((form.scheduleConfig as { windows?: unknown[] }).windows?.length || 0) === 0) throw new BadRequestException('No puedes publicar sin disponibilidad');
    return this.forms.save(form);
  }
  async duplicateForm(organizationId: string, id: string, userId: string, clientIds?: string[]) { const source = await this.getForm(organizationId, id, undefined, clientIds); const copy = this.forms.create({ ...source, id: undefined, name: `${source.name} (copia)`, publicSlug: await this.uniqueSlug(source.publicSlug), status: 'draft', createdBy: userId, createdAt: undefined, updatedAt: undefined }); return this.forms.save(copy); }

  async addBlock(organizationId: string, formId: string, userId: string, dto: CreateBlockDto, clientId?: string, clientIds?: string[]) { const form = await this.getForm(organizationId, formId, clientId, clientIds); const startsAt = new Date(dto.startsAt); const endsAt = new Date(dto.endsAt); if (Number.isNaN(startsAt.getTime()) || endsAt <= startsAt) throw new BadRequestException('El fin debe ser posterior al inicio'); return this.blocks.save(this.blocks.create({ organizationId, clientId: form.clientId, formId, createdBy: userId, startsAt, endsAt, reason: dto.reason })); }
  async listBlocks(organizationId: string, formId: string, clientId?: string, clientIds?: string[]) { await this.getForm(organizationId, formId, clientId, clientIds); return this.blocks.find({ where: { organizationId, formId }, order: { startsAt: 'ASC' } }); }
  async removeBlock(organizationId: string, id: string, clientId?: string, clientIds?: string[]) { const block = await this.blocks.findOne({ where: { id, ...this.scope(organizationId, clientId, clientIds) } }); if (!block) throw new NotFoundException('Bloqueo no encontrado'); await this.blocks.remove(block); return { deleted: true }; }

  private async publishedForm(slug: string, manager?: EntityManager, lock = false) {
    const repo = manager?.getRepository(ReservationForm) || this.forms;
    const qb = repo.createQueryBuilder('form').where('form.public_slug = :slug AND form.status = :status', { slug, status: 'published' }); if (lock) qb.setLock('pessimistic_write');
    const form = await qb.getOne(); if (!form) throw new NotFoundException('Este formulario no está disponible');
    const capabilities = await this.clientCapabilities(form.organizationId, form.clientId);
    if (!capabilities.reservations) throw new NotFoundException('Este formulario no está disponible');
    this.validateConfiguration(form); return form;
  }
  async publicForm(slug: string) {
    const form = await this.publishedForm(slug);
    const capabilities = await this.clientCapabilities(form.organizationId, form.clientId);
    const meta = capabilities.metaConversions
      ? await this.getClientMetaConfig(form.clientId, form.organizationId)
      : { pixelId: '', pixelName: null as string | null, accessToken: undefined as string | undefined };
    return { name: form.name, publicSlug: form.publicSlug, mode: form.mode, timezone: form.timezone, durationMinutes: form.durationMinutes, capacityPerSlot: form.capacityPerSlot, confirmationMode: form.confirmationMode, fieldSchema: (form.fieldSchema as FieldConfig[]).filter((field) => !field.internal), designConfig: form.designConfig, servicesConfig: form.servicesConfig, resourcesConfig: form.resourcesConfig, pixelId: meta.pixelId, pixelName: meta.pixelName || null, metaReady: Boolean(meta.pixelId && meta.accessToken) };
  }

  async formContext(organizationId: string, clientId: string) {
    const capabilities = await this.clientCapabilities(organizationId, clientId);
    const { pixelId, pixelName, accessToken } = capabilities.metaConversions ? await this.getClientMetaConfig(clientId, organizationId) : { pixelId: '', pixelName: null, accessToken: undefined };
    return { capabilities, pixelId: pixelId || null, pixelName: pixelName || null, metaReady: Boolean(pixelId && accessToken) };
  }

  private effectiveRules(form: ReservationForm, serviceId?: string, resourceId?: string) {
    const { services, resources } = this.configs(form); const service = serviceId ? services.find((item) => item.id === serviceId) : undefined; const resource = resourceId ? resources.find((item) => item.id === resourceId) : undefined;
    if (serviceId && !service) throw new BadRequestException('Servicio inválido'); if (resourceId && !resource) throw new BadRequestException('Recurso inválido');
    return { duration: service?.durationMinutes || form.durationMinutes, capacity: Math.max(1, Math.min(service?.capacity || form.capacityPerSlot, resource?.capacity || form.capacityPerSlot)), windows: resource?.windows || ((form.scheduleConfig as { windows: ScheduleWindow[] }).windows), service, resource };
  }

  private assertScheduled(form: ReservationForm, startsAt: Date, serviceId?: string, resourceId?: string) {
    const rules = this.effectiveRules(form, serviceId, resourceId); const local = zonedParts(startsAt, form.timezone); const minute = local.hour * 60 + local.minute;
    const window = rules.windows.find((item) => item.day === local.weekday && minute >= this.minutes(item.start) && minute + rules.duration <= this.minutes(item.end));
    if (!window || (minute - this.minutes(window.start)) % (rules.duration + form.bufferMinutes) !== 0) throw new BadRequestException('El horario no pertenece a la disponibilidad publicada');
    const now = Date.now(); if (startsAt.getTime() < now + form.minimumNoticeHours * 3600000 || startsAt.getTime() > now + form.maximumAdvanceDays * 86400000) throw new BadRequestException('El horario está fuera del rango permitido');
    return rules;
  }

  private localDateKey(date: Date, timeZone: string) {
    const { year, month, day } = zonedParts(date, timeZone);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private async getClientMetaConfig(clientId: string, organizationId: string) {
    return this.clientPixels.resolve(organizationId, clientId);
  }

  async createManual(organizationId: string, userId: string, dto: CreateManualReservationDto, clientId?: string, clientIds?: string[]) {
    const form = await this.getForm(organizationId, dto.formId, clientId, clientIds);
    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Fecha inválida');
    const partySize = dto.partySize || 1;
    const result = await this.dataSource.transaction(async (manager) => {
      let endsAt: Date;
      if (dto.skipAvailability) {
        const rules = this.effectiveRules(form, dto.serviceId, dto.resourceId);
        endsAt = new Date(startsAt.getTime() + rules.duration * 60000);
      } else {
        const available = await this.availability(manager, form, startsAt, partySize, dto.serviceId, dto.resourceId);
        endsAt = available.endsAt;
      }
      const booking = await manager.save(Reservation, manager.create(Reservation, {
        organizationId, clientId: form.clientId, formId: form.id, referenceCode: randomBytes(6).toString('hex').toUpperCase(),
        status: 'confirmed', startsAt, endsAt, partySize,
        guestName: dto.guestName.trim(), guestEmail: dto.guestEmail?.trim().toLowerCase(), guestPhone: dto.guestPhone?.replace(/[^\d+]/g, ''),
        serviceId: dto.serviceId, resourceId: dto.resourceId, answers: dto.answers || {}, internalNotes: dto.internalNotes,
      }));
      await manager.save(ReservationEvent, manager.create(ReservationEvent, { organizationId, clientId: form.clientId, reservationId: booking.id, type: 'created', toStatus: 'confirmed', actorId: userId, actorType: 'team', metadata: { startsAt: startsAt.toISOString(), serviceId: dto.serviceId, resourceId: dto.resourceId, manual: true, skipAvailability: dto.skipAvailability } }));
      return { booking, form };
    });
    await this.notifyNewBooking(result.form, result.booking);
    return result.booking;
  }

  private async dailyReservationsCount(manager: EntityManager, formId: string, dateKey: string, timeZone: string, excludeId?: string) {
    const start = localToUtc(dateKey, '00:00', timeZone);
    const end = localToUtc(dateKey, '23:59:59', timeZone);
    const qb = manager.getRepository(Reservation).createQueryBuilder('r')
      .where('r.form_id = :formId AND r.starts_at >= :start AND r.starts_at <= :end AND r.status IN (:...statuses)', { formId, start, end, statuses: ACTIVE_STATUSES });
    if (excludeId) qb.andWhere('r.id != :excludeId', { excludeId });
    return qb.getCount();
  }

  private async availability(manager: EntityManager, form: ReservationForm, startsAt: Date, partySize: number, serviceId?: string, resourceId?: string, excludeId?: string) {
    const rules = this.assertScheduled(form, startsAt, serviceId, resourceId); const endsAt = new Date(startsAt.getTime() + rules.duration * 60000);
    const blockCount = await manager.getRepository(AvailabilityBlock).createQueryBuilder('b').where('b.form_id = :formId AND b.starts_at < :endsAt AND b.ends_at > :startsAt', { formId: form.id, startsAt, endsAt }).getCount(); if (blockCount) throw new ConflictException('El horario está bloqueado');
    if (form.dailyCapacity > 0) {
      const dateKey = this.localDateKey(startsAt, form.timezone);
      const dailyCount = await this.dailyReservationsCount(manager, form.id, dateKey, form.timezone, excludeId);
      if (dailyCount >= form.dailyCapacity) throw new ConflictException('Este día ya alcanzó su tope de reservas');
    }
    const qb = manager.getRepository(Reservation).createQueryBuilder('r').where('r.form_id = :formId AND r.starts_at < :endsAt AND r.ends_at > :startsAt AND r.status IN (:...statuses)', { formId: form.id, startsAt, endsAt, statuses: ACTIVE_STATUSES });
    if (resourceId) qb.andWhere('r.resource_id = :resourceId', { resourceId }); if (excludeId) qb.andWhere('r.id != :excludeId', { excludeId });
    const existing = await qb.getMany(); const used = existing.reduce((sum, item) => sum + item.partySize, 0); if (used + partySize > rules.capacity) throw new ConflictException('Ese horario acaba de ocuparse. Selecciona una alternativa.'); return { ...rules, endsAt, available: rules.capacity - used };
  }

  async slots(slug: string, from: string, days = 14, serviceId?: string, resourceId?: string) {
    const form = await this.publishedForm(slug); if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new BadRequestException('Fecha inválida'); const rules = this.effectiveRules(form, serviceId, resourceId); const count = Math.min(Math.max(days, 1), 31);
    const rangeStart = localToUtc(from, '00:00', form.timezone); const rangeEnd = localToUtc(addPlainDays(from, count), '00:00', form.timezone);
    const existingQb = this.reservations.createQueryBuilder('r').where('r.form_id = :formId AND r.starts_at >= :start AND r.starts_at < :end AND r.status IN (:...statuses)', { formId: form.id, start: rangeStart, end: rangeEnd, statuses: ACTIVE_STATUSES }); if (resourceId) existingQb.andWhere('r.resource_id = :resourceId', { resourceId });
    const [existing, blocks] = await Promise.all([existingQb.getMany(), this.blocks.createQueryBuilder('b').where('b.form_id = :formId AND b.starts_at < :end AND b.ends_at > :start', { formId: form.id, start: rangeStart, end: rangeEnd }).getMany()]);
    const dailyCounts = new Map<string, number>();
    if (form.dailyCapacity > 0) {
      for (const item of existing) {
        const key = this.localDateKey(item.startsAt, form.timezone);
        dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
      }
    }
    const result: Array<{ startsAt: string; available: number }> = [];
    for (let offset = 0; offset < count; offset += 1) { const date = addPlainDays(from, offset); const { weekday } = plainDateParts(date); if (form.dailyCapacity > 0 && (dailyCounts.get(date) ?? 0) >= form.dailyCapacity) continue; for (const window of rules.windows.filter((item) => item.day === weekday)) { for (let minute = this.minutes(window.start); minute + rules.duration <= this.minutes(window.end); minute += rules.duration + form.bufferMinutes) { const startsAt = localToUtc(date, `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`, form.timezone); const endsAt = new Date(startsAt.getTime() + rules.duration * 60000); if (startsAt.getTime() < Date.now() + form.minimumNoticeHours * 3600000 || startsAt.getTime() > Date.now() + form.maximumAdvanceDays * 86400000) continue; if (blocks.some((block) => block.startsAt < endsAt && block.endsAt > startsAt)) continue; const used = existing.filter((item) => item.startsAt < endsAt && item.endsAt > startsAt).reduce((sum, item) => sum + item.partySize, 0); if (used < rules.capacity) result.push({ startsAt: startsAt.toISOString(), available: rules.capacity - used }); } } }
    return result;
  }

  async trackPublicEvent(slug: string, dto: PublicFormEventDto) {
    const form = await this.publishedForm(slug);
    if (dto.sessionId) {
      const existing = await this.formEvents.findOne({ where: { formId: form.id, type: dto.type, sessionId: dto.sessionId } });
      if (existing) return existing;
    }
    return this.formEvents.save(this.formEvents.create({ organizationId: form.organizationId, clientId: form.clientId, formId: form.id, type: dto.type, sessionId: dto.sessionId, utmSource: dto.utmSource, utmCampaign: dto.utmCampaign }));
  }

  async createPublic(slug: string, dto: PublicReservationDto, ipAddress?: string, userAgent?: string, eventSourceUrl?: string) {
    if (dto.website) throw new BadRequestException('Solicitud inválida'); if (dto.renderedAt && Date.now() - new Date(dto.renderedAt).getTime() < 1200) throw new BadRequestException('Completa el formulario antes de enviarlo');
    const result = await this.dataSource.transaction(async (manager) => {
      const form = await this.publishedForm(slug, manager, true); const existingIdempotent = await manager.getRepository(Reservation).findOne({ where: { formId: form.id, idempotencyKey: dto.idempotencyKey } }); if (existingIdempotent) return { booking: existingIdempotent, form, created: false };
      const startsAt = new Date(dto.startsAt); if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Fecha inválida'); const partySize = dto.partySize || 1; const availability = await this.availability(manager, form, startsAt, partySize, dto.serviceId, dto.resourceId);
      this.validateAnswers(form, dto.answers);
      for (const field of form.fieldSchema as FieldConfig[]) {
        const value = field.id === 'name' ? dto.guestName : field.id === 'email' ? dto.guestEmail : field.id === 'phone' ? dto.guestPhone : dto.answers[field.id];
        const empty = value == null || value === '' || value === false || (Array.isArray(value) && value.length === 0);
        if (field.required && empty) throw new BadRequestException(`Falta completar ${field.label}`);
        if (empty) continue;
        if (field.type === 'select' && field.options && !field.options.includes(String(value))) throw new BadRequestException(`Respuesta inválida en ${field.label}`);
        if (field.type === 'multi_select' && field.options && (!Array.isArray(value) || value.some((entry) => !field.options!.includes(String(entry))))) throw new BadRequestException(`Respuesta inválida en ${field.label}`);
        if (field.type === 'email' && typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new BadRequestException(`Correo inválido en ${field.label}`);
      }
      const coupon = await this.validateCoupon(dto.couponCode, form, manager);
      if (coupon) { coupon.usageCount += 1; await manager.save(ReservationCoupon, coupon); }
      const status = form.confirmationMode === 'manual' ? 'pending' : 'confirmed'; const booking = await manager.save(Reservation, manager.create(Reservation, { organizationId: form.organizationId, clientId: form.clientId, formId: form.id, idempotencyKey: dto.idempotencyKey, referenceCode: randomBytes(6).toString('hex').toUpperCase(), status, startsAt, endsAt: availability.endsAt, partySize, guestName: dto.guestName.trim(), guestEmail: dto.guestEmail?.trim().toLowerCase(), guestPhone: dto.guestPhone?.replace(/[^\d+]/g, ''), serviceId: dto.serviceId, resourceId: dto.resourceId, answers: dto.answers, consentVersion: dto.consentVersion, utmSource: dto.utmSource, utmMedium: dto.utmMedium, utmCampaign: dto.utmCampaign, utmContent: dto.utmContent, clickId: dto.clickId, fbc: dto.fbc, fbp: dto.fbp, clientIpAddress: ipAddress, clientUserAgent: userAgent, couponCode: coupon?.code }));
      await manager.save(ReservationEvent, manager.create(ReservationEvent, { organizationId: form.organizationId, clientId: form.clientId, reservationId: booking.id, type: 'created', toStatus: status, actorType: 'guest', metadata: { startsAt: startsAt.toISOString(), serviceId: dto.serviceId, resourceId: dto.resourceId } })); return { booking, form, created: true };
    });
    const capabilities = await this.clientCapabilities(result.form.organizationId, result.form.clientId);
    if (result.created && result.form.crmEnabled && capabilities.crm) { try { await this.leadIntake.captureLead({ organizationId: result.form.organizationId, clientId: result.form.clientId, name: result.booking.guestName, email: result.booking.guestEmail, phone: result.booking.guestPhone, source: 'vitahub_reservations', sourceDetail: result.form.name, status: 'reserved', externalLeadId: `reservation:${result.booking.id}`, externalFormId: result.form.id, externalCampaignId: result.form.campaignId, campaignName: result.booking.utmCampaign, consentCapturedAt: new Date(), metadata: { reservationId: result.booking.id, referenceCode: result.booking.referenceCode, startsAt: result.booking.startsAt } }); } catch { await this.recordIntegrationFailure(result.booking, 'crm'); } }
    if (result.created && result.form.calendarEnabled) { try { const event = await this.calendar.createEvent(result.form.organizationId, { summary: `${result.form.name}: ${result.booking.guestName}`, description: `Reserva ${result.booking.referenceCode}`, start: result.booking.startsAt, durationMinutes: Math.round((result.booking.endsAt.getTime() - result.booking.startsAt.getTime()) / 60000) }); result.booking.calendarEventId = event.externalId; result.booking.calendarUrl = event.calendarUrl; await this.reservations.save(result.booking); } catch { await this.recordIntegrationFailure(result.booking, 'google_calendar'); } }
    if (result.created && result.form.metaCapiEnabled && capabilities.metaConversions) {
      try {
        await this.enqueueMetaConversion(result.booking, result.form, 'Schedule', Math.floor(result.booking.createdAt.getTime() / 1000), eventSourceUrl);
        void this.metaOutbox.processPending(1);
      } catch { await this.recordIntegrationFailure(result.booking, 'meta_capi'); }
    }
    if (result.created) await this.notifyNewBooking(result.form, result.booking);
    return result.booking;
  }

  private async recordIntegrationFailure(booking: Reservation, provider: string) { await this.events.save(this.events.create({ organizationId: booking.organizationId, clientId: booking.clientId, reservationId: booking.id, type: 'integration_failed', actorType: 'system', metadata: { provider } })); }

  private async enqueueMetaConversion(booking: Reservation, form: ReservationForm, eventName: string, eventTime?: number, eventSourceUrl?: string) {
    const { pixelId } = await this.getClientMetaConfig(form.clientId, form.organizationId);
    if (!pixelId) throw new Error('Meta pixel is not configured');
    await this.metaOutbox.enqueue(form.organizationId, pixelId, {
      eventName, eventTime: eventTime ?? Math.floor(Date.now() / 1000), actionSource: eventName === 'Schedule' ? 'website' : 'system_generated', eventSourceUrl,
      userData: {
        em: booking.guestEmail ? [booking.guestEmail] : undefined,
        ph: booking.guestPhone ? [booking.guestPhone] : undefined,
        externalId: [booking.id],
        fbc: booking.fbc ?? undefined,
        fbp: booking.fbp ?? undefined,
        client_ip_address: booking.clientIpAddress ?? undefined,
        client_user_agent: booking.clientUserAgent ?? undefined,
      },
      customData: { contentIds: [form.id], contentType: 'reservation' }, eventId: `${eventName.toLowerCase()}:${booking.id}`,
    });
  }

  private async notifyNewBooking(form: ReservationForm, booking: Reservation): Promise<void> {
    try {
      const rows = await this.dataSource.query(`SELECT DISTINCT id FROM users WHERE organization_id = ? AND is_active = 1 AND (client_id = ? OR id = (SELECT community_manager_id FROM clients WHERE id = ? AND organization_id = ?))`, [form.organizationId, form.clientId, form.clientId, form.organizationId]);
      const userIds = (rows as Array<{ id: string }>).map((row) => row.id).filter(Boolean);
      if (userIds.length === 0) return;
      await this.notifications.notifyMultiple(form.organizationId, userIds, 'reservation_created', 'Nueva reserva recibida', `${booking.guestName} reservó ${form.name} para el ${booking.startsAt.toLocaleString('es-CL')}.`, { reservationId: booking.id, formId: form.id, clientId: form.clientId, referenceCode: booking.referenceCode });
      const teamEmails = (form.teamNotifications || []).filter((email) => typeof email === 'string' && email.includes('@'));
      if (teamEmails.length > 0) {
        const html = `<h2>Nueva reserva recibida</h2><p><strong>${booking.guestName}</strong> reservó <strong>${form.name}</strong>.</p><p>Fecha: ${booking.startsAt.toLocaleString('es-CL')}<br>Personas: ${booking.partySize}<br>Código: ${booking.referenceCode}</p>`;
        await Promise.all(teamEmails.map((email) => this.emails.send(email, `Nueva reserva - ${form.name}`, html)));
      }
    } catch {
      // Notifications are helpful but must never roll back a confirmed booking.
    }
  }

  async listReservations(organizationId: string, query: ListReservationsDto, clientId?: string, clientIds?: string[], includeInternalNotes = true) {
    const page = query.page ?? 1; const pageSize = query.pageSize ?? 50; const qb = this.reservations.createQueryBuilder('r').where('r.organization_id = :organizationId', { organizationId }); if (clientId) qb.andWhere('r.client_id = :clientId', { clientId }); else if (clientIds !== undefined) qb.andWhere(clientIds.length ? 'r.client_id IN (:...clientIds)' : '1 = 0', { clientIds }); if (query.formId) qb.andWhere('r.form_id = :formId', { formId: query.formId }); if (query.status) qb.andWhere('r.status = :status', { status: query.status }); if (query.from) qb.andWhere('r.starts_at >= :from', { from: query.from }); if (query.to) qb.andWhere('r.starts_at <= :to', { to: query.to });     if (query.search) qb.andWhere('(r.guest_name LIKE :search OR r.guest_email LIKE :search OR r.guest_phone LIKE :search OR r.reference_code LIKE :search)', { search: `%${query.search}%` }); if (query.couponCode) qb.andWhere('r.coupon_code = :couponCode', { couponCode: query.couponCode }); const [items, total] = await qb.orderBy('r.starts_at', 'DESC').skip((page - 1) * pageSize).take(pageSize).getManyAndCount(); const safeItems = includeInternalNotes ? items : items.map(({ internalNotes: _internalNotes, ...item }) => item); return { items: safeItems, total, page, pageSize, pages: Math.ceil(total / pageSize) };
  }

  async updateReservation(organizationId: string, id: string, dto: UpdateReservationDto, actorId: string, actorType: string, clientId?: string, clientIds?: string[]) {
    let formForMeta: ReservationForm | undefined;
    let statusChangedTo: string | undefined;
    const saved = await this.dataSource.transaction(async (manager) => { const repo = manager.getRepository(Reservation); const qb = repo.createQueryBuilder('r').setLock('pessimistic_write').where('r.id = :id AND r.organization_id = :organizationId', { id, organizationId }); if (clientId) qb.andWhere('r.client_id = :clientId', { clientId }); else if (clientIds !== undefined) qb.andWhere(clientIds.length ? 'r.client_id IN (:...clientIds)' : '1 = 0', { clientIds }); const item = await qb.getOne(); if (!item) throw new NotFoundException('Reserva no encontrada'); const previousStatus = item.status; const previousStart = item.startsAt;
      if (dto.startsAt) {
        if (!['pending', 'confirmed', 'rescheduled', 'waitlist'].includes(item.status)) throw new ConflictException(`No se puede reagendar una reserva en estado ${item.status}`);
        const form = await manager.getRepository(ReservationForm).findOneByOrFail({ id: item.formId, organizationId }); const startsAt = new Date(dto.startsAt); const available = await this.availability(manager, form, startsAt, item.partySize, item.serviceId, item.resourceId, item.id); item.startsAt = startsAt; item.endsAt = available.endsAt; item.status = 'rescheduled';
      }
      if (dto.status && dto.status !== item.status) {
        if (!STATUS_TRANSITIONS[item.status]?.includes(dto.status)) throw new ConflictException(`No se puede pasar de ${item.status} a ${dto.status}`);
        if (item.status === 'waitlist' && dto.status === 'confirmed') {
          const form = await manager.getRepository(ReservationForm).findOneByOrFail({ id: item.formId, organizationId });
          await this.availability(manager, form, item.startsAt, item.partySize, item.serviceId, item.resourceId, item.id);
        }
        if (dto.status === 'attended') {
          formForMeta = await manager.getRepository(ReservationForm).findOneByOrFail({ id: item.formId, organizationId });
        }
        statusChangedTo = dto.status;
        item.status = dto.status;
      }
      if (dto.internalNotes !== undefined) item.internalNotes = dto.internalNotes; const result = await repo.save(item); const changedStart = previousStart.getTime() !== result.startsAt.getTime(); if (previousStatus !== result.status || changedStart) await manager.save(ReservationEvent, manager.create(ReservationEvent, { organizationId, clientId: result.clientId, reservationId: result.id, type: changedStart ? 'rescheduled' : 'status_changed', fromStatus: previousStatus, toStatus: result.status, actorId, actorType, metadata: changedStart ? { from: previousStart.toISOString(), to: result.startsAt.toISOString() } : undefined })); return result; });
    const capabilities = formForMeta ? await this.clientCapabilities(organizationId, formForMeta.clientId) : undefined;
    if (statusChangedTo === 'attended' && formForMeta?.metaCapiEnabled && capabilities?.metaConversions) { try { await this.enqueueMetaConversion(saved, formForMeta, 'Reserva_Asistida'); void this.metaOutbox.processPending(1); } catch { await this.recordIntegrationFailure(saved, 'meta_capi'); } }
    if (statusChangedTo === 'attended' || statusChangedTo === 'no_show') { try { await this.leadIntake.updateStatusByContact(organizationId, statusChangedTo === 'attended' ? 'attended' : 'no_show', saved.guestEmail, saved.guestPhone, saved.clientId); } catch { /* CRM sync is best-effort */ } }
    return saved;
  }
  async history(organizationId: string, reservationId: string, clientId?: string, clientIds?: string[]) { const reservation = await this.reservations.findOne({ where: { id: reservationId, ...this.scope(organizationId, clientId, clientIds) } }); if (!reservation) throw new NotFoundException('Reserva no encontrada'); return this.events.find({ where: { reservationId, organizationId }, order: { createdAt: 'DESC' } }); }
  async metrics(organizationId: string, clientId?: string, clientIds?: string[]) { const scoped = this.sqlClientScope(clientId, clientIds); const params = [organizationId, ...scoped.params]; const scope = scoped.clause; const [totals, daily, sources, funnel] = await Promise.all([this.dataSource.query(`SELECT COUNT(*) total, SUM(status='pending') pending, SUM(status='confirmed') confirmed, SUM(status='attended') attended, SUM(status='no_show') no_show, SUM(status='waitlist') waitlist, SUM(status LIKE 'cancelled%') cancelled FROM reservations WHERE organization_id = ?${scope} AND starts_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`, params), this.dataSource.query(`SELECT DATE(starts_at) day, HOUR(starts_at) hour, COUNT(*) total FROM reservations WHERE organization_id = ?${scope} AND starts_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY day,hour ORDER BY day`, params), this.dataSource.query(`SELECT COALESCE(utm_source,'direct') source, COALESCE(utm_campaign,'Sin campaña') campaign, COUNT(*) total, SUM(status='attended') attended FROM reservations WHERE organization_id = ?${scope} AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY source,campaign ORDER BY total DESC LIMIT 20`, params), this.dataSource.query(`SELECT SUM(type='view') views, SUM(type='start') starts FROM reservation_form_events WHERE organization_id = ?${scope} AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`, params)]); const total = Number(totals[0]?.total || 0); const views = Number(funnel[0]?.views || 0); return { totals: totals[0] || {}, daily, sources, funnel: { views, starts: Number(funnel[0]?.starts || 0), completed: total, conversionRate: views ? Math.round(total * 1000 / views) / 10 : null } }; }
  async exportCsv(organizationId: string, clientId?: string, clientIds?: string[]) {
    const qb = this.reservations.createQueryBuilder('r').where('r.organization_id = :organizationId', { organizationId });
    if (clientId) qb.andWhere('r.client_id = :clientId', { clientId });
    else if (clientIds !== undefined) qb.andWhere(clientIds.length ? 'r.client_id IN (:...clientIds)' : '1 = 0', { clientIds });
    const items = await qb.orderBy('r.starts_at', 'DESC').take(10000).getMany();
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    return [['codigo','nombre','correo','telefono','fecha','estado','origen','campana'], ...items.map((item) => [item.referenceCode,item.guestName,item.guestEmail,item.guestPhone,item.startsAt.toISOString(),item.status,item.utmSource,item.utmCampaign])].map((row) => row.map(escape).join(',')).join('\r\n');
  }

  async createCoupon(organizationId: string, userId: string, dto: CreateCouponDto, clientId?: string) {
    const code = dto.code.trim().toUpperCase();
    const exists = await this.coupons.findOne({ where: { organizationId, code } });
    if (exists) throw new ConflictException('Ya existe un cupón con ese código');
    const coupon = this.coupons.create({ organizationId, clientId, code, discountType: dto.discountType || 'percentage', value: dto.value ?? 0, maxUses: dto.maxUses ?? 0, validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined, validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined, formIds: dto.formIds });
    return this.coupons.save(coupon);
  }

  async updateCoupon(organizationId: string, id: string, dto: UpdateCouponDto) {
    const coupon = await this.coupons.findOne({ where: { id, organizationId } });
    if (!coupon) throw new NotFoundException('Cupón no encontrado');
    Object.assign(coupon, Object.fromEntries(Object.entries(dto).filter(([, value]) => value !== undefined)));
    return this.coupons.save(coupon);
  }

  listCoupons(organizationId: string, clientId?: string) {
    const where: Record<string, unknown> = { organizationId };
    if (clientId) where.clientId = clientId;
    return this.coupons.find({ where, order: { createdAt: 'DESC' } });
  }

  async validatePublicCoupon(slug: string, code: string) {
    const form = await this.publishedForm(slug);
    const coupon = await this.coupons.findOne({ where: { organizationId: form.organizationId, code: code.trim().toUpperCase(), active: true } });
    if (!coupon) throw new BadRequestException('Cupón no válido');
    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) throw new BadRequestException('El cupón aún no está activo');
    if (coupon.validUntil && now > coupon.validUntil) throw new BadRequestException('El cupón ha expirado');
    if (coupon.maxUses > 0 && coupon.usageCount >= coupon.maxUses) throw new BadRequestException('El cupón ya no tiene usos disponibles');
    if (coupon.formIds && coupon.formIds.length > 0 && !coupon.formIds.includes(form.id)) throw new BadRequestException('El cupón no aplica para este formulario');
    if (coupon.validDaysOfWeek && coupon.validDaysOfWeek.length > 0) {
      const today = new Date().getDay();
      if (!coupon.validDaysOfWeek.includes(today)) throw new BadRequestException('El cupón no es válido para el día de hoy');
    }
    return { valid: true, discountType: coupon.discountType, value: coupon.value };
  }

  private async validateCoupon(code: string | undefined, form: ReservationForm, manager: EntityManager): Promise<ReservationCoupon | undefined> {
    if (!code) return undefined;
    const coupon = await manager.getRepository(ReservationCoupon).findOne({ where: { organizationId: form.organizationId, code: code.trim().toUpperCase(), active: true } });
    if (!coupon) throw new BadRequestException('Cupón no válido');
    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) throw new BadRequestException('El cupón aún no está activo');
    if (coupon.validUntil && now > coupon.validUntil) throw new BadRequestException('El cupón ha expirado');
    if (coupon.maxUses > 0 && coupon.usageCount >= coupon.maxUses) throw new BadRequestException('El cupón ya no tiene usos disponibles');
    if (coupon.formIds && coupon.formIds.length > 0 && !coupon.formIds.includes(form.id)) throw new BadRequestException('El cupón no aplica para este formulario');
    if (coupon.validDaysOfWeek && coupon.validDaysOfWeek.length > 0) {
      const today = new Date().getDay();
      if (!coupon.validDaysOfWeek.includes(today)) throw new BadRequestException('El cupón no es válido para el día de hoy');
    }
    return coupon;
  }
}
