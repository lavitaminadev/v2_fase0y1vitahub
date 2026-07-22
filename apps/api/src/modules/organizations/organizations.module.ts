import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './organization.entity';
import { OrganizationsController } from './organizations.controller';
import { CreateOrganizationUseCase } from './create-organization.use-case';
import { ListOrganizationsUseCase } from './list-organizations.use-case';

@Module({
  imports: [TypeOrmModule.forFeature([Organization])],
  controllers: [OrganizationsController],
  providers: [CreateOrganizationUseCase, ListOrganizationsUseCase],
  exports: [TypeOrmModule],
})
export class OrganizationsModule {}
