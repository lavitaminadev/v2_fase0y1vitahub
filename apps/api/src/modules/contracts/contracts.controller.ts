import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Req, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';

@Controller('contracts')
@UseGuards(AuthGuard('jwt'))
@Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.OPERATIONS_DIRECTOR)
export class ContractsController {
  constructor(private service: ContractsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.OPERATIONS_DIRECTOR)
  create(@Body() dto: CreateContractDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.organizationId);
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
  @Roles(UserRole.ADMIN, UserRole.COMMERCIAL_DIRECTOR, UserRole.OPERATIONS_DIRECTOR)
  update(@Param('id') id: string, @Body() dto: UpdateContractDto, @Req() req: AuthenticatedRequest) {
    return this.service.update(id, dto, req.organizationId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.remove(id, req.organizationId);
  }
}
