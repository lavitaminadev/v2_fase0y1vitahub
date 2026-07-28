import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../../../src/core/auth/auth.service';

/**
 * Fuerza bruta contra una cuenta concreta.
 *
 * El límite por IP frena una ráfaga desde un origen, pero no un ataque repartido entre
 * muchas direcciones. El contador vive en la cuenta para que cuente los intentos vengan de
 * donde vengan, y el bloqueo es temporal para no convertir el ataque en una denegación de
 * servicio contra la persona legítima.
 */
describe('AuthService · bloqueo por intentos fallidos', () => {
  let userRepo: any;
  let service: AuthService;
  const hash = bcrypt.hashSync('ClaveReal1', 10);

  function buildUser(overrides: Record<string, unknown> = {}) {
    return {
      id: 'user-1', email: 'ana@vitahub.cl', name: 'Ana', password: hash,
      role: 'designer', organizationId: 'org-1', isActive: true,
      failedLoginAttempts: 0, lockedUntil: null, ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    userRepo = { findOne: vi.fn(), update: vi.fn().mockResolvedValue(undefined) };
    service = new AuthService(userRepo as never, {} as never, {} as never, {} as never, {} as never);
  });

  it('suma un intento cuando la contraseña es incorrecta', async () => {
    userRepo.findOne.mockResolvedValue(buildUser({ failedLoginAttempts: 2 }));

    await expect(service.validateUser('ana@vitahub.cl', 'incorrecta')).rejects.toThrow(UnauthorizedException);

    expect(userRepo.update).toHaveBeenCalledWith('user-1', expect.objectContaining({ failedLoginAttempts: 3 }));
  });

  it('bloquea la cuenta al quinto intento fallido', async () => {
    userRepo.findOne.mockResolvedValue(buildUser({ failedLoginAttempts: 4 }));

    await expect(service.validateUser('ana@vitahub.cl', 'incorrecta')).rejects.toThrow(UnauthorizedException);

    const patch = userRepo.update.mock.calls[0][1];
    expect(patch.lockedUntil).toBeInstanceOf(Date);
    expect(patch.lockedUntil.getTime()).toBeGreaterThan(Date.now());
    // El contador se reinicia: lo que retiene ahora es la fecha de bloqueo.
    expect(patch.failedLoginAttempts).toBe(0);
  });

  it('rechaza incluso con la contraseña correcta mientras el bloqueo siga vigente', async () => {
    userRepo.findOne.mockResolvedValue(buildUser({ lockedUntil: new Date(Date.now() + 10 * 60_000) }));

    await expect(service.validateUser('ana@vitahub.cl', 'ClaveReal1')).rejects.toThrow(/Cuenta bloqueada/);
  });

  it('deja entrar cuando el bloqueo ya expiró y limpia el estado', async () => {
    userRepo.findOne.mockResolvedValue(buildUser({ failedLoginAttempts: 3, lockedUntil: new Date(Date.now() - 60_000) }));

    const user = await service.validateUser('ana@vitahub.cl', 'ClaveReal1');

    expect(user.id).toBe('user-1');
    expect(userRepo.update).toHaveBeenCalledWith('user-1', { failedLoginAttempts: 0, lockedUntil: null });
  });

  it('no revela si el correo existe: responde igual que con contraseña incorrecta', async () => {
    userRepo.findOne.mockResolvedValue(null);

    await expect(service.validateUser('nadie@vitahub.cl', 'loquesea')).rejects.toThrow('Credenciales inválidas');
    expect(userRepo.update).not.toHaveBeenCalled();
  });
});
