import { IsString, IsOptional, IsUUID, IsDateString, IsNumber, Matches, MaxLength, Min } from 'class-validator';

/**
 * DTO para crear una factura.
 */
export class CreateInvoiceDto {
  /** Id del cliente al que pertenece la factura. */
  @IsUUID() clientId: string;
  /** Número único de factura. */
  @IsString() @MaxLength(50) number: string;
  /** Fecha de emisión (ISO 8601). */
  @IsDateString() issuedAt: string;
  /** Fecha de vencimiento (ISO 8601). */
  @IsDateString() dueAt: string;
  /** Monto del subtotal. */
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) subtotal: number;
  /** Monto de impuestos. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) tax?: number;
  /** Monto total. */
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) total: number;
  /** Código de moneda ISO 4217. */
  @IsOptional() @IsString() @Matches(/^[A-Z]{3}$/) currency?: string;
  /** Notas opcionales. */
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}
