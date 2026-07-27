import { IsUUID, IsInt, Min, Max } from 'class-validator';

export class ConfirmUdDto {
  @IsUUID() clientId: string;
  @IsUUID() pieceId: string;
  @IsInt() @Min(2024) year: number;
  @IsInt() @Min(1) @Max(12) month: number;
}
