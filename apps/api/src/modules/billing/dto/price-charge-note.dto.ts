import { IsNumber, Min } from 'class-validator';

export class PriceChargeNoteDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount: number;
}
