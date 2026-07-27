import { IsArray, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreatePodDto {
  @IsString() @MinLength(2) @MaxLength(150) name: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsUUID() leaderId?: string;
  @IsNumber() @Min(1) @Max(100000) monthlyCapacityUd: number;
}

export class UpdatePodDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(150) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsUUID() leaderId?: string;
  @IsOptional() @IsNumber() @Min(1) @Max(100000) monthlyCapacityUd?: number;
  @IsOptional() @IsIn(['active', 'paused', 'archived']) status?: string;
}

export class SetPodMembersDto { @IsArray() @IsUUID(undefined, { each: true }) userIds: string[]; }
export class SetPodClientsDto { @IsArray() @IsUUID(undefined, { each: true }) clientIds: string[]; }
