import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { AuthController } from '../../../src/core/auth/auth.controller';

const auth = {
  register: vi.fn(),
  validateUser: vi.fn(),
  login: vi.fn(),
  refreshToken: vi.fn(),
  logout: vi.fn(),
  me: vi.fn(),
  updateProfile: vi.fn(),
};

const response = {
  cookie: vi.fn(),
  clearCookie: vi.fn(),
} as unknown as Response;

describe('AuthController browser sessions', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let controller: AuthController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AuthController(auth as any);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('keeps the refresh token out of login JSON and sets a secure HttpOnly cookie', async () => {
    process.env.NODE_ENV = 'production';
    auth.validateUser.mockResolvedValue({
      id: 'user-1', name: 'Ana', email: 'ana@example.com', role: 'admin',
      organizationId: 'org-1', avatarUrl: null, clientId: null,
    });
    auth.login.mockResolvedValue({
      accessToken: 'access-token', refreshToken: 'refresh-token', user: {},
    });

    const result = await controller.login(
      { email: 'ana@example.com', password: 'secret123' },
      response,
    );

    expect(result).not.toHaveProperty('refreshToken');
    expect(response.cookie).toHaveBeenCalledWith('vitahub_refresh', 'refresh-token', expect.objectContaining({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/api/auth',
    }));
  });

  it('prefers the cookie and replaces it after token rotation', async () => {
    auth.refreshToken.mockResolvedValue({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    const request = { headers: { cookie: 'other=x; vitahub_refresh=cookie-token' } } as Request;

    const result = await controller.refresh({ refreshToken: 'body-token' }, request, response);

    expect(auth.refreshToken).toHaveBeenCalledWith('cookie-token');
    expect(result).toEqual({ accessToken: 'new-access' });
    expect(response.cookie).toHaveBeenCalledWith('vitahub_refresh', 'new-refresh', expect.any(Object));
  });

  it('revokes the session and clears the browser cookie on logout', async () => {
    await controller.logout({ id: 'user-1' } as any, response);

    expect(auth.logout).toHaveBeenCalledWith('user-1');
    expect(response.clearCookie).toHaveBeenCalledWith('vitahub_refresh', expect.objectContaining({
      httpOnly: true,
      path: '/api/auth',
    }));
  });
});
