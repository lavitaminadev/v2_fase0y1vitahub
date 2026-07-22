import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query parameters accepted by paginated list endpoints.
 */
export class PaginationDto {
  /** Maximum number of items to return (1-100). */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  /** Number of items to skip. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

/**
 * Generic paginated result returned by list endpoints.
 *
 * @template T - Type of the items returned.
 */
export class PaginatedResult<T> {
  /** Items for the current page. */
  data: T[];
  /** Total items across all pages. */
  total: number;
  /** Page size used for the query. */
  limit: number;
  /** Offset used for the query. */
  offset: number;

  constructor(data: T[], total: number, limit: number, offset: number) {
    this.data = data;
    this.total = total;
    this.limit = limit;
    this.offset = offset;
  }
}
