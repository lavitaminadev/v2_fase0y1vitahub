import { IsUUID, IsInt, IsBoolean, IsOptional, IsNumber, Min, IsString } from 'class-validator';

export class RegisterDeliveryDto {
  @IsUUID() userId: string;
  @IsUUID() pieceId: string;
  @IsInt() @Min(1) difficultyLevel: number;
  @IsNumber() @Min(0) actualHours: number;
  @IsOptional() @IsInt() @Min(0) expectedHours?: number;
  @IsBoolean() perfectNaming: boolean;
  @IsBoolean() hadDesignerErrorCorrection: boolean;
  @IsOptional() @IsString() delayJustification?: string;
}
