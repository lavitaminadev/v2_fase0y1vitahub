import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { promises as dns } from 'dns';
import { ReservationForm } from '../domain/reservation-form.entity';
import { Reservation } from '../domain/reservation.entity';
import { AvailabilityBlock } from '../domain/availability-block.entity';
import { ReservationEvent } from '../domain/reservation-event.entity';
import { ReservationFormEvent } from '../domain/reservation-form-event.entity';
import { ReservationCoupon } from '../domain/reservation-coupon.entity';
import { addPlainDays, assertTimeZone, localToUtc, plainDateParts, zonedParts } from '../domain/timezone';
import { CreateBlockDto, CreateCouponDto, CreateManualReservationDto, CreateReservationFormDto, ListReservationsDto, PublicFormEventDto, PublicReservationDto, PublicSurveyResponseDto, UpdateCouponDto, UpdateReservationDto, UpdateReservationFormDto } from '../dto/reservation.dto';
import { LeadIntakeService } from '../../crm/leads/lead-intake.service';
import { GoogleCalendarService } from '../../integrations/google/google-calendar.service';
import { MetaConversionOutboxService } from '../../integrations/meta/meta-conversion-outbox.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { EmailService } from '../../../core/notifications/email.service';
import { AuditService } from '../../../core/audit/audit.service';
import { MetaClientPixelService } from '../../integrations/meta/meta-client-pixel.service';
import { inferLocationFromPhone } from '../../../shared/geo-inference';
import { GoogleConversionOutboxService } from '../../integrations/google/google-conversion-outbox.service';
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

