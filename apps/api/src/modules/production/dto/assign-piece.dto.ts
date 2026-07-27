import { IsUUID } from 'class-validator';

export class AssignPieceDto {
  @IsUUID() designerId: string;
}
