import { IsString, IsOptional, IsNumber, IsEnum, Matches, MaxLength, Min } from 'class-validator';
import { ServiceCategory } from '../service-category.enum';

export class CreateServiceDto {
  @IsString() @MaxLength(255) name: string;
  @IsEnum(ServiceCategory) category: ServiceCategory;
  @IsOptional() @IsString() @MaxLength(5000) description?: string;
  @IsOptional() @IsNumber() @Min(0) unitPrice?: number;
  @IsOptional() @IsString() @Matches(/^[A-Z]{3}$/) currency?: string;
  @IsOptional() @IsNumber() @Min(0) udPerUnit?: number;
}
