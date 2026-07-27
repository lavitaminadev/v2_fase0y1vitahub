import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { PaginationDto } from '../../../shared/dto/pagination.dto';
import { Roles } from '../../../core/authorization/roles.decorator';
import { UserRole } from '../../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';

@Controller('crm/contacts')
@UseGuards(AuthGuard('jwt'))
@Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
export class ContactsController {
  constructor(private service: ContactsService) {}

  @Post()
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
  create(@Body() dto: CreateContactDto, @Req() req: AuthenticatedRequest) {
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
  @Roles(UserRole.COMMERCIAL_DIRECTOR, UserRole.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateContactDto, @Req() req: AuthenticatedRequest) {
    return this.service.update(id, dto, req.organizationId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.remove(id, req.organizationId);
  }
}
