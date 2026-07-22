import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockUserRepo = {
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
};

const mockOrgRepo = {
  create: vi.fn(),
  save: vi.fn(),
};

const mockJwtService = {
  sign: vi.fn(),
  verify: vi.fn(),
};
const mockResetRepo = { findOne: vi.fn(), create: vi.fn(), save: vi.fn(), update: vi.fn(), manager: { transaction: vi.fn() } };
const mockEmailService = { sendPasswordReset: vi.fn() };

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn(), compare: vi.fn() },
  hash: vi.fn(),
  compare: vi.fn(),
}));

import * as bcrypt from 'bcryptjs';
import { AuthService } from '../../src/core/auth/auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('Auth Integration', () => {
  let authService: AuthService;

  beforeEach(() => {
    process.env.ALLOW_PUBLIC_REGISTRATION = 'true';
    vi.clearAllMocks();
    authService = new AuthService(mockUserRepo as any, mockOrgRepo as any, mockResetRepo as any, mockEmailService as any, mockJwtService as any);
  });

  it('should complete full registration -> login -> me flow', async () => {
    // Register
    mockUserRepo.findOne.mockResolvedValueOnce(null);
    mockOrgRepo.create.mockReturnValue({ id: 'org-1', name: 'Test Org', code: 'test' });
    mockOrgRepo.save.mockResolvedValue({ id: 'org-1', name: 'Test Org', code: 'test' });
    (bcrypt.hash as any).mockResolvedValue('hashed_password');
    mockUserRepo.create.mockReturnValue({
      id: 'user-1', email: 'user@test.com', name: 'User', password: 'hashed_password',
      organizationId: 'org-1', role: 'designer',
    });
    mockUserRepo.save.mockResolvedValue({
      id: 'user-1', email: 'user@test.com', name: 'User',
      organizationId: 'org-1', role: 'designer',
    });
    mockJwtService.sign.mockReturnValue('test-access-token');

    const regResult = await authService.register({
      email: 'user@test.com', password: 'securePass1', name: 'User',
    });

    expect(regResult.accessToken).toBe('test-access-token');
    expect(regResult.user.email).toBe('user@test.com');

    // Login
    mockUserRepo.findOne.mockResolvedValueOnce({
      id: 'user-1', email: 'user@test.com', name: 'User', password: 'hashed_password',
      role: 'designer', organizationId: 'org-1', avatarUrl: null,
    });
    (bcrypt.compare as any).mockResolvedValue(true);
    mockJwtService.sign.mockReturnValue('new-access-token');

    const validatedUser = await authService.validateUser('user@test.com', 'securePass1');
    const loginResult = await authService.login(validatedUser);

    expect(loginResult.accessToken).toBe('new-access-token');

    // Access protected route (me)
    mockUserRepo.findOne.mockResolvedValueOnce({
      id: 'user-1', email: 'user@test.com', name: 'User', role: 'designer',
    });

    const me = await authService.me('user-1');
    expect(me.email).toBe('user@test.com');
  });

  it('should reject invalid credentials', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    await expect(
      authService.validateUser('nonexistent@test.com', 'anyPass'),
    ).rejects.toThrow(UnauthorizedException);
  });
});
