import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { Roles } from '../../../core/authorization/roles.decorator';
import { UserRole } from '../../organizations/user-role.enum';
import { AccountAccessService } from '../../../core/client-scope/account-access.service';
import type { AuthenticatedRequest } from '@shared/types/request';
import { ModuleScope } from '../../../core/authorization/module-scope.decorator';

@Controller('crm/contacts')
@UseGuards(AuthGuard('jwt'))
@Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
@ModuleScope('crm')
export class ContactsController {
  constructor(
    private service: ContactsService,
    private readonly accountAccess: AccountAccessService,
  ) {}

  @Post()
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
  create(@Body() dto: CreateContactDto, @Req() req: AuthenticatedRequest) {
    return this.service.create(dto, req.organizationId);
  }

  @Get()
  async findAll(@Query() query: PaginationDto, @Query('clientId') clientId: string | undefined, @Req() req: AuthenticatedRequest) {
    await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
    const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    return this.service.findAll(req.organizationId, query.limit, query.offset, clientId, allowed);
  }

  @Get('segments')
  async segments(@Query('clientId') clientId: string | undefined, @Req() req: AuthenticatedRequest) {
    await this.accountAccess.assertClient(req.organizationId, req.user, clientId);
    const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    return this.service.segments(req.organizationId, clientId, allowed);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    return this.service.findOne(id, req.organizationId, allowed);
  }

  @Put(':id')
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
  async update(@Param('id') id: string, @Body() dto: UpdateContactDto, @Req() req: AuthenticatedRequest) {
    const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    return this.service.update(id, dto, req.organizationId, allowed);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const allowed = await this.accountAccess.allowedClientIds(req.organizationId, req.user);
    return this.service.remove(id, req.organizationId, allowed);
  }
}
