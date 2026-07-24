import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { LoggerService } from './logger.service';
import { MetricsService } from './metrics.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: LoggerService,
    private readonly metrics: MetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    // RequestIdMiddleware runs earlier in the pipeline and owns request id generation.
    const requestId = request.requestId ?? 'unknown';

    const { method, url } = request;
    const userId = request.user?.id;
    const organizationId = request.organizationId;

    this.logger.setRequestId(requestId);
    if (userId) this.logger.setUserId(userId);
    if (organizationId) this.logger.setOrganizationId(organizationId);

    this.metrics.incrementRequestCount();
    if (userId) this.metrics.trackActiveUser(userId);

    this.logger.log(`--> ${method} ${url}`, 'HTTP');

    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const responseTime = Date.now() - start;
          this.metrics.trackResponseTime(responseTime);
          this.logger.log(`<-- ${method} ${url} ${response.statusCode} ${responseTime}ms`, 'HTTP');
        },
        error: (error) => {
          const responseTime = Date.now() - start;
          this.metrics.incrementErrorCount();
          this.metrics.trackResponseTime(responseTime);
          const status = error.status || 500;
          this.logger.error(`<-- ${method} ${url} ${status} ${responseTime}ms - ${error.message}`, error.stack, 'HTTP');
        },
      }),
    );
  }
}
