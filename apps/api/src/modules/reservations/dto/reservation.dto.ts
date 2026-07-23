import { IsArray, IsBoolean, IsDateString, IsEmail, IsIn, IsInt, IsObject, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateReservationFormDto {
  @IsUUID() clientId: string;
  @IsString() @MaxLength(180) name: string;
  @IsOptional() @IsString() @MaxLength(190) publicSlug?: string;
  @IsOptional() @IsIn(['appointment', 'group', 'request']) mode?: string;
}
export class UpdateReservationFormDto {
  @IsOptional() @IsString() @MaxLength(180) name?: string;
  @IsOptional() @IsIn(['draft', 'published', 'paused']) status?: string;
  @IsOptional() @IsString() @MaxLength(80) timezone?: string;
  @IsOptional() @IsInt() @Min(5) @Max(1440) durationMinutes?: number;
  @IsOptional() @IsInt() @Min(0) @Max(240) bufferMinutes?: number;
  @IsOptional() @IsInt() @Min(1) @Max(500) capacityPerSlot?: number;
  @IsOptional() @IsInt() @Min(0) @Max(5000) dailyCapacity?: number;
  @IsOptional() @IsInt() @Min(1) @Max(3650) maximumAdvanceDays?: number;
  @IsOptional() @IsInt() @Min(0) @Max(8760) minimumNoticeHours?: number;
  @IsOptional() @IsIn(['automatic', 'manual']) confirmationMode?: string;
  @IsOptional() @IsArray() fieldSchema?: unknown[];
  @IsOptional() @IsObject() designConfig?: Record<string, unknown>;
  @IsOptional() @IsObject() scheduleConfig?: Record<string, unknown>;
  @IsOptional() @IsArray() servicesConfig?: unknown[];
  @IsOptional() @IsArray() resourcesConfig?: unknown[];
  @IsOptional() @IsString() @MaxLength(120) campaignId?: string;
  @IsOptional() @IsBoolean() crmEnabled?: boolean;
  @IsOptional() @IsBoolean() calendarEnabled?: boolean;
  @IsOptional() @IsBoolean() metaCapiEnabled?: boolean;
  @IsOptional() @IsArray() @IsEmail({}, { each: true }) teamNotifications?: string[];
}
export class CreateBlockDto { @IsDateString() startsAt: string; @IsDateString() endsAt: string; @IsOptional() @IsString() @MaxLength(180) reason?: string; }
export class PublicReservationDto {
  @IsDateString() startsAt: string;
  @IsString() @MaxLength(180) guestName: string;
  @IsOptional() @IsEmail() guestEmail?: string;
  @IsOptional() @IsString() @MaxLength(50) guestPhone?: string;
  @IsOptional() @IsInt() @Min(1) @Max(500) partySize?: number;
  @IsOptional() @IsString() @MaxLength(80) serviceId?: string;
  @IsOptional() @IsString() @MaxLength(80) resourceId?: string;
  @IsObject() answers: Record<string, unknown>;
  @IsString() @MaxLength(80) idempotencyKey: string;
  @IsOptional() @IsString() @MaxLength(80) consentVersion?: string;
  @IsOptional() @IsString() @MaxLength(120) utmSource?: string;
  @IsOptional() @IsString() @MaxLength(120) utmMedium?: string;
  @IsOptional() @IsString() @MaxLength(180) utmCampaign?: string;
  @IsOptional() @IsString() @MaxLength(180) utmContent?: string;
  @IsOptional() @IsString() @MaxLength(255) clickId?: string;
  @IsOptional() @IsString() @MaxLength(255) fbc?: string;
  @IsOptional() @IsString() @MaxLength(255) fbp?: string;
  @IsOptional() @IsString() @MaxLength(2048) eventSourceUrl?: string;
  @IsOptional() @IsString() @MaxLength(200) website?: string;
  @IsOptional() @IsDateString() renderedAt?: string;
  @IsOptional() @IsString() @MaxLength(80) couponCode?: string;
}
export class UpdateReservationDto { @IsOptional() @IsIn(['pending','confirmed','rescheduled','cancelled_client','cancelled_business','attended','no_show','waitlist']) status?: string; @IsOptional() @IsString() @MaxLength(10000) internalNotes?: string; @IsOptional() @IsDateString() startsAt?: string; }
export class PublicFormEventDto { @IsIn(['view','start']) type: string; @IsOptional() @IsString() @MaxLength(80) sessionId?: string; @IsOptional() @IsString() @MaxLength(120) utmSource?: string; @IsOptional() @IsString() @MaxLength(180) utmCampaign?: string; }
export class CreateCouponDto {
  @IsString() @MaxLength(80) code: string;
  @IsOptional() @IsIn(['percentage','fixed']) discountType?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) value?: number;
  @IsOptional() @IsInt() @Min(0) maxUses?: number;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) formIds?: string[];
  @IsOptional() @IsArray() validDaysOfWeek?: number[];
}
export class CreateManualReservationDto {
  @IsUUID() formId: string;
  @IsDateString() startsAt: string;
  @IsString() @MaxLength(180) guestName: string;
  @IsOptional() @IsEmail() guestEmail?: string;
  @IsOptional() @IsString() @MaxLength(50) guestPhone?: string;
  @IsOptional() @IsInt() @Min(1) @Max(500) partySize?: number;
  @IsOptional() @IsString() @MaxLength(80) serviceId?: string;
  @IsOptional() @IsString() @MaxLength(80) resourceId?: string;
  @IsOptional() @IsObject() answers?: Record<string, unknown>;
  @IsOptional() @IsBoolean() skipAvailability?: boolean;
  @IsOptional() @IsString() @MaxLength(10000) internalNotes?: string;
}

export class ListReservationsDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsUUID() formId?: string;
  @IsOptional() @IsIn(['pending','confirmed','rescheduled','cancelled_client','cancelled_business','attended','no_show','waitlist']) status?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() @MaxLength(180) search?: string;
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsString() @MaxLength(80) couponCode?: string;
}
export class UpdateCouponDto {
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(100) value?: number;
  @IsOptional() @IsInt() @Min(0) maxUses?: number;
  @IsOptional() @IsDateString() validFrom?: string;
  @IsOptional() @IsDateString() validUntil?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) formIds?: string[];
  @IsOptional() @IsArray() validDaysOfWeek?: number[];
}

export class ReservationScopeDto {
  @IsOptional() @IsUUID() clientId?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) limit?: number;
}
