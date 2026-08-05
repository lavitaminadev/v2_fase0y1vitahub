import { BadRequestException, Body, Controller, Get, Headers, Ip, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../core/auth/decorators/public.decorator';
import { ReservationsService } from './application/reservations.service';
import { CouponValidateDto, PublicFormEventDto, PublicReservationDto, PublicSurveyResponseDto } from './dto/reservation.dto';

@Public()
@ApiTags('Reservas pÃºblicas')
@Controller('public/reservations')
export class PublicReservationsController {
  constructor(private service: ReservationsService) {}

  /**
   * URL que se declara a Meta como origen del evento.
   *
   * La arma el servidor. La del cliente solo se acepta si apunta al mismo host público, y
   * únicamente para conservar los parámetros de campaña que traiga: es un endpoint sin
   * autenticar, así que cualquiera podía declarar un dominio ajeno y ensuciar el Events
   * Manager del cliente, o mandar un texto que no fuera una URL y hacer que Meta rechazara
   * el evento con un 400 que el outbox clasifica como definitivo.
   *
   * El `Referer` tampoco sirve como fuente: lo controla igualmente quien llama.
   */
  private eventSourceUrl(slug: string, candidate?: string): string | undefined {
    const publicOrigin = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
    const fallback = publicOrigin ? `${publicOrigin}/book/${encodeURIComponent(slug)}` : undefined;
    if (!candidate || !publicOrigin) return fallback;

    try {
      return new URL(candidate).host === new URL(publicOrigin).host ? candidate : fallback;
    } catch {
      return fallback;
    }
  }

  @Get(':slug')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  form(@Param('slug') slug: string) {
    return this.service.publicForm(slug);
  }

  @Get(':slug/slots')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  slots(
    @Param('slug') slug: string,
    @Query('from') from: string,
    @Query('days') days?: string,
    @Query('serviceId') serviceId?: string,
    @Query('resourceId') resourceId?: string,
  ) {
    return this.service.slots(slug, from, Number(days || 14), serviceId, resourceId);
  }

  @Post(':slug/events')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  event(@Param('slug') slug: string, @Body() dto: PublicFormEventDto) {
    return this.service.trackPublicEvent(slug, dto);
  }

  @Post(':slug/coupon-validate')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async validateCoupon(@Param('slug') slug: string, @Body() dto: CouponValidateDto) {
    const code = dto.code?.trim();
    if (!code) throw new BadRequestException('CÃ³digo requerido');
    return this.service.validatePublicCoupon(slug, code, dto.startsAt ? new Date(dto.startsAt) : undefined);
  }

  @Post(':slug/survey')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  survey(
    @Param('slug') slug: string,
    @Body() dto: PublicSurveyResponseDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return this.service.createPublicSurveyResponse(slug, dto, ipAddress, userAgent, this.eventSourceUrl(slug, dto.eventSourceUrl));
  }

  @Post(':slug')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  create(
    @Param('slug') slug: string,
    @Body() dto: PublicReservationDto,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return this.service.createPublic(slug, dto, ipAddress, userAgent, this.eventSourceUrl(slug, dto.eventSourceUrl));
  }
}
