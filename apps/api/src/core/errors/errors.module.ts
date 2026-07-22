import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';

import { HttpExceptionFilter } from './http-exception.filter';
import { ValidationPipe } from './validation.pipe';
import { RequestIdMiddleware } from './request-id.middleware';

@Module({
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_PIPE,
      useClass: ValidationPipe,
    },
  ],
})
export class ErrorsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('{*splat}');
  }
}
