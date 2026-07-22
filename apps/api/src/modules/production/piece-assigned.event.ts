export class PieceAssignedEvent {
  constructor(public readonly payload: { pieceId: string; designerId: string }) {}
}
