import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CronController } from '../../../src/core/cron/cron.controller';

describe('CronController', () => {
  const outbox = { processPending: vi.fn(), stats: vi.fn() };
  let controller: CronController;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-secret';
    controller = new CronController(outbox as never);
  });

  describe('verifySecret', () => {
    it('rejects requests when CRON_SECRET is not configured', async () => {
      delete process.env.CRON_SECRET;
      await expect(controller.processMetaCapi('some-secret')).rejects.toThrow('CRON_SECRET not configured');
    });

    it('rejects requests with wrong CRON_SECRET', async () => {
      process.env.CRON_SECRET = 'correct-secret';
      outbox.stats.mockResolvedValue({ pending: 0, retry: 0, failed: 0, processed: 0, total: 0 });
      await expect(controller.capiDiagnostics('wrong-secret')).rejects.toThrow('Invalid cron secret');
    });

    it('accepts requests with correct CRON_SECRET', async () => {
      process.env.CRON_SECRET = 'correct-secret';
      outbox.stats.mockResolvedValue({ pending: 3, retry: 1, failed: 0, processed: 10, total: 14 });
      const result = await controller.capiDiagnostics('correct-secret');
      expect(result.ok).toBe(true);
      expect(result.pending).toBe(3);
    });
  });

  describe('runMetaCapi', () => {
    it('returns processed and failed counts', async () => {
      outbox.processPending.mockResolvedValue({ processed: 5, failed: 1 });
      const result = await controller.processMetaCapi('test-secret');
      expect(result.ok).toBe(true);
      expect(result.processed).toBe(5);
      expect(result.failed).toBe(1);
      expect(outbox.processPending).toHaveBeenCalledWith(50);
    });

    it('accepts a custom limit via body', async () => {
      outbox.processPending.mockResolvedValue({ processed: 10, failed: 0 });
      const result = await controller.processMetaCapiPost('test-secret', 100);
      expect(result.ok).toBe(true);
      expect(outbox.processPending).toHaveBeenCalledWith(100);
    });

    it('skips if already running (mutex)', async () => {
      let resolvePending: (v: any) => void;
      outbox.processPending.mockReturnValue(new Promise((resolve) => { resolvePending = resolve; }));
      const first = controller.processMetaCapi('test-secret');
      const result = await controller.processMetaCapi('test-secret');
      expect(result.skipped).toBe('already_running');
      resolvePending!({ processed: 5, failed: 0 });
      await first;
      expect(outbox.processPending).toHaveBeenCalledTimes(1);
    });
  });

  describe('capiDiagnostics', () => {
    it('returns outbox stats', async () => {
      process.env.CRON_SECRET = 's3cr3t';
      outbox.stats.mockResolvedValue({ pending: 2, retry: 0, failed: 1, processed: 20, total: 23 });
      const result = await controller.capiDiagnostics('s3cr3t');
      expect(result.ok).toBe(true);
      expect(result.pending).toBe(2);
      expect(result.total).toBe(23);
    });
  });
});
