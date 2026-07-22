import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  private logger = new Logger(TenantInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const orgId = (req as any).organizationId;

    if (orgId) {
      this.logger.log(`Tenant context: ${orgId} — ${req.method} ${req.path}`);
    }

    return next.handle().pipe(
      tap(() => {
        const res = context.switchToHttp().getResponse();
        if (orgId) {
          res.setHeader('x-tenant-id', orgId);
        }
      }),
    );
  }
}
