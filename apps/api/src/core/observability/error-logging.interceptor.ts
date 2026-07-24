import { Injectable, NestInterceptor, ExecutionContext, Logger } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class ErrorLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('ErrorLogging');

  intercept(context: ExecutionContext, next: any): Observable<any> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();
    // RequestIdMiddleware runs earlier in the pipeline and owns request id generation.
    const requestId = req.requestId ?? 'unknown';

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        if (duration > 1000) {
          this.logger.warn(`[${requestId}] SLOW REQUEST: ${req.method} ${req.path} (${duration}ms)`);
        }
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || res.statusCode || 500;

        const errorContext = {
          requestId,
          method: req.method,
          path: req.path,
          statusCode,
          duration,
          userId: req.user?.id,
          organizationId: req.organizationId,
          error: error.message,
          stack: error.stack?.split('\n').slice(0, 5).join('\n'),
        };

        if (statusCode >= 500) {
          this.logger.error(`[${requestId}] SERVER ERROR: ${JSON.stringify(errorContext)}`);
        } else if (statusCode >= 400) {
          this.logger.warn(`[${requestId}] CLIENT ERROR: ${error.message}`);
        }

        return throwError(() => error);
      }),
    );
  }
}
