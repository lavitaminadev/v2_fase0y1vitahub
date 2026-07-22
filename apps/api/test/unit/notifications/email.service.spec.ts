import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock('nodemailer', () => ({
  default: { createTransport: mocks.createTransport },
}));

import { EmailService } from '../../../src/core/notifications/email.service';

const SMTP_KEYS = [
  'SMTP_ENABLED', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE',
  'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM', 'SMTP_REPLY_TO',
];

describe('EmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sendMail.mockResolvedValue({ accepted: ['recipient@example.com'], messageId: 'message-1' });
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
  });

  afterEach(() => {
    for (const key of SMTP_KEYS) delete process.env[key];
  });

  it('does not report success when SMTP is disabled', async () => {
    process.env.SMTP_ENABLED = 'false';
    const service = new EmailService();

    await expect(service.send('recipient@example.com', 'Alert', '<p>Body</p>')).resolves.toBe(false);
    expect(mocks.createTransport).not.toHaveBeenCalled();
  });

  it('uses the configured secure transport and escapes dynamic HTML', async () => {
    Object.assign(process.env, {
      SMTP_ENABLED: 'true',
      SMTP_HOST: 'mail.example.com',
      SMTP_PORT: '465',
      SMTP_SECURE: 'true',
      SMTP_USER: 'notifications@example.com',
      SMTP_PASSWORD: 'secret',
      SMTP_FROM: 'notifications@example.com',
    });
    const service = new EmailService();

    await expect(service.sendPieceStuckAlert('recipient@example.com', '<script>alert(1)</script>', 12)).resolves.toBe(true);
    expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'mail.example.com', port: 465, secure: true, requireTLS: false,
    }));
    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      html: expect.stringContaining('&lt;script&gt;alert(1)&lt;/script&gt;'),
    }));
    expect(mocks.sendMail.mock.calls[0][0].html).not.toContain('<script>');
  });
});
