import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards, Query, NotFoundException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AudiovisualService } from './audiovisual.service';
import { CreateMoodboardDto } from './dto/create-moodboard.dto';
import { UpdateMoodboardDto } from './dto/update-moodboard.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';

@Controller()
@UseGuards(AuthGuard('jwt'))
@Roles(UserRole.ADMIN, UserRole.CREATIVE_DIRECTOR, UserRole.OPERATIONS_DIRECTOR, UserRole.AV_DIRECTOR, UserRole.AUDIOVISUAL)
export class AudiovisualController {
  constructor(private service: AudiovisualService) {}

  @Post('moodboards')
  @Roles(UserRole.CREATIVE_DIRECTOR, UserRole.AV_DIRECTOR, UserRole.ADMIN)
  createMoodboard(@Body() dto: CreateMoodboardDto, @Req() req: AuthenticatedRequest) {
    return this.service.createMoodboard(dto, req.organizationId, req.user.id);
  }

  @Get('moodboards')
  @Roles(UserRole.ADMIN, UserRole.CREATIVE_DIRECTOR, UserRole.OPERATIONS_DIRECTOR, UserRole.AV_DIRECTOR)
  findAllMoodboards(@Query() query: PaginationDto, @Req() req: AuthenticatedRequest) {
    return this.service.findAllMoodboards(req.organizationId, query.limit, query.offset);
  }

  @Get('moodboards/:id')
  @Roles(UserRole.ADMIN, UserRole.CREATIVE_DIRECTOR, UserRole.OPERATIONS_DIRECTOR, UserRole.AV_DIRECTOR)
  findOneMoodboard(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.findOneMoodboard(id, req.organizationId);
  }

  @Put('moodboards/:id')
  @Roles(UserRole.CREATIVE_DIRECTOR, UserRole.AV_DIRECTOR, UserRole.ADMIN)
  updateMoodboard(@Param('id') id: string, @Body() dto: UpdateMoodboardDto, @Req() req: AuthenticatedRequest) {
    return this.service.updateMoodboard(id, dto, req.organizationId);
  }

  @Delete('moodboards/:id')
  @Roles(UserRole.ADMIN)
  removeMoodboard(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.removeMoodboard(id, req.organizationId);
  }

  @Post('sessions')
  @Roles(UserRole.OPERATIONS_DIRECTOR, UserRole.AV_DIRECTOR, UserRole.ADMIN)
  createSession(@Body() dto: CreateSessionDto, @Req() req: AuthenticatedRequest) {
    return this.service.createSession(dto, req.organizationId);
  }

  @Get('sessions')
  findAllSessions(@Query() query: PaginationDto, @Req() req: AuthenticatedRequest) {
    const assignedTo = req.user.role === UserRole.AUDIOVISUAL ? req.user.id : undefined;
    return this.service.findAllSessions(req.organizationId, query.limit, query.offset, assignedTo);
  }

  @Get('sessions/:id')
  async findOneSession(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const session = await this.service.findOneSession(id, req.organizationId);
    if (req.user.role === UserRole.AUDIOVISUAL && !session.assignedTeam?.includes(req.user.id)) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  @Put('sessions/:id')
  @Roles(UserRole.OPERATIONS_DIRECTOR, UserRole.AV_DIRECTOR, UserRole.ADMIN)
  updateSession(@Param('id') id: string, @Body() dto: UpdateSessionDto, @Req() req: AuthenticatedRequest) {
    return this.service.updateSession(id, dto, req.organizationId);
  }

  @Delete('sessions/:id')
  @Roles(UserRole.ADMIN)
  removeSession(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.service.removeSession(id, req.organizationId);
  }
}
