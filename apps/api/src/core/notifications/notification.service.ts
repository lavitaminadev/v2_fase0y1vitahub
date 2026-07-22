import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './notification.entity';
import { User } from '../../modules/users/user.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(Notification) private repo: Repository<Notification>,
  ) {}

  async notifyUser(
    organizationId: string,
    userId: string,
    type: string,
    title: string,
    message: string,
    data?: Record<string, any>,
  ): Promise<Notification> {
    const notif = this.repo.create({ organizationId, userId, type, title, message, data });
    return this.repo.save(notif);
  }

  async notifyRole(
    orgId: string,
    role: string,
    type: string,
    title: string,
    message: string,
    data?: Record<string, any>,
  ): Promise<Notification[]> {
    const userRepo = this.repo.manager.getRepository(User);
    const users = await userRepo.find({
      where: { organizationId: orgId, role, isActive: true } as any,
    });
    return this.notifyMultiple(
      orgId,
      users.map((u) => u.id),
      type, title, message, data,
    );
  }

  async notifyMultiple(
    organizationId: string,
    userIds: string[],
    type: string,
    title: string,
    message: string,
    data?: Record<string, any>,
  ): Promise<Notification[]> {
    const notifs = userIds.map((userId) =>
      this.repo.create({ organizationId, userId, type, title, message, data }),
    );
    return this.repo.save(notifs);
  }

  async findByUser(organizationId: string, userId: string): Promise<Notification[]> {
    return this.repo.find({
      where: { organizationId, userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markAsRead(organizationId: string, id: string, userId: string): Promise<Notification | null> {
    const notif = await this.repo.findOne({ where: { organizationId, id, userId } });
    if (!notif) return null;
    notif.read = true;
    return this.repo.save(notif);
  }

  async unreadCount(organizationId: string, userId: string): Promise<number> {
    return this.repo.count({ where: { organizationId, userId, read: false } });
  }

  async markAllAsRead(organizationId: string, userId: string): Promise<{ updated: number }> {
    const result = await this.repo.update({ organizationId, userId, read: false }, { read: true });
    return { updated: result.affected ?? 0 };
  }
}
