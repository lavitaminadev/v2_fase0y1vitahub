import { Body, Controller, Delete, Get, Param, Post, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedRequest } from '@shared/types/request';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import { CreatePodDto, SetPodClientsDto, SetPodMembersDto, UpdatePodDto } from './dto/pod.dto';
import { PodsService } from './pods.service';

@ApiTags('Pods') @ApiBearerAuth() @Controller('pods') @Roles(UserRole.ADMIN, UserRole.OPERATIONS_DIRECTOR)
export class PodsController {
  constructor(private readonly pods: PodsService) {}
  @Get() @ApiOperation({ summary: 'Listar pods, integrantes y cuentas' }) list(@Req() req: AuthenticatedRequest) { return this.pods.list(req.organizationId); }
  @Post() @ApiOperation({ summary: 'Crear pod' }) create(@Body() dto: CreatePodDto, @Req() req: AuthenticatedRequest) { return this.pods.create(req.organizationId, dto); }
  @Put(':id') update(@Param('id') id: string, @Body() dto: UpdatePodDto, @Req() req: AuthenticatedRequest) { return this.pods.update(id, req.organizationId, dto); }
  @Put(':id/members') setMembers(@Param('id') id: string, @Body() dto: SetPodMembersDto, @Req() req: AuthenticatedRequest) { return this.pods.setMembers(id, req.organizationId, dto.userIds); }
  @Put(':id/clients') setClients(@Param('id') id: string, @Body() dto: SetPodClientsDto, @Req() req: AuthenticatedRequest) { return this.pods.setClients(id, req.organizationId, dto.clientIds); }
  @Delete(':id') @Roles(UserRole.ADMIN) remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) { return this.pods.remove(id, req.organizationId); }
}
