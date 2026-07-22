import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PieceStatus } from '../../src/modules/production/piece-status.enum';
import { CorrectionOrigin } from '../../src/modules/production/correction-origin.enum';

const mockPieceRepo = {
  save: vi.fn(),
  manager: { transaction: vi.fn() },
};

const mockVersionRepo = {
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
};

const mockCorrectionRepo = {};

const mockDesignBudget = {
  calculateForPiece: vi.fn().mockReturnValue(1.5),
  reserveForPiece: vi.fn(),
  confirmConsumption: vi.fn(),
};

const mockXp = {
  registerDelivery: vi.fn(),
  registerDesignerErrorPenalty: vi.fn(),
};
const mockBilling = { createCorrectionCharge: vi.fn() };

import { ProductionWorkflowService } from '../../src/modules/production/production-workflow.service';

describe('Production Flow Integration', () => {
  let workflow: ProductionWorkflowService;

  beforeEach(() => {
    vi.clearAllMocks();
    workflow = new ProductionWorkflowService(
      mockPieceRepo as any,
      mockVersionRepo as any,
      mockCorrectionRepo as any,
      mockDesignBudget as any,
      mockXp as any,
      mockBilling as any,
    );
  });

  it('should complete full flow: create piece -> assign -> submit version -> deliver', async () => {
    const piece = {
      id: 'piece-1',
      organizationId: 'org-1',
      clientId: 'client-1',
      title: 'Test Piece',
      type: 'post_simple',
      status: PieceStatus.BACKLOG,
      difficultyLevel: 3,
      udAmount: 0,
      createdAt: new Date(),
      assignedTo: 'designer-1',
    };

    // Assign
    const mockManager = {
      save: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockReturnValue({}),
      findOne: vi.fn().mockResolvedValue(piece),
    };
    mockPieceRepo.manager.transaction = vi.fn((cb: any) => cb(mockManager));

    await workflow.assign(piece as any, 'designer-1', 'post_simple', 3, 0);

    expect(mockDesignBudget.calculateForPiece).toHaveBeenCalledWith('post_simple', 0);
    expect(piece.assignedTo).toBe('designer-1');
    expect(piece.status).toBe(PieceStatus.ASSIGNED);

    // Submit version
    mockVersionRepo.findOne.mockResolvedValue(null);
    mockVersionRepo.create.mockReturnValue({
      pieceId: 'piece-1', versionNumber: 1, fileName: 'GRDS_POST_v1_FINAL',
      driveFileId: 'drive-123', createdBy: 'designer-1',
    });
    mockVersionRepo.save.mockResolvedValue({
      id: 'version-1', versionNumber: 1, fileName: 'GRDS_POST_v1_FINAL',
    });

    const version = await workflow.submitVersion(
      piece as any, 'GRDS_POST_v1_FINAL', 'drive-123', 'designer-1',
    );
    expect(version.versionNumber).toBe(1);
    expect(piece.status).toBe(PieceStatus.INTERNAL_REVIEW);

    // Deliver
    mockPieceRepo.manager.transaction = vi.fn((cb: any) => cb(mockManager));

    await workflow.deliver(piece as any, 'admin-1');

    expect(piece.status).toBe(PieceStatus.DELIVERED);
    expect(piece.deliveredAt).toBeInstanceOf(Date);
    expect(mockDesignBudget.confirmConsumption).toHaveBeenCalledWith(piece, 'admin-1', mockManager);
    expect(mockXp.registerDelivery).toHaveBeenCalledWith(piece, 'designer-1', expect.any(Date), mockManager);
  });
});
