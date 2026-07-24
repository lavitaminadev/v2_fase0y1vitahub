import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Client } from './client.entity';

export interface ClientOverviewStats {
  client: Client;
  stats: {
    pendingPieces: number;
    contentGrids: number;
    meetings: number;
    upcomingMeetings: number;
    documents: number;
    reservationForms: number;
    publishedForms: number;
    contracts: number;
    activeContracts: number;
    briefs: number;
    approvedBriefs: number;
  };
  ud: {
    contracted: number;
    reserved: number;
    consumed: number;
  };
  pieceStatuses: Array<{ status: string; total: number }>;
  recentPieces: any[];
  recentMeetings: any[];
}

@Injectable()
export class ClientOverviewService {
  constructor(
    @InjectRepository(Client) private readonly clients: Repository<Client>,
    private readonly dataSource: DataSource,
  ) {}

  async getOverview(clientId: string, organizationId: string): Promise<ClientOverviewStats> {
    const client = await this.clients.findOne({ where: { id: clientId, organizationId } });
    if (!client) throw new Error('Client not found');

    // Query 1: All aggregations in one go
    const statsResult = await this.dataSource.query(`
      SELECT
        (SELECT JSON_OBJECT('pieces', (
          SELECT JSON_ARRAYAGG(JSON_OBJECT('status', status, 'total', COUNT(*)))
          FROM pieces WHERE organization_id = ? AND client_id = ? GROUP BY status
        ))) AS piece_data,
        (SELECT COUNT(*) FROM content_grids WHERE organization_id = ? AND client_id = ?) AS content_grids,
        (SELECT COUNT(*) FROM meetings WHERE organization_id = ? AND client_id = ?) AS meetings_total,
        (SELECT COUNT(*) FROM meetings WHERE organization_id = ? AND client_id = ? AND scheduled_at >= NOW()) AS upcoming_meetings,
        (SELECT COUNT(*) FROM documents WHERE organization_id = ? AND client_id = ?) AS documents,
        (SELECT COUNT(*) FROM reservation_forms WHERE organization_id = ? AND client_id = ?) AS forms_total,
        (SELECT COUNT(*) FROM reservation_forms WHERE organization_id = ? AND client_id = ? AND status = 'published') AS forms_published,
        (SELECT COUNT(*) FROM contracts WHERE organization_id = ? AND client_id = ?) AS contracts_total,
        (SELECT COUNT(*) FROM contracts WHERE organization_id = ? AND client_id = ? AND status = 'active') AS contracts_active,
        (SELECT COUNT(*) FROM briefs WHERE organization_id = ? AND client_id = ?) AS briefs_total,
        (SELECT COUNT(*) FROM briefs WHERE organization_id = ? AND client_id = ? AND status = 'approved') AS briefs_approved,
        (SELECT JSON_OBJECT('contracted', COALESCE(SUM(contracted), 0), 'reserved', COALESCE(SUM(reserved), 0), 'consumed', COALESCE(SUM(consumed), 0))
         FROM ud_budgets WHERE client_id = ? AND year = YEAR(NOW()) AND month = MONTH(NOW())) AS ud_data
    `, [
      organizationId, clientId,  // piece_data
      organizationId, clientId,  // content_grids
      organizationId, clientId, organizationId, clientId,  // meetings
      organizationId, clientId,  // documents
      organizationId, clientId, organizationId, clientId,  // forms
      organizationId, clientId, organizationId, clientId,  // contracts
      organizationId, clientId, organizationId, clientId,  // briefs
      clientId,  // ud_data
    ]);

    // Query 2: Recent items
    const [recentPieces, recentMeetings] = await Promise.all([
      this.dataSource.query(
        'SELECT id, title, status, deadline_at AS deadlineAt, ud_amount AS udAmount FROM pieces WHERE organization_id = ? AND client_id = ? ORDER BY updated_at DESC LIMIT 5',
        [organizationId, clientId],
      ),
      this.dataSource.query(
        'SELECT id, title, type, status, scheduled_at AS scheduledAt FROM meetings WHERE organization_id = ? AND client_id = ? ORDER BY scheduled_at DESC LIMIT 5',
        [organizationId, clientId],
      ),
    ]);

    const stats = statsResult[0];
    const pieceStatuses = JSON.parse(stats.piece_data)?.pieces || [];
    const udData = JSON.parse(stats.ud_data) || {};

    const pendingPieces = pieceStatuses.reduce((sum: number, row: any) =>
      ['delivered', 'cancelled'].includes(row.status) ? sum : sum + row.total, 0);

    return {
      client,
      stats: {
        pendingPieces,
        contentGrids: Number(stats.content_grids ?? 0),
        meetings: Number(stats.meetings_total ?? 0),
        upcomingMeetings: Number(stats.upcoming_meetings ?? 0),
        documents: Number(stats.documents ?? 0),
        reservationForms: Number(stats.forms_total ?? 0),
        publishedForms: Number(stats.forms_published ?? 0),
        contracts: Number(stats.contracts_total ?? 0),
        activeContracts: Number(stats.contracts_active ?? 0),
        briefs: Number(stats.briefs_total ?? 0),
        approvedBriefs: Number(stats.briefs_approved ?? 0),
      },
      ud: {
        contracted: Number(udData.contracted ?? 0),
        reserved: Number(udData.reserved ?? 0),
        consumed: Number(udData.consumed ?? 0),
      },
      pieceStatuses: pieceStatuses.map((row: any) => ({ status: row.status, total: row.total })),
      recentPieces,
      recentMeetings,
    };
  }
}
