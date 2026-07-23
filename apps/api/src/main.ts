import './config/load-environment';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { Logger } from '@nestjs/common';
import { parseCorsOrigins, validateEnvironment } from './config/environment';
import type { Application } from 'express';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  validateEnvironment();
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? (process.env.NODE_ENV === 'production' ? 1 : 0));
  if (trustProxyHops > 0) {
    (app.getHttpAdapter().getInstance() as Application).set('trust proxy', trustProxyHops);
  }

  app.use(compression());

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://graph.facebook.com", "https://www.googleapis.com", "https://oauth2.googleapis.com"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));

  const allowedOrigins = parseCorsOrigins();
  app.enableCors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ''))) return callback(null, true);
      return callback(new Error('Origin not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    maxAge: 86400,
  });
  app.setGlobalPrefix('api');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('VITAHUB API')
    .setDescription('Sistema de Gestión de Agencia - API REST')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableShutdownHooks();

  await app.listen(process.env.PORT || 3000);
  logger.log(`VITAHUB API running on port ${process.env.PORT || 3000}`);
}
bootstrap();
