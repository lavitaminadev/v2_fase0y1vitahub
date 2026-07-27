import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LoggerService } from './logger.service';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { LoggingInterceptor } from './logging.interceptor';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    LoggerService,
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
  exports: [LoggerService, MetricsService],
})
export class ObservabilityModule {}
