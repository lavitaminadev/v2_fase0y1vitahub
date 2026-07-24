import { IsString, IsOptional, MaxLength } from 'class-validator';

export class UpdateApprovalDto {
  @IsString() @MaxLength(20) status: string;
  @IsOptional() @IsString() @MaxLength(5000) decisionNotes?: string;
}
