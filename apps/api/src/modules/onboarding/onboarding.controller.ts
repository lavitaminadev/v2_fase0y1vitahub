import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OnboardingService } from './onboarding.service';
import { CreateOnboardingDto } from './dto/create-onboarding.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';
import { ClientIdDto } from './dto/client-id.dto';

@Controller('onboarding')
@UseGuards(AuthGuard('jwt'))
@Roles(UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN)
export class OnboardingController {
  constructor(private service: OnboardingService) {}

  @Post()
  @Roles(UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN)
  create(@Body() dto: CreateOnboardingDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.organizationId);
  }

  @Post('templates/standard')
  @Roles(UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN)
  createStandardChecklist(@Body() dto: ClientIdDto, @Req() req: AuthenticatedRequest) {
    return this.service.createStandardChecklist(dto.clientId, req.organizationId);
  }

  @Get()
  findAll(@Query() query: PaginationDto, @Req() req: AuthenticatedRequest) {
    return this.service.findAll(req.organizationId, query.limit, query.offset);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.findOne(id, req.organizationId);
  }

  @Put(':id')
  @Roles(UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateOnboardingDto, @Req() req: AuthenticatedRequest) {
    return this.service.update(id, dto, req.organizationId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.remove(id, req.organizationId);
  }
}
