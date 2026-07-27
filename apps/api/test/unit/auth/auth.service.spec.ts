import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException, ConflictException, ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'crypto';

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
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
  hash: vi.fn(),
  compare: vi.fn(),
}));

import { AuthService } from '../../../src/core/auth/auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ALLOW_PUBLIC_REGISTRATION = 'true';
    service = new AuthService(mockUserRepo as any, mockOrgRepo as any, mockResetRepo as any, mockEmailService as any, mockJwtService as any);
  });

  describe('register', () => {
    it('should create user, hash password, and return tokens', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      mockOrgRepo.create.mockReturnValue({ id: 'org-1', name: 'Test Org', code: 'test' });
      mockOrgRepo.save.mockResolvedValue({ id: 'org-1', name: 'Test Org', code: 'test' });
      (bcrypt.hash as any).mockResolvedValue('hashed_password');
      mockUserRepo.create.mockReturnValue({
        id: 'user-1', email: 'test@example.com', name: 'Test', password: 'hashed_password',
        organizationId: 'org-1', role: 'designer',
      });
      mockUserRepo.save.mockResolvedValue({
        id: 'user-1', email: 'test@example.com', name: 'Test',
        organizationId: 'org-1', role: 'designer',
      });
      mockJwtService.sign.mockReturnValue('access-token');

      const result = await service.register({
        email: 'test@example.com', password: 'secret123', name: 'Test',
      });

      expect(bcrypt.hash).toHaveBeenCalledWith('secret123', 10);
      expect(result.accessToken).toBe('access-token');
      expect(result.user.email).toBe('test@example.com');
    });

    it('should throw ConflictException if email already exists', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(service.register({
        email: 'existing@example.com', password: 'secret123', name: 'Test',
      })).rejects.toThrow(ConflictException);
    });

    it('keeps public registration disabled unless explicitly enabled', async () => {
      process.env.ALLOW_PUBLIC_REGISTRATION = 'false';
      await expect(service.register({
        email: 'nuevo@example.com', password: 'secret123', name: 'Nuevo',
      })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('login / validateUser', () => {
    it('should validate credentials and return tokens', async () => {
      const mockUser = {
        id: 'user-1', email: 'a@b.com', name: 'A', password: 'hashed',
        role: 'designer', organizationId: 'org-1', avatarUrl: null,
      };
      mockUserRepo.findOne.mockResolvedValue(mockUser);
      (bcrypt.compare as any).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('access-token');

      const user = await service.validateUser('a@b.com', 'password123');
      expect(user.email).toBe('a@b.com');

      const tokens = await service.login(user);
      expect(tokens.accessToken).toBe('access-token');
      expect(tokens.refreshToken).toBe('access-token');
      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', {
        refreshToken: createHash('sha256').update('access-token').digest('hex'),
      });
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-1', email: 'a@b.com', password: 'hashed',
      });
      (bcrypt.compare as any).mockResolvedValue(false);

      await expect(service.validateUser('a@b.com', 'wrong')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(service.validateUser('no@user.com', 'pass')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('should return a new access token for valid refresh token', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 'user-1', email: 'a@b.com' });
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-1', refreshToken: 'valid-refresh', email: 'a@b.com', role: 'designer',
        organizationId: 'org-1',
      });
      mockJwtService.sign.mockReturnValue('new-access-token');

      const result = await service.refreshToken('valid-refresh');
      expect(result.accessToken).toBe('new-access-token');
      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', {
        refreshToken: createHash('sha256').update('new-access-token').digest('hex'),
      });
    });

    it('should throw UnauthorizedException if refresh token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => { throw new Error(); });

      await expect(service.refreshToken('bad-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('revokes the persisted refresh token', async () => {
      await service.logout('user-1');
      expect(mockUserRepo.update).toHaveBeenCalledWith('user-1', { refreshToken: null });
    });
  });
});
