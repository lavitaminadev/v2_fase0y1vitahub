import { IsIn, IsInt, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateXpDisputeDto {
  @IsUUID() xpPeriodId: string;
  @IsString() @MinLength(10) @MaxLength(3000) message: string;
}

export class ResolveXpDisputeDto {
  @IsString() @IsIn(['accepted', 'rejected']) status: string;
  @IsString() @MinLength(3) @MaxLength(3000) resolution: string;
  @IsInt() @Min(-500) @Max(500) adjustmentPoints: number;
}
