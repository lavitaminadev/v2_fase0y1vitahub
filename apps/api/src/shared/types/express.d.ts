import 'express';
import type { AuthUser } from './request';

declare module 'express' {
  interface Request {
    requestId?: string;
    user?: AuthUser;
    organizationId?: string;
  }
}
