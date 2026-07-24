import { BadRequestException, Controller, ForbiddenException, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateMeetingUseCase } from './create-meeting.use-case';
import { ListMeetingsUseCase } from './list-meetings.use-case';
import { Meeting } from './meeting.entity';
import { ActionItem } from './action-item.entity';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { CreateActionItemDto } from './dto/create-action-item.dto';
import { UpdateActionItemDto } from './dto/update-action-item.dto';
import { MeetingType } from './meeting-type.enum';
import { ActionItemStatus } from './action-item-status.enum';
import { Roles } from '../../core/authorization/roles.decorator';
import { UserRole } from '../organizations/user-role.enum';
import type { AuthenticatedRequest } from '@shared/types/request';
import { GoogleCalendarService } from '../integrations/google/google-calendar.service';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { Client } from '../clients/client.entity';
import { User } from '../users/user.entity';

@ApiTags('Reuniones')
@Controller('meetings')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class MeetingsController {
  constructor(
    @InjectRepository(Meeting) private repo: Repository<Meeting>,
    @InjectRepository(ActionItem) private actionItemRepo: Repository<ActionItem>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private createMeeting: CreateMeetingUseCase,
    private listMeetings: ListMeetingsUseCase,
    private calendar: GoogleCalendarService,
  ) {}

  @Post()
  @Roles(UserRole.COMMUNITY_MANAGER, UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear una nueva reunion' })
  async create(@Body() dto: CreateMeetingDto, @Req() req: AuthenticatedRequest) {
    await this.assertClientAccess(req, dto.clientId);
    const { notes, ...meetingData } = dto;
    return this.createMeeting.execute({
      ...meetingData,
      organizationId: req.organizationId!,
      createdBy: req.user.id,
      type: dto.type || MeetingType.WEEKLY,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : new Date(),
      minutes: dto.minutes?.trim() || notes?.trim() || undefined,
    });
  }

  @Get()
  @Roles(UserRole.COMMUNITY_MANAGER, UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN, UserRole.CLIENT)
  @ApiOperation({ summary: 'Listar reuniones' })
  async list(@Query('type') type: string, @Req() req: AuthenticatedRequest) {
    const clientId = req.user.role === UserRole.CLIENT ? req.user.clientId : undefined;
    if (req.user?.role === UserRole.CLIENT && !clientId) throw new ForbiddenException('Client account is not associated');
    const assignedClientIds = req.user.role === UserRole.COMMUNITY_MANAGER
      ? (await this.clientRepo.find({ select: { id: true }, where: { organizationId: req.organizationId, communityManagerId: req.user.id } })).map((client) => client.id)
      : undefined;
    const meetings = await this.listMeetings.execute(req.organizationId!, type, clientId, assignedClientIds);
    if (meetings.length === 0) return [];
    const actionItems = await this.actionItemRepo.find({
      where: { meetingId: In(meetings.map((meeting) => meeting.id)) },
      order: { createdAt: 'ASC' },
    });
    const actionItemsByMeeting = new Map<string, ActionItem[]>();
    for (const item of actionItems) {
      const list = actionItemsByMeeting.get(item.meetingId) ?? [];
      list.push(item);
      actionItemsByMeeting.set(item.meetingId, list);
    }
    return meetings.map((meeting) => ({ ...meeting, actionItems: actionItemsByMeeting.get(meeting.id) ?? [] }));
  }

  @Get(':id')
  @Roles(UserRole.COMMUNITY_MANAGER, UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN, UserRole.CLIENT)
  @ApiOperation({ summary: 'Obtener una reunion' })
  async getOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const clientId = req.user.role === UserRole.CLIENT ? req.user.clientId : undefined;
    if (req.user.role === UserRole.CLIENT && !clientId) throw new ForbiddenException('Client account is not associated');
    const meeting = await this.repo.findOne({ where: { id, organizationId: req.organizationId, ...(clientId ? { clientId } : {}) } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    await this.assertClientAccess(req, meeting.clientId);
    const actionItems = await this.actionItemRepo.find({ where: { meetingId: id }, order: { createdAt: 'ASC' } });
    return { ...meeting, actionItems };
  }

  @Put(':id')
  @Roles(UserRole.COMMUNITY_MANAGER, UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Actualizar una reunion' })
  async update(@Param('id') id: string, @Body() dto: UpdateMeetingDto, @Req() req: AuthenticatedRequest) {
    const meeting = await this.repo.findOne({ where: { id, organizationId: req.organizationId } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    await this.assertClientAccess(req, meeting.clientId);
    await this.assertClientAccess(req, dto.clientId);
    if (dto.clientId !== undefined) meeting.clientId = dto.clientId;
    if (dto.title !== undefined) meeting.title = dto.title.trim();
    if (dto.type !== undefined) meeting.type = dto.type;
    const previousStatus = meeting.status;
    if (dto.status !== undefined) meeting.status = dto.status;
    if (dto.scheduledAt !== undefined) meeting.scheduledAt = new Date(dto.scheduledAt);
    if (dto.durationMinutes !== undefined) meeting.durationMinutes = dto.durationMinutes;
    if (dto.location !== undefined) meeting.location = dto.location.trim() || undefined;
    if (dto.meetingLink !== undefined) meeting.meetingLink = dto.meetingLink;
    if (dto.minutes !== undefined || dto.notes !== undefined) {
      meeting.minutes = dto.minutes?.trim() || dto.notes?.trim() || undefined;
    }
    const saved = await this.repo.save(meeting);
    if (meeting.clientId && previousStatus !== meeting.status && [previousStatus, meeting.status].includes('completed' as any)) {
      const period = new Date(meeting.scheduledAt);
      if (meeting.type === MeetingType.STRATEGIC) {
        await this.repo.manager.query('UPDATE account_cycles SET strategy_meeting_status = ? WHERE organization_id = ? AND client_id = ? AND year = ? AND month = ?', [meeting.status === 'completed' ? 'completed' : 'pending', req.organizationId, meeting.clientId, period.getFullYear(), period.getMonth() + 1]);
      } else {
        await this.repo.manager.query('UPDATE account_cycles SET weekly_meetings_completed = GREATEST(0, weekly_meetings_completed + ?) WHERE organization_id = ? AND client_id = ? AND year = ? AND month = ?', [meeting.status === 'completed' ? 1 : -1, req.organizationId, meeting.clientId, period.getFullYear(), period.getMonth() + 1]);
      }
    }
    return saved;
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Eliminar una reunion' })
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const meeting = await this.repo.findOne({ where: { id, organizationId: req.organizationId } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    await this.assertClientAccess(req, meeting.clientId);
    return this.repo.remove(meeting);
  }

  @Post(':id/google-calendar')
  @Roles(UserRole.COMMUNITY_MANAGER, UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Publicar reunion en Google Calendar' })
  async publishCalendar(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    const meeting = await this.repo.findOne({ where: { id, organizationId: req.organizationId } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    await this.assertClientAccess(req, meeting.clientId);
    const event = await this.calendar.createEvent(req.organizationId!, { summary: meeting.title, description: meeting.minutes, start: new Date(meeting.scheduledAt), durationMinutes: meeting.durationMinutes });
    meeting.location = event.calendarUrl ?? meeting.location;
    meeting.meetingLink = event.meetingLink ?? meeting.meetingLink;
    await this.repo.save(meeting);
    return { ...event, meeting };
  }

  @Post(':id/action-items')
  @Roles(UserRole.COMMUNITY_MANAGER, UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear compromiso de reunion' })
  async createActionItem(@Param('id') id: string, @Body() dto: CreateActionItemDto, @Req() req: AuthenticatedRequest) {
    const meeting = await this.repo.findOne({ where: { id, organizationId: req.organizationId } });
    if (!meeting) throw new NotFoundException('Meeting not found');
    await this.assertClientAccess(req, meeting.clientId);
    await this.assertAssignee(req.organizationId!, dto.assignedTo);
    return this.actionItemRepo.save(this.actionItemRepo.create({
      meetingId: id,
      description: dto.description.trim(),
      assignedTo: dto.assignedTo,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      status: ActionItemStatus.PENDING,
    }));
  }

  @Put('action-items/:actionItemId')
  @Roles(UserRole.COMMUNITY_MANAGER, UserRole.OPERATIONS_DIRECTOR, UserRole.ADMIN, UserRole.CLIENT)
  @ApiOperation({ summary: 'Actualizar compromiso de reunion' })
  async updateActionItem(@Param('actionItemId') actionItemId: string, @Body() dto: UpdateActionItemDto, @Req() req: AuthenticatedRequest) {
    const actionItem = await this.actionItemRepo.findOne({
      where: { id: actionItemId },
      relations: ['meeting'],
    });
    if (!actionItem || actionItem.meeting.organizationId !== req.organizationId) throw new NotFoundException('Action item not found');
    await this.assertClientAccess(req, actionItem.meeting.clientId);
    if (req.user.role === UserRole.CLIENT && (dto.description !== undefined || dto.assignedTo !== undefined || dto.dueAt !== undefined)) {
      throw new ForbiddenException('El cliente solo puede actualizar el estado del compromiso');
    }
    await this.assertAssignee(req.organizationId!, dto.assignedTo);
    if (dto.description != null) actionItem.description = dto.description.trim();
    if (dto.assignedTo !== undefined) actionItem.assignedTo = dto.assignedTo;
    if (dto.dueAt !== undefined) actionItem.dueAt = dto.dueAt ? new Date(dto.dueAt) : undefined;
    if (dto.status) {
      actionItem.status = dto.status;
      actionItem.completedAt = dto.status === ActionItemStatus.COMPLETED ? new Date() : undefined;
    }
    return this.actionItemRepo.save(actionItem);
  }

  private async assertClientAccess(req: AuthenticatedRequest, clientId?: string): Promise<void> {
    if (!clientId) return;
    const client = await this.clientRepo.findOne({ where: { id: clientId, organizationId: req.organizationId } });
    if (!client) throw new NotFoundException('Client not found');
    if (req.user.role === UserRole.CLIENT && req.user.clientId !== client.id) throw new NotFoundException('Client not found');
    if (req.user.role === UserRole.COMMUNITY_MANAGER && client.communityManagerId !== req.user.id) {
      throw new NotFoundException('Client not found');
    }
  }

  private async assertAssignee(organizationId: string, userId?: string): Promise<void> {
    if (!userId) return;
    const user = await this.userRepo.findOne({ where: { id: userId, organizationId, isActive: true } });
    if (!user) throw new BadRequestException('El responsable no pertenece a esta organizacion');
  }
}
