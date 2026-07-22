export class PieceDeliveredEvent {
  constructor(public readonly payload: { pieceId: string }) {}
}
