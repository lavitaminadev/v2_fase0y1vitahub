import { IsUUID, IsNumber, Min, IsInt, Max } from 'class-validator';

export class ReserveUdDto {
  @IsUUID() clientId: string;
  @IsUUID() pieceId: string;
  @IsNumber() @Min(0.01) amount: number;
  @IsInt() @Min(2024) year: number;
  @IsInt() @Min(1) @Max(12) month: number;
}
