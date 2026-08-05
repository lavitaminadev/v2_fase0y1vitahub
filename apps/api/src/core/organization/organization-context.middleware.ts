import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { organizationContext } from './organization-context';

/**
 * Abre el contexto async de la petición, vacío.
 *
 * Existe como middleware y no como guard porque `AsyncLocalStorage.run` necesita envolver
 * la continuación completa, y un guard devuelve antes de que corra el handler. Quien lo
 * llena es `OrganizationContextGuard`, ya con el usuario autenticado disponible.
 */
@Injectable()
export class OrganizationContextMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction): void {
    organizationContext.run({}, () => next());
  }
}
