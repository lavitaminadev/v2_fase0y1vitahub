import { IsString, IsOptional, IsUUID, IsDateString, IsNumber, Matches, MaxLength, Min } from 'class-validator';

/**
 * DTO for creating an invoice.
 */
export class CreateInvoiceDto {
  /** Client id the invoice belongs to. */
  @IsUUID() clientId: string;
  /** Unique invoice number. */
  @IsString() @MaxLength(50) number: string;
  /** Issue date (ISO 8601). */
  @IsDateString() issuedAt: string;
  /** Due date (ISO 8601). */
  @IsDateString() dueAt: string;
  /** Subtotal amount. */
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) subtotal: number;
  /** Tax amount. */
  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) tax?: number;
  /** Total amount. */
  @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) total: number;
  /** ISO 4217 currency code. */
  @IsOptional() @IsString() @Matches(/^[A-Z]{3}$/) currency?: string;
  /** Optional notes. */
  @IsOptional() @IsString() @MaxLength(5000) notes?: string;
}
