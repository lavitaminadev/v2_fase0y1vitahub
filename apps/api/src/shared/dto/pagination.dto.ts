import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Parámetros de query aceptados por los endpoints de listado paginado.
 */
export class PaginationDto {
  /** Cantidad máxima de items a devolver (1-100). */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
  /** Cantidad de items a saltar. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) offset?: number;
}

/**
 * Resultado paginado genérico devuelto por los endpoints de listado.
 *
 * @template T - Tipo de los items devueltos.
 */
export class PaginatedResult<T> {
  /** Items de la página actual. */
  data: T[];
  /** Total de items en todas las páginas. */
  total: number;
  /** Tamaño de página usado en la consulta. */
  limit: number;
  /** Offset usado en la consulta. */
  offset: number;

  constructor(data: T[], total: number, limit: number, offset: number) {
    this.data = data;
    this.total = total;
    this.limit = limit;
    this.offset = offset;
  }
}
