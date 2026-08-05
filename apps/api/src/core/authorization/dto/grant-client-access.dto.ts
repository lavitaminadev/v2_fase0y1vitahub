import { IsOptional, IsString, MaxLength } from 'class-validator';

export class GrantClientAccessDto {
  /**
   * Por qué esta persona necesita esta cuenta estando fuera de su pod.
   *
   * Opcional para no frenar una urgencia, pero se pide en la interfaz: una excepción sin
   * motivo es la que nadie se atreve a quitar después, porque ya nadie recuerda para qué era.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
