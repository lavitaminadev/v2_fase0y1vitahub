import { IsUUID, IsInt, IsEnum } from 'class-validator';
import { XPEventType } from '../xp-event-type.enum';

export class RegisterPenaltyDto {
  @IsUUID() userId: string;
  @IsUUID() pieceId: string;
  @IsInt() points: number;
  @IsEnum(XPEventType) eventType: XPEventType;
}
