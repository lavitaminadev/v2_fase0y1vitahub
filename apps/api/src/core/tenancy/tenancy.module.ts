import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TenantMiddleware } from './tenant.middleware';
import { TenantInterceptor } from './tenant.interceptor';
import { TenantGuard } from './tenant.guard';
import { TenantSubscriber } from './tenant.filter';

@Module({
  providers: [
    TenantSubscriber,
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
  ],
})
export class TenancyModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('{*splat}');
  }
}
