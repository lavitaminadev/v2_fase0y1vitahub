import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

interface TeamRow {
  id: string;
  name: string;
  role: string;
  currentPieces: number | string;
  currentLoad: number | string;
  capacity: number;
}

@Injectable()
export class GetOperationsOverviewUseCase {
  constructor(
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async execute(organizationId: string) {
    const memberRows = await this.dataSource.query<TeamRow[]>(
      `SELECT u.id, u.name, u.role,
        COUNT(p.id) as currentPieces,
        COALESCE(SUM(p.ud_amount), 0) as currentLoad,
        u.weekly_capacity_ud as capacity
       FROM users u
       LEFT JOIN pieces p ON p.assigned_to = u.id AND p.organization_id = u.organization_id
         AND p.status NOT IN ('delivered','cancelled')
       WHERE u.organization_id = ? AND u.is_active = 1
       GROUP BY u.id, u.name, u.role, u.weekly_capacity_ud
       ORDER BY u.name ASC`, [organizationId]);

    const team = memberRows.map((member) => ({
      ...member,
      currentPieces: Number(member.currentPieces),
      currentLoad: Number(member.currentLoad),
      capacity: Number(member.capacity),
    }));

    const totalCapacity = team.reduce((sum, member) => sum + member.capacity, 0);
    const usedCapacity = team.reduce((sum, member) => sum + member.currentLoad, 0);

    const podRows = await this.dataSource.query<Array<Record<string, string | number>>>(
      `SELECT pod.id, pod.name, pod.status, pod.monthly_capacity_ud AS capacity,
              leader.name AS leaderName,
              (SELECT COUNT(*) FROM pod_members pm WHERE pm.pod_id = pod.id) AS memberCount,
              (SELECT COUNT(*) FROM clients c WHERE c.pod_id = pod.id AND c.organization_id = pod.organization_id) AS clientCount,
              (SELECT COALESCE(SUM(p.ud_amount), 0) FROM pieces p
                 WHERE p.organization_id = pod.organization_id
                   AND p.client_id IN (SELECT c2.id FROM clients c2 WHERE c2.pod_id = pod.id)
                   AND p.status NOT IN ('delivered','cancelled')) AS currentLoad
       FROM pods pod LEFT JOIN users leader ON leader.id = pod.leader_id
       WHERE pod.organization_id = ? AND pod.status <> 'archived'
       ORDER BY pod.name ASC`,
      [organizationId],
    );
    const pods = podRows.map((pod) => ({
      ...pod,
      capacity: Number(pod.capacity), memberCount: Number(pod.memberCount), clientCount: Number(pod.clientCount), currentLoad: Number(pod.currentLoad),
    }));
    return { pods, team, totalCapacity, usedCapacity };
  }
}
