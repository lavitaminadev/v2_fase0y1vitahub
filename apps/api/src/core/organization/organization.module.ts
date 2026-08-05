import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { OrganizationContextMiddleware } from './organization-context.middleware';
import { OrganizationStampSubscriber } from './organization-stamp.subscriber';

/**
 * Contexto de organización de la petición.
 *
 * `OrganizationContextGuard` no se registra acá sino en `AuthModule`, porque necesita
 * correr justo después de `JwtAuthGuard` y el orden de ejecución de los guards globales es
 * el orden en que se registran.
 */
@Module({
  providers: [OrganizationStampSubscriber],
})
export class OrganizationModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(OrganizationContextMiddleware).forRoutes('{*splat}');
  }
}
