import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservationForm } from './domain/reservation-form.entity';
import { Reservation } from './domain/reservation.entity';
import { AvailabilityBlock } from './domain/availability-block.entity';
import { ReservationsService } from './application/reservations.service';
import { ReservationsController } from './reservations.controller';
import { PublicReservationsController } from './public-reservations.controller';
import { ReservationEvent } from './domain/reservation-event.entity';
import { ReservationFormEvent } from './domain/reservation-form-event.entity';
import { ReservationCoupon } from './domain/reservation-coupon.entity';
import { CrmModule } from '../crm/crm.module';
import { GoogleModule } from '../integrations/google/google.module';
import { MetaModule } from '../integrations/meta/meta.module';
import { NotificationsModule } from '../../core/notifications/notifications.module';

@Module({ imports: [TypeOrmModule.forFeature([ReservationForm, Reservation, AvailabilityBlock, ReservationEvent, ReservationFormEvent, ReservationCoupon]), CrmModule, GoogleModule, MetaModule, NotificationsModule], providers: [ReservationsService], controllers: [ReservationsController, PublicReservationsController], exports: [ReservationsService] })
export class ReservationsModule {}
