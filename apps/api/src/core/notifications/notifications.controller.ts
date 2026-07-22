import { Controller, Get, Put, Param, Req, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import type { AuthenticatedRequest } from '@shared/types/request';
import { Roles } from '../authorization/roles.decorator';
import { UserRole } from '../../modules/organizations/user-role.enum';

@ApiTags('Notificaciones')
@Controller('notifications')
@Roles(...Object.values(UserRole))
export class NotificationsController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Listar notificaciones del usuario' })
  async findAll(@Req() req: AuthenticatedRequest) {
    return this.service.findByUser(req.organizationId || req.user.organizationId, req.user.id);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Obtener cantidad de notificaciones no leídas' })
  async unreadCount(@Req() req: AuthenticatedRequest) {
    const count = await this.service.unreadCount(req.organizationId || req.user.organizationId, req.user.id);
    return { unread: count };
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leidas' })
  markAllAsRead(@Req() req: AuthenticatedRequest) {
    return this.service.markAllAsRead(req.organizationId || req.user.organizationId, req.user.id);
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Marcar notificación como leída' })
  async markAsRead(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const notif = await this.service.markAsRead(req.organizationId || req.user.organizationId, id, req.user.id);
    if (!notif) throw new NotFoundException('Notification not found');
    return notif;
  }
}
