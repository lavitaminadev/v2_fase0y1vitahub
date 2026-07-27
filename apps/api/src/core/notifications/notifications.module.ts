import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { NotificationService } from './notification.service';
import { NotificationsController } from './notifications.controller';
import { EmailModule } from './email.module';

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), EmailModule],
  controllers: [NotificationsController],
  providers: [NotificationService],
  exports: [NotificationService, TypeOrmModule, EmailModule],
})
export class NotificationsModule {}
