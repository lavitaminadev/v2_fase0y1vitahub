import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'crypto';
import type { AuthenticatedRequest } from '../../shared/types/request';
import { AuditService } from './audit.service';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SENSITIVE = /password|token|secret|authorization|cookie|credential|temporary/i;

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest & { method: string; originalUrl?: string; url?: string; params?: Record<string, string>; body?: unknown; ip?: string; socket?: { remoteAddress?: string } }>();
    if (!MUTATING.has(request.method) || !request.organizationId || !request.user?.id) return next.handle();
    const path = (request.originalUrl ?? request.url ?? '').split('?')[0].replace(/^\/api\/?/, '');
    const segments = path.split('/').filter(Boolean);
    const entityType = segments[0] ?? 'operation';
    const action = this.action(request.method, segments);
    const requestedId = request.params?.id ?? request.params?.pieceId ?? request.params?.gridId ?? request.params?.actionItemId;
    return next.handle().pipe(tap((response) => {
      const responseId = response && typeof response === 'object' && 'id' in response ? String((response as { id?: unknown }).id ?? '') : '';
      const entityId = UUID.test(requestedId ?? '') ? requestedId : UUID.test(responseId) ? responseId : null;
      void this.audit.log({
        organizationId: request.organizationId!, actorId: request.user.id, entityType, entityId,
        action, after: this.sanitize(request.body), reason: `request:${request.method.toLowerCase()}:${path}`,
        ipAddress: request.ip ?? request.socket?.remoteAddress,
      }).catch(() => undefined);
    }));
  }

  private action(method: string, segments: string[]): string {
    const last = segments.at(-1);
    if (last && !UUID.test(last) && !/^\d+$/.test(last) && !['users', 'clients', 'meetings', 'contracts', 'catalog', 'reporting', 'production', 'content'].includes(last)) return last.replace(/-/g, '_').slice(0, 50);
    return ({ POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' } as Record<string, string>)[method] ?? 'change';
  }

  private sanitize(value: unknown, depth = 0): unknown {
    if (depth > 3 || value == null) return value;
    if (Array.isArray(value)) return value.slice(0, 50).map((item) => this.sanitize(item, depth + 1));
    if (typeof value !== 'object') return typeof value === 'string' && value.length > 2000 ? `${value.slice(0, 2000)}...` : value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, SENSITIVE.test(key) ? '[REDACTED]' : this.sanitize(item, depth + 1)]));
  }
}