const FIELD_TYPES = new Set(['text', 'textarea', 'email', 'phone', 'select', 'multi_select', 'number', 'date', 'consent', 'coupon', 'rating']);
// Solo las reservas que aún tienen un turno futuro consumen capacidad.
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
    private readonly audit: AuditService,
    // Se agrega al final a propósito: las pruebas instancian el servicio con
    // argumentos posicionales, así que insertarlo en medio desplazaría las
    // dependencias existentes.
    private readonly googleOutbox: GoogleConversionOutboxService,
  ) {}
  private readonly logger = new Logger(ReservationsService.name);

  private slug(value: string) { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 140); }
  private scope(organizationId: string, clientId?: string, clientIds?: string[]) { return { organizationId, ...(clientId ? { clientId } : clientIds !== undefined ? { clientId: In(clientIds) } : {}) }; }
  private sqlClientScope(clientId?: string, clientIds?: string[]) {
    if (clientId) return { clause: ' AND client_id = ?', params: [clientId] };
    if (clientIds === undefined) return { clause: '', params: [] as string[] };
    if (clientIds.length === 0) return { clause: ' AND 1 = 0', params: [] as string[] };
    return { clause: ` AND client_id IN (${clientIds.map(() => '?').join(',')})`, params: clientIds };
  }
  private minutes(value: string) { const match = /^(\d{2}):(\d{2})$/.exec(value); if (!match) return -1; const total = Number(match[1]) * 60 + Number(match[2]); return Number(match[1]) < 24 && Number(match[2]) < 60 ? total : -1; }
  private overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) { return aStart < bEnd && aEnd > bStart; }
  private minutesOverlaps(aStartMin: number, aEndMin: number, bStartMin: number, bEndMin: number) { return aStartMin < bEndMin && aEndMin > bStartMin; }
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
      for (let day = 0; day <= 6; day++) {
        const dayWindows = (windows as ScheduleWindow[]).filter((window) => window.day === day).sort((a, b) => this.minutes(a.start) - this.minutes(b.start));
        for (let previous = dayWindows[0], i = 1; i < dayWindows.length; i++) { const current = dayWindows[i]; if (this.minutesOverlaps(this.minutes(previous.start), this.minutes(previous.end), this.minutes(current.start), this.minutes(current.end))) throw new BadRequestException(`Ventanas de ${label} se superponen`); previous = current; }
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
      if (field.type === 'rating' && (!Number.isInteger(Number(value)) || Number(value) < 1 || Number(value) > 5)) throw new BadRequestException(`La respuesta de ${field.label} debe estar entre 1 y 5`);
      if (field.type === 'consent' && typeof value !== 'boolean') throw new BadRequestException(`La respuesta de ${field.label} debe ser una aceptación`);
    }
  }

  private async assertClientOwnership(organizationId: string, clientId: string) {
    const rows = await this.dataSource.query('SELECT id FROM clients WHERE id = ? AND organization_id = ? LIMIT 1', [clientId, organizationId]);
    if (!Array.isArray(rows) || rows.length === 0) throw new ForbiddenException('El cliente no pertenece a esta organización');
  }

  private async clientCapabilities(organizationId: string, clientId: string, queryFn?: (sql: string, params?: unknown[]) => Promise<unknown[]>) {
    const q = queryFn || this.dataSource.query.bind(this.dataSource);
    const rows = await q('SELECT capabilities FROM clients WHERE id = ? AND organization_id = ? LIMIT 1', [clientId, organizationId]);
    if (!Array.isArray(rows) || rows.length === 0) throw new ForbiddenException('El cliente no pertenece a esta organización');
    const raw = rows[0]?.capabilities;
    let parsed: unknown;
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (err) {
      this.logger.warn(`Client capabilities invalid JSON for ${clientId}: ${err instanceof Error ? err.message : err}`);
      parsed = undefined;
    }
    return normalizeClientCapabilities(parsed as Parameters<typeof normalizeClientCapabilities>[0]);
  }

  private async uniqueSlug(baseValue: string) {
    const base = this.slug(baseValue) || 'reservas'; let candidate = base;
    while (await this.forms.exist({ where: { publicSlug: candidate } })) candidate = `${base}-${randomBytes(3).toString('hex')}`;
    return candidate;
  }

  async createForm(organizationId: string, userId: string, dto: CreateReservationFormDto) {
    await this.assertClientOwnership(organizationId, dto.clientId);
    const capabilities = await this.clientCapabilities(organizationId, dto.clientId);
    if (!capabilities.reservations) throw new ForbiddenException('Reservas no está habilitado para esta empresa');
    const isSurvey = ['request', 'survey'].includes(dto.mode || '');
    const fieldSchema = isSurvey
      ? [
        { id: 'name', type: 'text', label: 'Nombre', required: true, system: true, placeholder: 'Nombre completo' },
        { id: 'email', type: 'email', label: 'Email (aquí enviaremos tu regalo)', required: true, system: true, placeholder: 'Email' },
        { id: 'phone', type: 'phone', label: 'WhatsApp', required: true, system: true, placeholder: '+56 9 ...' },
        { id: 'birthday', type: 'date', label: '¿Cuál es tu fecha de cumpleaños?', required: true },
        { id: 'consent', type: 'consent', label: 'Acepto los términos y condiciones proporcionados por la empresa. Al proporcionar mi número de WhatsApp acepto recibir promociones esporádicas.', required: true },
        { id: 'ad_influenced', type: 'select', label: '¿Viste algún anuncio publicitario que influyó en tu decisión de visitarnos?', required: true, options: ['Sí', 'No'] },
        { id: 'source', type: 'select', label: '¿Cómo nos conociste?', required: true, options: ['Recomendación de alguien', 'Vi un anuncio publicitario en Facebook/Instagram', 'Los vi mientras caminaba y entré', 'Ya los conocía, soy cliente'] },
        { id: 'served_by', type: 'text', label: '¿Podrías indicarnos quien te atendió durante tu visita?', required: true, placeholder: 'Ej: Juan' },
        { id: 'rating', type: 'rating', label: 'De 1 a 5 ¿Cómo calificarías la experiencia?', required: true },
      ]
      : [{ id: 'name', type: 'text', label: 'Nombre completo', required: true, system: true }, { id: 'email', type: 'email', label: 'Correo', required: false, system: true }, { id: 'phone', type: 'phone', label: 'Teléfono', required: true, system: true }, { id: 'consent', type: 'consent', label: 'Acepto el tratamiento de mis datos para gestionar esta reserva.', required: true }];
    const form = this.forms.create({
      organizationId, clientId: dto.clientId, createdBy: userId, name: dto.name.trim(), publicSlug: await this.uniqueSlug(dto.publicSlug || dto.name), mode: dto.mode || 'appointment',
      fieldSchema,
      designConfig: isSurvey
        ? { primaryColor: '#1f5b2d', accentColor: '#d79b3a', backgroundColor: '#f5eedf', textColor: '#263241', title: dto.name, welcome: 'Gracias por ser parte de nuestra experiencia. Tu opinión es fundamental para seguir mejorando.', confirmationMessage: 'Gracias por tu tiempo. Tu respuesta fue registrada.', backgroundMode: 'image', backgroundOpacity: '82', backgroundPosition: 'center', backgroundSize: 'cover', layoutPosition: 'center', buttonRadius: '6', fieldRadius: '6', fontFamily: 'Inter, sans-serif', showFacts: 'false', showSecureBadge: 'false', showPoweredBy: 'false', googleReviewUrl: '', googleReviewMinRating: '4' }
        : { primaryColor: '#173f35', accentColor: '#ea0f63', backgroundColor: '#f3f5ef', textColor: '#3f4e49', title: dto.name, welcome: 'Elige el horario que mejor te acomode.', backgroundMode: 'gradient', backgroundGradient: 'linear-gradient(135deg, #f3f5ef 0%, #dce9df 100%)', backgroundOpacity: '88', backgroundPosition: 'center', buttonRadius: '12', fieldRadius: '10', fontFamily: 'system-ui' },
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
    if (form.status === 'published' && ((form.scheduleConfig as { windows?: unknown[] }).windows?.length || 0) === 0) throw new BadRequestException('No puedes publicar sin disponibilidad');
    return this.forms.save(form);
  }
  async duplicateForm(organizationId: string, id: string, userId: string, clientIds?: string[]) { const source = await this.getForm(organizationId, id, undefined, clientIds); const copy = this.forms.create({ ...source, id: undefined, name: `${source.name} (copia)`, publicSlug: await this.uniqueSlug(source.publicSlug), status: 'draft', createdBy: userId, createdAt: undefined, updatedAt: undefined }); return this.forms.save(copy); }

  async addBlock(organizationId: string, formId: string, userId: string, dto: CreateBlockDto, clientId?: string, clientIds?: string[]) { const form = await this.getForm(organizationId, formId, clientId, clientIds); const startsAt = new Date(dto.startsAt); const endsAt = new Date(dto.endsAt); if (Number.isNaN(startsAt.getTime()) || endsAt <= startsAt) throw new BadRequestException('El fin debe ser posterior al inicio'); return this.blocks.save(this.blocks.create({ organizationId, clientId: form.clientId, formId, createdBy: userId, startsAt, endsAt, reason: dto.reason })); }
  async listBlocks(organizationId: string, formId: string, clientId?: string, clientIds?: string[]) { await this.getForm(organizationId, formId, clientId, clientIds); return this.blocks.find({ where: { organizationId, formId }, order: { startsAt: 'ASC' } }); }
  async removeBlock(organizationId: string, id: string, clientId?: string, clientIds?: string[], actorId?: string) { const block = await this.blocks.findOne({ where: { id, ...this.scope(organizationId, clientId, clientIds) } }); if (!block) throw new NotFoundException('Bloqueo no encontrado'); await this.blocks.remove(block); await this.audit.log({ organizationId, actorId, entityType: 'AvailabilityBlock', entityId: id, action: 'deleted', before: { startsAt: block.startsAt, endsAt: block.endsAt, reason: block.reason, formId: block.formId } }); return { deleted: true }; }

  private async publishedForm(slug: string, manager?: EntityManager, lock = false) {
    const repo = manager?.getRepository(ReservationForm) || this.forms;
    const qb = repo.createQueryBuilder('form').where('form.public_slug = :slug AND form.status = :status', { slug, status: 'published' }); if (lock) qb.setLock('pessimistic_write');
    const form = await qb.getOne(); if (!form) throw new NotFoundException('Este formulario no está disponible');
    const capabilities = await this.clientCapabilities(form.organizationId, form.clientId, manager?.query.bind(manager));
    if (!capabilities.reservations) throw new NotFoundException('Este formulario no está disponible');
    // Un formulario publicado con configuracion invalida no debe mostrarle un error de validacion
    // al visitante: se registra para poder corregirlo y la pagina responde como no disponible.
    try { this.validateConfiguration(form); } catch (err) {
      this.logger.error(`Formulario publicado ${form.id} (${slug}) tiene configuración inválida: ${err instanceof Error ? err.message : err}`);
      throw new NotFoundException('Este formulario no está disponible');
    }
    return form;
  }
  async publicForm(slug: string) {
    const form = await this.publishedForm(slug);
    const capabilities = await this.clientCapabilities(form.organizationId, form.clientId);
    const meta = capabilities.metaConversions
      ? await this.getClientMetaConfig(form.clientId, form.organizationId)
      : { pixelId: '', pixelName: null as string | null, accessToken: undefined as string | undefined };
    return { name: form.name, publicSlug: form.publicSlug, mode: form.mode, timezone: form.timezone, durationMinutes: form.durationMinutes, capacityPerSlot: form.capacityPerSlot, confirmationMode: form.confirmationMode, fieldSchema: (form.fieldSchema as FieldConfig[]).filter((field) => !field.internal), designConfig: form.designConfig, servicesConfig: form.servicesConfig, resourcesConfig: form.resourcesConfig, pixelId: meta.pixelId, pixelName: meta.pixelName || null, metaReady: Boolean(meta.pixelId && meta.accessToken), ga4MeasurementId: form.ga4MeasurementId || null };
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
    await this.validateEmailDomain(dto.guestEmail);
    const partySize = dto.partySize || 1;
    const result = await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(ReservationForm).createQueryBuilder('f').setLock('pessimistic_write').where('f.id = :id', { id: form.id }).getOne();
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
    const end = localToUtc(addPlainDays(dateKey, 1), '00:00', timeZone);
    const qb = manager.getRepository(Reservation).createQueryBuilder('r')
      .where('r.form_id = :formId AND r.starts_at >= :start AND r.starts_at < :end AND r.status IN (:...statuses)', { formId, start, end, statuses: ACTIVE_STATUSES });
    if (excludeId) qb.andWhere('r.id != :excludeId', { excludeId });
    return qb.getCount();
  }

  /**
   * Reservas del cliente en un dia, sumando todos sus formularios.
   *
   * El tope del cliente describe lo que su operacion puede atender en una jornada, asi que
   * cuenta el total del dia y no el de un formulario.
   */
  private async clientDailyReservationsCount(manager: EntityManager, clientId: string, dateKey: string, timeZone: string, excludeId?: string) {
    const start = localToUtc(dateKey, '00:00', timeZone);
    const end = localToUtc(addPlainDays(dateKey, 1), '00:00', timeZone);
    const qb = manager.getRepository(Reservation).createQueryBuilder('r')
      .where('r.client_id = :clientId AND r.starts_at >= :start AND r.starts_at < :end AND r.status IN (:...statuses)', { clientId, start, end, statuses: ACTIVE_STATUSES });
    if (excludeId) qb.andWhere('r.id != :excludeId', { excludeId });
    return qb.getCount();
  }

  /**
   * Tope diario que el cliente declaro para toda su operacion, o 0 si no fijo ninguno.
   *
   * Se lee por consulta directa para no acoplar el modulo de reservas al de clientes.
   */
  private async clientDailyCap(runner: { query(sql: string, params?: unknown[]): Promise<any> }, clientId: string): Promise<number> {
    const rows = await runner.query('SELECT daily_reservation_cap FROM clients WHERE id = ?', [clientId]);
    return Number(rows?.[0]?.daily_reservation_cap ?? 0) || 0;
  }

  private async availability(manager: EntityManager, form: ReservationForm, startsAt: Date, partySize: number, serviceId?: string, resourceId?: string, excludeId?: string) {
    const rules = this.assertScheduled(form, startsAt, serviceId, resourceId); const endsAt = new Date(startsAt.getTime() + rules.duration * 60000);
    const block = await manager.getRepository(AvailabilityBlock).createQueryBuilder('b').where('b.form_id = :formId AND b.starts_at < :endsAt AND b.ends_at > :startsAt', { formId: form.id, startsAt, endsAt }).getOne(); if (block) throw new ConflictException('El horario está bloqueado');
    const dateKey = this.localDateKey(startsAt, form.timezone);
    if (form.dailyCapacity > 0) {
      const dailyCount = await this.dailyReservationsCount(manager, form.id, dateKey, form.timezone, excludeId);
      if (dailyCount >= form.dailyCapacity) throw new ConflictException('Este día ya alcanzó su tope de reservas');
    }
    // El tope del cliente se aplica ademas del propio del formulario: manda el mas estricto.
    const clientCap = await this.clientDailyCap(manager, form.clientId);
    if (clientCap > 0) {
      const clientCount = await this.clientDailyReservationsCount(manager, form.clientId, dateKey, form.timezone, excludeId);
      if (clientCount >= clientCap) throw new ConflictException('Este día ya alcanzó su tope de reservas');
    }
    const qb = manager.getRepository(Reservation).createQueryBuilder('r').where('r.form_id = :formId AND r.starts_at < :endsAt AND r.ends_at > :startsAt AND r.status IN (:...statuses)', { formId: form.id, startsAt, endsAt, statuses: ACTIVE_STATUSES }).setLock('pessimistic_write');
    if (resourceId) qb.andWhere('r.resource_id = :resourceId', { resourceId }); if (excludeId) qb.andWhere('r.id != :excludeId', { excludeId });
    const existing = await qb.getMany(); const used = existing.reduce((sum, item) => sum + item.partySize, 0); if (used + partySize > rules.capacity) throw new ConflictException('Ese horario acaba de ocuparse. Selecciona una alternativa.'); return { ...rules, endsAt, available: rules.capacity - used };
  }

  async slots(slug: string, from: string, days = 14, serviceId?: string, resourceId?: string) {
    const form = await this.publishedForm(slug);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new BadRequestException('Fecha inválida');
    const rules = this.effectiveRules(form, serviceId, resourceId);
    const count = Math.min(Math.max(days, 1), 31);
    const rangeStart = localToUtc(from, '00:00', form.timezone);
    const rangeEnd = localToUtc(addPlainDays(from, count), '00:00', form.timezone);
    const existingQb = this.reservations.createQueryBuilder('r')
      .select(['r.id', 'r.startsAt', 'r.endsAt', 'r.partySize'])
      .where('r.form_id = :formId AND r.starts_at >= :start AND r.starts_at < :end AND r.status IN (:...statuses)', { formId: form.id, start: rangeStart, end: rangeEnd, statuses: ACTIVE_STATUSES });
    if (resourceId) existingQb.andWhere('r.resource_id = :resourceId', { resourceId });
    const blocksQb = this.blocks.createQueryBuilder('b')
      .select(['b.id', 'b.startsAt', 'b.endsAt'])
      .where('b.form_id = :formId AND b.starts_at < :end AND b.ends_at > :start', { formId: form.id, start: rangeStart, end: rangeEnd });
    const [existing, blocks] = await Promise.all([existingQb.getMany(), blocksQb.getMany()]);
    // El tope efectivo del dia es el mas estricto entre el del formulario y el del cliente.
    // El del cliente cuenta las reservas de todos sus formularios, no solo las de este.
    const clientCap = await this.clientDailyCap(this.dataSource, form.clientId);
    const clientCounts = new Map<string, number>();
    if (clientCap > 0) {
      const clientRows = await this.reservations.createQueryBuilder('r')
        .where('r.client_id = :clientId AND r.starts_at >= :start AND r.starts_at < :end AND r.status IN (:...statuses)', { clientId: form.clientId, start: rangeStart, end: rangeEnd, statuses: ACTIVE_STATUSES })
        .getMany();
      for (const item of clientRows) {
        const key = this.localDateKey(item.startsAt, form.timezone);
        clientCounts.set(key, (clientCounts.get(key) ?? 0) + 1);
      }
    }
    const dailyCounts = new Map<string, number>();
    const reservationsByDate = new Map<string, Reservation[]>();
    const blocksByDate = new Map<string, AvailabilityBlock[]>();
    if (form.dailyCapacity > 0) {
      for (const item of existing) {
        const key = this.localDateKey(item.startsAt, form.timezone);
        dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
      }
    }
    for (const item of existing) {
      const key = this.localDateKey(item.startsAt, form.timezone);
      const list = reservationsByDate.get(key) || [];
      list.push(item);
      reservationsByDate.set(key, list);
    }
    for (const block of blocks) {
      const startKey = this.localDateKey(block.startsAt, form.timezone);
      const endKey = this.localDateKey(block.endsAt, form.timezone);
      const keys = startKey === endKey ? [startKey] : [startKey, endKey];
      for (const key of keys) {
        const list = blocksByDate.get(key) || [];
        list.push(block);
        blocksByDate.set(key, list);
      }
    }
    const result: Array<{ startsAt: string; available: number }> = [];
    const windowsByWeekday = new Map<number, ScheduleWindow[]>();
    for (const window of rules.windows) {
      const list = windowsByWeekday.get(window.day) || [];
      list.push(window);
      windowsByWeekday.set(window.day, list);
    }
    const minStart = Date.now() + form.minimumNoticeHours * 3600000;
    const maxStart = Date.now() + form.maximumAdvanceDays * 86400000;
    // Un dia sin horarios puede estarlo por dos motivos que el comensal distingue: el local
    // no abre (o esta bloqueado) o ya alcanzo su tope diario. Solo el segundo es "completo".
    const fullDays: string[] = [];
    for (let offset = 0; offset < count; offset += 1) {
      const date = addPlainDays(from, offset);
      const { weekday } = plainDateParts(date);
      const dayWindows = windowsByWeekday.get(weekday) || [];
      const formFull = form.dailyCapacity > 0 && (dailyCounts.get(date) ?? 0) >= form.dailyCapacity;
      const clientFull = clientCap > 0 && (clientCounts.get(date) ?? 0) >= clientCap;
      if (formFull || clientFull) {
        if (dayWindows.length > 0) fullDays.push(date);
        continue;
      }
      const dayReservations = reservationsByDate.get(date) || [];
      const dayBlocks = blocksByDate.get(date) || [];
      for (const window of dayWindows) {
        for (let minute = this.minutes(window.start); minute + rules.duration <= this.minutes(window.end); minute += rules.duration + form.bufferMinutes) {
          const startsAt = localToUtc(date, `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`, form.timezone);
          const endsAt = new Date(startsAt.getTime() + rules.duration * 60000);
          if (startsAt.getTime() < minStart || startsAt.getTime() > maxStart) continue;
          if (dayBlocks.some((block) => this.overlaps(startsAt, endsAt, block.startsAt, block.endsAt))) continue;
          const used = dayReservations.reduce((sum, item) => this.overlaps(startsAt, endsAt, item.startsAt, item.endsAt) ? sum + item.partySize : sum, 0);
          if (used < rules.capacity) result.push({ startsAt: startsAt.toISOString(), available: rules.capacity - used });
        }
      }
    }
    return { slots: result, fullDays };
  }

  async trackPublicEvent(slug: string, dto: PublicFormEventDto) {
    const form = await this.publishedForm(slug);
    if (dto.sessionId) {
      const existing = await this.formEvents.findOne({ where: { formId: form.id, type: dto.type, sessionId: dto.sessionId } });
      if (existing) return existing;
    }
    return this.formEvents.save(this.formEvents.create({ organizationId: form.organizationId, clientId: form.clientId, formId: form.id, type: dto.type, sessionId: dto.sessionId, utmSource: dto.utmSource, utmCampaign: dto.utmCampaign }));
  }

  async createPublicSurveyResponse(slug: string, dto: PublicSurveyResponseDto, ipAddress?: string, userAgent?: string, eventSourceUrl?: string) {
    if (dto.website) throw new BadRequestException('Solicitud inválida');
    const form = await this.publishedForm(slug);
    if (!['request', 'survey'].includes(form.mode)) throw new BadRequestException('Este enlace requiere selección de horario');
    this.validateAnswers(form, dto.answers);
    const existing = await this.formEvents.findOne({ where: { formId: form.id, type: 'submit', sessionId: dto.idempotencyKey } });
    if (existing) return existing;
    const response = await this.formEvents.save(this.formEvents.create({
      organizationId: form.organizationId,
      clientId: form.clientId,
      formId: form.id,
      type: 'submit',
      sessionId: dto.idempotencyKey,
      utmSource: dto.utmSource,
      utmCampaign: dto.utmCampaign,
      metadata: {
        guestName: dto.guestName.trim(),
        guestEmail: dto.guestEmail?.trim().toLowerCase(),
        guestPhone: dto.guestPhone?.replace(/[^\d+]/g, ''),
        answers: dto.answers,
        clickId: dto.clickId,
        fbc: dto.fbc,
        fbp: dto.fbp,
        clientIpAddress: ipAddress,
        clientUserAgent: userAgent,
      },
    }));
    const capabilities = await this.clientCapabilities(form.organizationId, form.clientId);
    if (form.metaCapiEnabled && capabilities.metaConversions) {
      try {
        await this.enqueueMetaSurveyConversion(response, form, dto, ipAddress, userAgent, eventSourceUrl);
      } catch (err) {
        this.logger.warn(`Meta CAPI survey enqueue failed for response ${response.id}: ${err instanceof Error ? err.message : err}`);
      }
    }
    return response;
  }

  private async validateEmailDomain(email?: string): Promise<void> {
    if (!email) return;
    const domain = email.split('@')[1];
    if (!domain) throw new BadRequestException('Correo inválido');
    try {
      const mx = await dns.resolveMx(domain);
      if (!mx || mx.length === 0) this.reportBadEmail(domain);
    } catch (err) {
      this.logger.warn(`MX lookup failed for domain ${domain}: ${err instanceof Error ? err.message : err}`);
      // La verificación MX es best-effort; no debe bloquear la reserva
    }
  }
  private reportBadEmail(_domain: string) {
    this.dataSource.query('INSERT INTO audit_logs (organization_id, entity_type, entity_id, action, metadata, occurred_at) VALUES (?, ?, ?, ?, ?, NOW())', [null, 'email_validation', _domain, 'mx_failed', JSON.stringify({ domain: _domain })]).catch(() => undefined);
  }

  async createPublic(slug: string, dto: PublicReservationDto, ipAddress?: string, userAgent?: string, eventSourceUrl?: string) {
    if (dto.website) throw new BadRequestException('Solicitud inválida');
    if (dto.renderedAt && Date.now() - new Date(dto.renderedAt).getTime() < 800) throw new BadRequestException('Completa el formulario antes de enviarlo');
    await this.validateEmailDomain(dto.guestEmail);

    const result = await this.dataSource.transaction(async (manager) => {
      const form = await this.publishedForm(slug, manager, true);
      const existingIdempotent = await manager.getRepository(Reservation).findOne({ where: { formId: form.id, idempotencyKey: dto.idempotencyKey } });
      if (existingIdempotent) return { booking: existingIdempotent, form, created: false };

      const startsAt = new Date(dto.startsAt);
      if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Fecha inválida');
      const partySize = dto.partySize || 1;
      const availability = await this.availability(manager, form, startsAt, partySize, dto.serviceId, dto.resourceId);
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

      const coupon = await this.validateCoupon(dto.couponCode, form, manager, startsAt);
      if (coupon) {
        coupon.usageCount += 1;
        await manager.save(ReservationCoupon, coupon);
      }

      const status = form.confirmationMode === 'manual' ? 'pending' : 'confirmed';
      const booking = await manager.save(Reservation, manager.create(Reservation, {
        organizationId: form.organizationId,
        clientId: form.clientId,
        formId: form.id,
        idempotencyKey: dto.idempotencyKey,
        referenceCode: randomBytes(6).toString('hex').toUpperCase(),
        status,
        startsAt,
        endsAt: availability.endsAt,
        partySize,
        guestName: dto.guestName.trim(),
        guestEmail: dto.guestEmail?.trim().toLowerCase(),
        guestPhone: dto.guestPhone?.replace(/[^\d+]/g, ''),
        serviceId: dto.serviceId,
        resourceId: dto.resourceId,
        answers: dto.answers,
        consentVersion: dto.consentVersion,
        utmSource: dto.utmSource,
        utmMedium: dto.utmMedium,
        utmCampaign: dto.utmCampaign,
        utmContent: dto.utmContent,
        clickId: dto.clickId,
        fbc: dto.fbc,
        fbp: dto.fbp,
        clientIpAddress: ipAddress,
        clientUserAgent: userAgent,
        couponCode: coupon?.code,
      }));

      await manager.save(ReservationEvent, manager.create(ReservationEvent, {
        organizationId: form.organizationId,
        clientId: form.clientId,
        reservationId: booking.id,
        type: 'created',
        toStatus: status,
        actorType: 'guest',
        metadata: { startsAt: startsAt.toISOString(), serviceId: dto.serviceId, resourceId: dto.resourceId },
      }));

      return { booking, form, created: true };
    });

    const capabilities = await this.clientCapabilities(result.form.organizationId, result.form.clientId);

    if (result.created && result.form.crmEnabled && capabilities.crm) {
      try {
        // Quien reserva una mesa es audiencia del local, no un prospecto para vender VITAHUB:
        // `captureAudience` mantiene la captura fuera del embudo comercial y devuelve el contacto.
        const { contact } = await this.leadIntake.captureAudience({
          organizationId: result.form.organizationId,
          clientId: result.form.clientId,
          name: result.booking.guestName,
          email: result.booking.guestEmail ?? undefined,
          phone: result.booking.guestPhone ?? undefined,
          source: 'vitahub_reservations',
          sourceDetail: result.form.name,
          status: 'reserved',
          externalLeadId: `reservation:${result.booking.id}`,
          externalFormId: result.form.id,
          externalCampaignId: result.form.campaignId,
          campaignName: result.booking.utmCampaign,
          consentCapturedAt: new Date(),
          metadata: {
            reservationId: result.booking.id,
            referenceCode: result.booking.referenceCode,
            startsAt: result.booking.startsAt.toISOString(),
          },
        });
        // El vínculo se guarda en la reserva para que la ficha del comensal pueda listar sus
        // reservas por clave, sin cruzar teléfonos que además cambian cuando alguien los corrige.
        if (contact?.id && result.booking.contactId !== contact.id) {
          result.booking.contactId = contact.id;
          await this.reservations.update(result.booking.id, { contactId: contact.id });
        }
      } catch (err) {
        this.logger.warn(`CRM intake failed for booking ${result.booking.id}: ${err instanceof Error ? err.message : err}`);
        await this.recordIntegrationFailure(result.booking, 'crm');
      }
    }

    if (result.created && result.form.calendarEnabled) {
      try {
        const event = await this.calendar.createEvent(result.form.organizationId, {
          summary: `${result.form.name}: ${result.booking.guestName}`,
          description: `Reserva ${result.booking.referenceCode}`,
          start: result.booking.startsAt,
          durationMinutes: Math.round((result.booking.endsAt.getTime() - result.booking.startsAt.getTime()) / 60000),
        });
        result.booking.calendarEventId = event.externalId;
        result.booking.calendarUrl = event.calendarUrl;
        await this.reservations.save(result.booking);
      } catch (err) {
        this.logger.warn(`Google Calendar event failed for booking ${result.booking.id}: ${err instanceof Error ? err.message : err}`);
        await this.recordIntegrationFailure(result.booking, 'google_calendar');
      }
    }

    if (result.created && result.form.metaCapiEnabled && capabilities.metaConversions) {
      try {
        await this.enqueueMetaConversion(result.booking, result.form, 'Schedule', Math.floor(result.booking.createdAt.getTime() / 1000), eventSourceUrl);
      } catch (err) {
        this.logger.warn(`Meta CAPI enqueue failed for booking ${result.booking.id}: ${err instanceof Error ? err.message : err}`);
        await this.recordIntegrationFailure(result.booking, 'meta_capi');
      }
    }

    if (result.created) {
      try {
        await this.enqueueGoogleConversion(result.booking, result.form, 'schedule', result.booking.createdAt);
      } catch (err) {
        this.logger.warn(`Google Ads enqueue failed for booking ${result.booking.id}: ${err instanceof Error ? err.message : err}`);
        await this.recordIntegrationFailure(result.booking, 'google_ads');
      }
    }

    if (result.created) await this.notifyNewBooking(result.form, result.booking);
    return result.booking;
  }

  private async recordIntegrationFailure(booking: Reservation, provider: string) {
    await this.events.save(this.events.create({
      organizationId: booking.organizationId,
      clientId: booking.clientId,
      reservationId: booking.id,
      type: 'integration_failed',
      actorType: 'system',
      metadata: { provider },
    }));
  }

  /**
   * Encola la conversión equivalente hacia Google Ads.
   *
   * Se omite en silencio si el cliente no tiene Ads conectado o no configuró
   * la acción de conversión: la reserva no debe fallar por eso. El gclid viene
   * de `clickId`, capturado desde la URL del anuncio; si no hay, Google puede
   * atribuir igual vía enhanced conversions con los datos hasheados.
   */
  private async enqueueGoogleConversion(booking: Reservation, form: ReservationForm, eventKey: string, conversionDate: Date) {
    if (!this.googleOutbox) return;
    // Enviar datos personales a Google requiere habilitación explícita por
    // empresa, igual que metaConversions.
    const capabilities = await this.clientCapabilities(form.organizationId, form.clientId);
    if (!capabilities.googleConversions) return;

    const config = await this.googleOutbox.resolveConfig(form.organizationId, form.clientId, eventKey);
    if (!config) return;

    const [firstName, ...lastNameParts] = (booking.guestName ?? '').trim().split(/\s+/);
    const location = inferLocationFromPhone(booking.guestPhone);

    await this.googleOutbox.enqueue(form.organizationId, config, `${eventKey}:${booking.id}`, {
      gclid: booking.clickId ?? undefined,
      orderId: booking.id,
      conversionDateTime: conversionDate,
      timezone: form.timezone,
      userData: {
        email: booking.guestEmail ?? undefined,
        phone: booking.guestPhone ?? undefined,
        firstName: firstName || undefined,
        lastName: lastNameParts.join(' ') || undefined,
        country: location.country,
        region: location.region,
        city: location.city,
      },
    });
  }

  private async enqueueMetaConversion(booking: Reservation, form: ReservationForm, eventName: string, eventTime?: number, eventSourceUrl?: string) {
    const { pixelId, accessToken } = await this.getClientMetaConfig(form.clientId, form.organizationId);
    if (!pixelId || !accessToken) throw new Error('Meta pixel or CAPI token is not configured');
    // 'Schedule' se dispara desde el formulario web público (action_source: website, requiere event_source_url).
    // La asistencia la confirma el staff en persona, así que debe reportarse como physical_store
    // (la ventana de 7 días para subir eventos 'website'/'system_generated' de Meta es muy ajustada
    // para ese flujo; physical_store tiene 62 días) y event_source_url no aplica.
    const isWebEvent = eventName === 'Schedule';
    const actionSource = isWebEvent ? 'website' : 'physical_store';
    const fallbackUrl = process.env.APP_PUBLIC_URL ? `${process.env.APP_PUBLIC_URL.replace(/\/$/, '')}/book/${encodeURIComponent(form.publicSlug)}` : undefined;
    eventSourceUrl = isWebEvent ? (eventSourceUrl || fallbackUrl || undefined) : undefined;
    const [firstName, ...lastNameParts] = (booking.guestName ?? '').trim().split(/\s+/);
    const lastName = lastNameParts.join(' ');
    // Ubicación aproximada derivada del teléfono (sin proveedor externo): sube
    // el Match Quality de Meta al aportar country/ct/st, que Meta no puede
    // deducir por sí solo del client_ip_address.
    const location = inferLocationFromPhone(booking.guestPhone);
    await this.metaOutbox.enqueue(form.organizationId, pixelId, {
      eventName, eventTime: eventTime ?? Math.floor(Date.now() / 1000), actionSource, eventSourceUrl,
      userData: {
        em: booking.guestEmail ? [booking.guestEmail] : undefined,
        ph: booking.guestPhone ? [booking.guestPhone] : undefined,
        fn: firstName ? [firstName] : undefined,
        ln: lastName ? [lastName] : undefined,
        externalId: [booking.id],
        ct: location.city ? [location.city] : undefined,
        st: location.region ? [location.region] : undefined,
        country: location.country ? [location.country] : undefined,
        fbc: booking.fbc ?? undefined,
        fbp: booking.fbp ?? undefined,
        client_ip_address: booking.clientIpAddress ?? undefined,
        client_user_agent: booking.clientUserAgent ?? undefined,
      },
      customData: { contentIds: [form.id], contentType: 'reservation' }, eventId: `${eventName.toLowerCase()}:${booking.id}`,
    });
  }

  private async enqueueMetaSurveyConversion(response: ReservationFormEvent, form: ReservationForm, dto: PublicSurveyResponseDto, ipAddress?: string, userAgent?: string, eventSourceUrl?: string) {
    const { pixelId, accessToken } = await this.getClientMetaConfig(form.clientId, form.organizationId);
    if (!pixelId || !accessToken) throw new Error('Meta pixel or CAPI token is not configured');
    const fallbackUrl = process.env.APP_PUBLIC_URL ? `${process.env.APP_PUBLIC_URL.replace(/\/$/, '')}/book/${encodeURIComponent(form.publicSlug)}` : undefined;
    const [firstName, ...lastNameParts] = (dto.guestName ?? '').trim().split(/\s+/);
    const lastName = lastNameParts.join(' ');
    const phone = dto.guestPhone?.replace(/[^\d+]/g, '');
    const location = inferLocationFromPhone(phone);
    const rating = Number((dto.answers || {}).rating ?? (dto.answers || {}).experience_rating);
    await this.metaOutbox.enqueue(form.organizationId, pixelId, {
      eventName: 'Lead',
      eventTime: Math.floor(response.createdAt.getTime() / 1000),
      actionSource: 'website',
      eventSourceUrl: eventSourceUrl || fallbackUrl || undefined,
      userData: {
        em: dto.guestEmail ? [dto.guestEmail] : undefined,
        ph: phone ? [phone] : undefined,
        fn: firstName ? [firstName] : undefined,
        ln: lastName ? [lastName] : undefined,
        externalId: [response.id],
        ct: location.city ? [location.city] : undefined,
        st: location.region ? [location.region] : undefined,
        country: location.country ? [location.country] : undefined,
        fbc: dto.fbc ?? undefined,
        fbp: dto.fbp ?? undefined,
        client_ip_address: ipAddress ?? undefined,
        client_user_agent: userAgent ?? undefined,
      },
      customData: {
        contentIds: [form.id],
        contentType: 'survey',
        ...(Number.isFinite(rating) ? { value: rating } : {}),
      },
      eventId: `lead:${response.id}`,
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
    } catch (err) {
      this.logger.warn(`Notification failed for booking ${booking.id}: ${err instanceof Error ? err.message : err}`);
      // Las notificaciones son útiles pero nunca deben revertir una reserva confirmada.
    }
  }

  async listReservations(organizationId: string, query: ListReservationsDto, clientId?: string, clientIds?: string[], includeInternalNotes = true) {
    const page = query.page ?? 1; const pageSize = query.pageSize ?? 50; const qb = this.reservations.createQueryBuilder('r').where('r.organization_id = :organizationId', { organizationId }); if (clientId) qb.andWhere('r.client_id = :clientId', { clientId }); else if (clientIds !== undefined) qb.andWhere(clientIds.length ? 'r.client_id IN (:...clientIds)' : '1 = 0', { clientIds }); if (query.formId) qb.andWhere('r.form_id = :formId', { formId: query.formId }); if (query.status) qb.andWhere('r.status = :status', { status: query.status }); if (query.from) qb.andWhere('r.starts_at >= :from', { from: query.from }); if (query.to) qb.andWhere('r.starts_at <= :to', { to: query.to });     if (query.search) qb.andWhere('(r.guest_name LIKE :search OR r.guest_email LIKE :search OR r.guest_phone LIKE :search OR r.reference_code LIKE :search)', { search: `%${query.search}%` }); if (query.couponCode) qb.andWhere('r.coupon_code = :couponCode', { couponCode: query.couponCode }); const [items, total] = await qb.orderBy('r.starts_at', 'DESC').skip((page - 1) * pageSize).take(pageSize).getManyAndCount(); const safeItems = includeInternalNotes ? items : items.map(({ internalNotes: _internalNotes, ...item }) => item);
    const conversions = await this.metaConversionStatus(organizationId, items);
    const withConversion = safeItems.map((item) => ({ ...item, metaConversion: conversions.get(item.id) }));
    return { items: withConversion, total, page, pageSize, pages: Math.ceil(total / pageSize) };
  }

  /**
   * Estado de las conversiones enviadas a Meta para un lote de reservas.
   *
   * El brief mide el exito del circuito en Events Manager: que el evento llegue y que
   * llegue con datos de coincidencia. Esto expone ambas cosas en la bandeja, sin tener que
   * salir a Meta para saber si una reserva quedo fuera del circuito.
   *
   * `schedule` corresponde al evento de reserva y `attended` al de asistencia, que son los
   * dos unicos eventos del alcance. `matchFields` cuenta los identificadores presentes en
   * la reserva: sin ninguno, Meta no puede atribuirla a la campana.
   */
  private async metaConversionStatus(organizationId: string, items: Reservation[]) {
    const result = new Map<string, { schedule: string | null; attended: string | null; matchFields: number }>();
    if (items.length === 0) return result;

    const eventIds = items.flatMap((item) => [`schedule:${item.id}`, `reserva_asistida:${item.id}`]);
    let rows: Array<{ event_id: string; status: string }> = [];
    try {
      rows = await this.dataSource.query(
        `SELECT event_id, status FROM meta_conversion_outbox WHERE organization_id = ? AND event_id IN (${eventIds.map(() => '?').join(',')})`,
        [organizationId, ...eventIds],
      );
    } catch (err) {
      // La bandeja debe abrir aunque el outbox no responda: el estado se muestra desconocido.
      this.logger.warn(`No se pudo leer el estado de conversiones Meta: ${err instanceof Error ? err.message : err}`);
      return result;
    }

    const byEvent = new Map(rows.map((row) => [row.event_id, row.status]));
    for (const item of items) {
      const matchFields = [item.guestEmail, item.guestPhone, item.fbc, item.fbp, item.clientIpAddress].filter(Boolean).length;
      result.set(item.id, {
        schedule: byEvent.get(`schedule:${item.id}`) ?? null,
        attended: byEvent.get(`reserva_asistida:${item.id}`) ?? null,
        matchFields,
      });
    }
    return result;
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
    // Intencionalmente no se envía evento de Meta CAPI para 'no_show': la Conversions API no tiene
    // concepto de conversión negativa/revertida, así que no hay nada correcto que enviarle a Meta
    // por una inasistencia — enviar cualquier cosa le diría al algoritmo "esta persona convirtió",
    // que es lo opuesto de lo que pasó. 'attended' es el único resultado que produce una señal
    // de conversión real. Ambos resultados igual se sincronizan al CRM abajo para que el equipo
    // pueda ver/reportar las inasistencias internamente.
    if (statusChangedTo === 'attended' && formForMeta?.metaCapiEnabled && capabilities?.metaConversions) { try { await this.enqueueMetaConversion(saved, formForMeta, 'Reserva_Asistida', Math.floor(saved.startsAt.getTime() / 1000)); } catch (err) { this.logger.warn(`Meta CAPI attended event failed for booking ${saved.id}: ${err instanceof Error ? err.message : err}`); await this.recordIntegrationFailure(saved, 'meta_capi'); } }
    if (statusChangedTo === 'attended' && formForMeta) { try { await this.enqueueGoogleConversion(saved, formForMeta, 'attended', saved.startsAt); } catch (err) { this.logger.warn(`Google Ads attended event failed for booking ${saved.id}: ${err instanceof Error ? err.message : err}`); await this.recordIntegrationFailure(saved, 'google_ads'); } }
    if (statusChangedTo === 'attended' || statusChangedTo === 'no_show') { try { await this.leadIntake.updateStatusByContact(organizationId, statusChangedTo === 'attended' ? 'attended' : 'no_show', saved.guestEmail, saved.guestPhone, saved.clientId); } catch (err) { this.logger.warn(`CRM status sync failed for booking ${saved.id}: ${err instanceof Error ? err.message : err}`); /* CRM sync is best-effort */ } }
    return saved;
  }
  async history(organizationId: string, reservationId: string, clientId?: string, clientIds?: string[]) { const reservation = await this.reservations.findOne({ where: { id: reservationId, ...this.scope(organizationId, clientId, clientIds) } }); if (!reservation) throw new NotFoundException('Reserva no encontrada'); return this.events.find({ where: { reservationId, organizationId }, order: { createdAt: 'DESC' } }); }
  async metrics(organizationId: string, clientId?: string, clientIds?: string[], days = '30') {
    const scoped = this.sqlClientScope(clientId, clientIds); const params = [organizationId, ...scoped.params]; const scope = scoped.clause;
    const daysNum = Math.min(Math.max(Number(days) || 30, 1), 365);
    params.push(daysNum as never);
    const [totals, daily, sources, funnel] = await Promise.all([this.dataSource.query(`SELECT COUNT(*) total, SUM(status='pending') pending, SUM(status='confirmed') confirmed, SUM(status='attended') attended, SUM(status='no_show') no_show, SUM(status='waitlist') waitlist, SUM(status LIKE 'cancelled%') cancelled FROM reservations WHERE organization_id = ?${scope} AND starts_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`, params), this.dataSource.query(`SELECT DATE(starts_at) day, COUNT(*) total, SUM(status='attended') attended, SUM(status='no_show') no_show FROM reservations WHERE organization_id = ?${scope} AND starts_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY day ORDER BY day`, params), this.dataSource.query(`SELECT COALESCE(utm_source,'direct') source, COALESCE(utm_campaign,'Sin campaña') campaign, COUNT(*) total, SUM(status='attended') attended FROM reservations WHERE organization_id = ?${scope} AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) GROUP BY source,campaign ORDER BY total DESC LIMIT 20`, params), this.dataSource.query(`SELECT SUM(type='view') views, SUM(type='start') starts FROM reservation_form_events WHERE organization_id = ?${scope} AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`, params)]);
    const total = Number(totals[0]?.total || 0); const views = Number(funnel[0]?.views || 0);
    return { totals: totals[0] || {}, daily, sources, funnel: { views, starts: Number(funnel[0]?.starts || 0), completed: total, conversionRate: views ? Math.round(total * 1000 / views) / 10 : null }, days: daysNum };
  }
  async exportCsv(organizationId: string, clientId?: string, clientIds?: string[], from?: string, to?: string, limit?: number) {
    const qb = this.reservations.createQueryBuilder('r').where('r.organization_id = :organizationId', { organizationId });
    if (clientId) qb.andWhere('r.client_id = :clientId', { clientId });
    else if (clientIds !== undefined) qb.andWhere(clientIds.length ? 'r.client_id IN (:...clientIds)' : '1 = 0', { clientIds });
    if (from) qb.andWhere('r.starts_at >= :from', { from });
    if (to) qb.andWhere('r.starts_at <= :to', { to });
    const items = await qb.orderBy('r.starts_at', 'DESC').take(limit || 50000).getMany();
    const allFields = new Set<string>();
    for (const item of items) { if (item.answers) Object.keys(item.answers as Record<string, unknown>).forEach((key) => allFields.add(key)); }
    const answerKeys = [...allFields].sort();
    const headers = ['codigo','nombre','correo','telefono','fecha','estado','origen','campana','cupon','personas','notas_internas', ...answerKeys];
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    return [headers, ...items.map((item) => {
      const answers = (item.answers || {}) as Record<string, unknown>;
      return [item.referenceCode, item.guestName, item.guestEmail, item.guestPhone, item.startsAt.toISOString(), item.status, item.utmSource, item.utmCampaign, item.couponCode, item.partySize, item.internalNotes, ...answerKeys.map((key) => answers[key])];
    })].map((row) => row.map(escape).join(',')).join('\r\n');
  }

  async exportFormReservations(
    organizationId: string,
    formId: string,
    clientId?: string,
    clientIds?: string[],
    format: 'csv' | 'json' | 'pdf' = 'csv',
    dateFrom?: string,
    dateTo?: string,
    fields: string[] = ['name', 'phone', 'email', 'date', 'status', 'attendance']
  ) {
    const qb = this.reservations.createQueryBuilder('r').where('r.organization_id = :organizationId', { organizationId }).andWhere('r.form_id = :formId', { formId });
    if (clientId) qb.andWhere('r.client_id = :clientId', { clientId });
    else if (clientIds !== undefined) qb.andWhere(clientIds.length ? 'r.client_id IN (:...clientIds)' : '1 = 0', { clientIds });
    if (dateFrom) qb.andWhere('r.starts_at >= :dateFrom', { dateFrom });
    if (dateTo) qb.andWhere('r.starts_at <= :dateTo', { dateTo });
    const items = await qb.orderBy('r.starts_at', 'DESC').take(50000).getMany();

    const fieldMap: Record<string, (item: Reservation) => string | number | Date | undefined> = {
      name: (item) => item.guestName,
      phone: (item) => item.guestPhone ?? undefined,
      email: (item) => item.guestEmail ?? undefined,
      date: (item) => item.startsAt.toISOString(),
      status: (item) => item.status,
      attendance: (item) => item.status === 'attended' ? 'Sí' : item.status === 'no_show' ? 'No' : '-',
      notes: (item) => item.internalNotes ?? undefined,
      campaign: (item) => item.utmCampaign || '-',
      code: (item) => item.referenceCode,
      origin: (item) => item.utmSource || 'direct',
      coupon: (item) => item.couponCode || '-',
      party_size: (item) => item.partySize,
    };

    if (format === 'json') {
      return items.map((item) => {
        const record: Record<string, any> = {};
        for (const field of fields) {
          record[field] = fieldMap[field]?.(item) ?? '-';
        }
        return record;
      });
    } else if (format === 'csv') {
      const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
      const headers = fields;
      return [headers, ...items.map((item) => fields.map((field) => fieldMap[field]?.(item) ?? '-'))].map((row) => row.map(escape).join(',')).join('\r\n');
    } else if (format === 'pdf') {
      // For now, return a simple text representation for PDF
      // In production, you would use a PDF library like pdfkit or html2pdf
      let pdfContent = `RESERVAS\nFecha: ${new Date().toISOString()}\n\n`;
      pdfContent += fields.map((f) => f.toUpperCase()).join('\t') + '\n';
      pdfContent += '-'.repeat(100) + '\n';
      pdfContent += items.map((item) => fields.map((field) => String(fieldMap[field]?.(item) ?? '-')).join('\t')).join('\n');
      return Buffer.from(pdfContent, 'utf8');
    }

    throw new BadRequestException('Formato no soportado');
  }

  async createCoupon(organizationId: string, userId: string, dto: CreateCouponDto, clientId?: string) {
    const code = dto.code.trim().toUpperCase();
    const exists = await this.coupons.findOne({ where: { organizationId, code } });
    if (exists) throw new ConflictException('Ya existe un cupón con ese código');
    const validDays = Array.isArray(dto.validDaysOfWeek) ? dto.validDaysOfWeek.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6) : undefined;
    if (dto.validFromTime && dto.validUntilTime && this.minutes(dto.validFromTime) >= this.minutes(dto.validUntilTime)) {
      throw new BadRequestException('La hora de inicio del cupón debe ser anterior a la de término');
    }
    const coupon = this.coupons.create({ organizationId, clientId, code, discountType: dto.discountType || 'percentage', value: dto.value ?? 0, maxUses: dto.maxUses ?? 0, validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined, validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined, formIds: dto.formIds, validDaysOfWeek: validDays, validFromTime: dto.validFromTime, validUntilTime: dto.validUntilTime });
    return this.coupons.save(coupon);
  }

  async updateCoupon(organizationId: string, id: string, dto: UpdateCouponDto) {
    const coupon = await this.coupons.findOne({ where: { id, organizationId } });
    if (!coupon) throw new NotFoundException('Cupón no encontrado');
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(dto).filter(([, value]) => value !== undefined)) {
      if (key === 'validDaysOfWeek') update.validDaysOfWeek = Array.isArray(value) ? (value as unknown[]).filter((d: unknown): d is number => typeof d === 'number' && Number.isInteger(d) && d >= 0 && d <= 6) : value;
      else update[key] = value;
    }
    Object.assign(coupon, update);
    return this.coupons.save(coupon);
  }

  listCoupons(organizationId: string, clientId?: string) {
    const where: Record<string, unknown> = { organizationId };
    if (clientId) where.clientId = clientId;
    return this.coupons.find({ where, order: { createdAt: 'DESC' } });
  }

  async validatePublicCoupon(slug: string, code: string, startsAt?: Date) {
    const form = await this.publishedForm(slug);
    const coupon = await this.coupons.findOne({ where: { organizationId: form.organizationId, code: code.trim().toUpperCase(), active: true } });
    if (!coupon) throw new BadRequestException('Cupón no válido');
    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) throw new BadRequestException('El cupón aún no está activo');
    if (coupon.validUntil && now > coupon.validUntil) throw new BadRequestException('El cupón ha expirado');
    if (coupon.maxUses > 0 && coupon.usageCount >= coupon.maxUses) throw new BadRequestException('El cupón ya no tiene usos disponibles');
    if (coupon.formIds && coupon.formIds.length > 0 && !coupon.formIds.includes(form.id)) throw new BadRequestException('El cupón no aplica para este formulario');
    if (coupon.validDaysOfWeek && coupon.validDaysOfWeek.length > 0) {
      // El día de la semana describe cuándo se consume el beneficio (turno reservado),
      // no cuándo se consulta la vista previa; ver validateCoupon.
      const reference = startsAt ?? now;
      const weekday = new Date(reference.toLocaleString('en-US', { timeZone: form.timezone })).getDay();
      if (!coupon.validDaysOfWeek.includes(weekday)) throw new BadRequestException('El cupón no es válido para el día de la reserva');
    }
    return { valid: true, discountType: coupon.discountType, value: coupon.value };
  }

  /**
   * Resuelve el cupón aplicable a una reserva, o lanza explicando por qué no aplica.
   *
   * La vigencia por fecha (`validFrom`/`validUntil`) y los usos disponibles se miden contra
   * el momento de reservar, porque acotan la campaña. El día de la semana y la franja
   * horaria se miden contra `startsAt`: describen cuándo se consume el beneficio, no cuándo
   * se pide. Un cupón de martes debe aceptarse aunque se reserve un domingo.
   *
   * @param code - Código ingresado por el comensal.
   * @param form - Formulario de la reserva, que aporta la zona horaria.
   * @param startsAt - Inicio de la reserva, en UTC.
   */
  private async validateCoupon(code: string | undefined, form: ReservationForm, manager: EntityManager, startsAt: Date): Promise<ReservationCoupon | undefined> {
    if (!code) return undefined;
    const coupon = await manager.getRepository(ReservationCoupon).findOne({ where: { organizationId: form.organizationId, code: code.trim().toUpperCase(), active: true } });
    if (!coupon) throw new BadRequestException('Cupón no válido');
    const now = new Date();
    if (coupon.validFrom && now < coupon.validFrom) throw new BadRequestException('El cupón aún no está activo');
    if (coupon.validUntil && now > coupon.validUntil) throw new BadRequestException('El cupón ha expirado');
    if (coupon.maxUses > 0 && coupon.usageCount >= coupon.maxUses) throw new BadRequestException('El cupón ya no tiene usos disponibles');
    if (coupon.formIds && coupon.formIds.length > 0 && !coupon.formIds.includes(form.id)) throw new BadRequestException('El cupón no aplica para este formulario');

    const local = new Intl.DateTimeFormat('en-US', { timeZone: form.timezone, hourCycle: 'h23', weekday: 'short', hour: '2-digit', minute: '2-digit' })
      .formatToParts(startsAt)
      .reduce<Record<string, string>>((parts, part) => ({ ...parts, [part.type]: part.value }), {});
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(local.weekday);

    if (coupon.validDaysOfWeek && coupon.validDaysOfWeek.length > 0 && !coupon.validDaysOfWeek.includes(weekday)) {
      throw new BadRequestException('El cupón no es válido para el día de la reserva');
    }
    if (coupon.validFromTime || coupon.validUntilTime) {
      const minutes = Number(local.hour) * 60 + Number(local.minute);
      const from = coupon.validFromTime ? this.minutes(coupon.validFromTime) : 0;
      const until = coupon.validUntilTime ? this.minutes(coupon.validUntilTime) : 24 * 60;
      if (minutes < from || minutes >= until) {
        throw new BadRequestException(`El cupón solo aplica entre ${coupon.validFromTime ?? '00:00'} y ${coupon.validUntilTime ?? '23:59'}`);
      }
    }
    return coupon;
  }
}
