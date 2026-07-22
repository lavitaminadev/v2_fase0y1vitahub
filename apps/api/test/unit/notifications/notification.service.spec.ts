import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationService } from '../../../src/core/notifications/notification.service';

const repo = {
  find: vi.fn(),
  update: vi.fn(),
};

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new NotificationService(repo as never);
  });

  it('lists only the latest notifications in the organization and user scope', async () => {
    repo.find.mockResolvedValue([]);
    await service.findByUser('org-1', 'user-1');
    expect(repo.find).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', userId: 'user-1' },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  });

  it('marks unread notifications only inside the same scope', async () => {
    repo.update.mockResolvedValue({ affected: 3 });
    await expect(service.markAllAsRead('org-1', 'user-1')).resolves.toEqual({ updated: 3 });
    expect(repo.update).toHaveBeenCalledWith(
      { organizationId: 'org-1', userId: 'user-1', read: false },
      { read: true },
    );
  });
});
