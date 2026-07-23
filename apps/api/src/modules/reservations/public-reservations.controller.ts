import { BadRequestException, Body, Controller, Get, Headers, Ip, Param, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReservationsService } from './application/reservations.service';
import { PublicFormEventDto, PublicReservationDto } from './dto/reservation.dto';
import { Public } from '../../core/auth/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';

@Public() @ApiTags('Reservas públicas') @Controller('public/reservations')
export class PublicReservationsController {
  constructor(private service: ReservationsService) {}
  @Get(':slug') @Throttle({ default: { limit: 60, ttl: 60000 } }) form(@Param('slug') slug: string) { return this.service.publicForm(slug); }
  @Get(':slug/slots') @Throttle({ default: { limit: 120, ttl: 60000 } }) slots(@Param('slug') slug: string, @Query('from') from: string, @Query('days') days?: string, @Query('serviceId') serviceId?: string, @Query('resourceId') resourceId?: string) { return this.service.slots(slug, from, Number(days || 14), serviceId, resourceId); }
  @Post(':slug/events') @Throttle({ default: { limit: 30, ttl: 60000 } }) event(@Param('slug') slug: string, @Body() dto: PublicFormEventDto) { return this.service.trackPublicEvent(slug, dto); }
  @Post(':slug/coupon-validate') @Throttle({ default: { limit: 30, ttl: 60000 } }) async validateCoupon(@Param('slug') slug: string, @Body('code') code: string) {
    if (!code) throw new BadRequestException('Código requerido');
    return this.service.validatePublicCoupon(slug, code);
  }
  @Post(':slug') @Throttle({ default: { limit: 10, ttl: 60000 } }) create(@Param('slug') slug: string, @Body() dto: PublicReservationDto, @Ip() ipAddress: string, @Headers('user-agent') userAgent: string | undefined, @Req() req: Request) {
    const publicOrigin = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
    const eventSourceUrl = dto.eventSourceUrl
      || (typeof req.headers.referer === 'string' ? req.headers.referer : undefined)
      || (publicOrigin ? `${publicOrigin}/book/${encodeURIComponent(slug)}` : undefined);
    return this.service.createPublic(slug, dto, ipAddress, userAgent, eventSourceUrl);
  }
}
