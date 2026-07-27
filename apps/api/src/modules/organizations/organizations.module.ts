import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './organization.entity';
import { OrganizationsController } from './organizations.controller';
import { CreateOrganizationUseCase } from './create-organization.use-case';
import { ListOrganizationsUseCase } from './list-organizations.use-case';
import { AuthModule } from '../../core/auth/auth.module';
import { AuditModule } from '../../core/audit/audit.module';

@Module({
  // AuthModule provee FeatureGuard, y a su vez importa entidades de este modulo: el
  // forwardRef rompe el ciclo de dependencias entre ambos.
  imports: [TypeOrmModule.forFeature([Organization]), forwardRef(() => AuthModule), AuditModule],
  controllers: [OrganizationsController],
  providers: [CreateOrganizationUseCase, ListOrganizationsUseCase],
  exports: [TypeOrmModule],
})
export class OrganizationsModule {}
