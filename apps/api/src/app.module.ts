import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuditInterceptor } from './core/audit/audit.interceptor';
import { ErrorLoggingInterceptor } from './core/observability/error-logging.interceptor';

import { ErrorsModule } from './core/errors/errors.module';
import { HealthModule } from './core/health/health.module';
import { AuthModule } from './core/auth/auth.module';
import { OrganizationModule } from './core/organization/organization.module';
import { AuditModule } from './core/audit/audit.module';
import { AuthorizationModule } from './core/authorization/authorization.module';
import { EventsModule } from './core/events/events.module';
import { JobsModule } from './core/jobs/jobs.module';
import { ParametersModule } from './core/parameters/parameters.module';
import { NotificationsModule } from './core/notifications/notifications.module';
import { ObservabilityModule } from './core/observability/observability.module';
import { CloudinaryModule } from './core/cloudinary/cloudinary.module';

import { OrganizationsModule } from './modules/organizations/organizations.module';
import { UsersModule } from './modules/users/users.module';
import { CrmModule } from './modules/crm/crm.module';
import { ClientsModule } from './modules/clients/clients.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { ProductionModule } from './modules/production/production.module';
import { DesignBudgetModule } from './modules/design-budget/design-budget.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { MeetingsModule } from './modules/meetings/meetings.module';
import { ContentModule } from './modules/content/content.module';
import { ReportsModule } from './modules/reports/reports.module';
import { BillingModule } from './modules/billing/billing.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { BriefsModule } from './modules/briefs/briefs.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { DashboardsModule } from './modules/dashboards/dashboards.module';
import { MetaModule } from './modules/integrations/meta/meta.module';
import { GoogleModule } from './modules/integrations/google/google.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { OperationsModule } from './modules/operations/operations.module';
import { AudiovisualModule } from './modules/audiovisual/audiovisual.module';
import { DataProtectionModule } from './core/data-protection/data-protection.module';
import { AccountCyclesModule } from './modules/account-cycles/account-cycles.module';
import { ObjectivesModule } from './modules/objectives/objectives.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { AccountAccessModule } from './core/client-scope/account-access.module';
import { CronModule } from './core/cron/cron.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { PodsModule } from './modules/pods/pods.module';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USERNAME = process.env.DB_USERNAME || 'vitahub';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_DATABASE = process.env.DB_DATABASE || 'vitahub';

/**
 * Conexiones que abre **cada proceso**, no la aplicación entera.
 *
 * Passenger levanta varios procesos y cada uno mantiene su propio pool, así que el consumo
 * real es este número por la cantidad de procesos, y ese producto debe caber en el
 * `max_connections` del servidor. Con el techo de procesos alto, un valor generoso acá deja
 * a los últimos procesos sin poder conectar y la aplicación falla al escalar, que es
 * justamente bajo carga.
 *
 * El cuello de las reservas es el bloqueo sobre la fila del formulario, que las serializa;
 * subir este número no las acelera, solo retiene más conexiones esperando ese bloqueo.
 *
 * Se lee del entorno para poder ajustarlo sin desplegar.
 */
const DB_CONNECTION_LIMIT = Math.max(1, parseInt(process.env.DB_CONNECTION_LIMIT || '10', 10) || 10);

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: DB_HOST,
      port: DB_PORT,
      username: DB_USERNAME,
      password: DB_PASSWORD,
      database: DB_DATABASE,
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/infrastructure/migrations/*{.ts,.js}'],
      synchronize: false,
      logging: process.env.DB_LOGGING === 'true',
      extra: {
        charset: 'utf8mb4_unicode_ci',
        connectionLimit: DB_CONNECTION_LIMIT,
        ...(process.env.NODE_ENV === 'production' ? { ssl: { rejectUnauthorized: true } } : {}),
      },
    }),
    // El almacenamiento del limitador vive en memoria del proceso, así que el límite
    // efectivo por IP es este número multiplicado por la cantidad de procesos de Passenger.
    // Configurable para poder alinearlo con esa cantidad sin desplegar. Un límite realmente
    // compartido exige un almacén común, que hoy no existe (ver roadmap).
    ThrottlerModule.forRoot([{
      ttl: Number(process.env.THROTTLE_TTL_MS ?? 60_000),
      limit: Number(process.env.THROTTLE_LIMIT ?? 100),
    }]),
    EventEmitterModule.forRoot(),
    ErrorsModule,
    HealthModule,
    AuthModule,
    OrganizationModule,
    AccountAccessModule,
    AuditModule,
    EventsModule,
    JobsModule,
    ParametersModule,
    NotificationsModule,
    ObservabilityModule,
    CloudinaryModule,
    OrganizationsModule,
    UsersModule,
    CrmModule,
    ClientsModule,
    ContractsModule,
    CatalogModule,
    ProductionModule,
    DesignBudgetModule,
    GamificationModule,
    IntegrationsModule,
    MeetingsModule,
    ContentModule,
    ReportsModule,
    BillingModule,
    ApprovalsModule,
    OnboardingModule,
    BriefsModule,
    DocumentsModule,
    DashboardsModule,
    MetaModule,
    GoogleModule,
    KnowledgeModule,
    UploadsModule,
    OperationsModule,
    AudiovisualModule,
    DataProtectionModule,
    AccountCyclesModule,
    ObjectivesModule,
    ReservationsModule,
    WorkflowsModule,
    PodsModule,
    CronModule,
    AuthorizationModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: ErrorLoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
