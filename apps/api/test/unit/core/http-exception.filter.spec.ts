import { ArgumentsHost } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from '../../../src/core/errors/http-exception.filter';

function createHost() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const request = { requestId: 'request-1', method: 'POST', url: '/api/users' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  const previousNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  it('translates duplicate database records without exposing SQL details', () => {
    process.env.NODE_ENV = 'production';
    const { host, status, json } = createHost();
    const error = new QueryFailedError('INSERT INTO users...', [], { code: 'ER_DUP_ENTRY', message: 'secret SQL detail' });

    new HttpExceptionFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Ya existe un registro con esos datos' }));
    expect(JSON.stringify(json.mock.calls)).not.toContain('secret SQL detail');
  });

  it('uses a generic production message for unexpected exceptions', () => {
    process.env.NODE_ENV = 'production';
    const { host, status, json } = createHost();

    new HttpExceptionFilter().catch(new Error('database host and password leaked'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Internal server error' }));
    expect(JSON.stringify(json.mock.calls)).not.toContain('password leaked');
  });
});
