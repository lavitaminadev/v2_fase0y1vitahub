import { NamingValidationResult } from './naming-validation-result';

const NAMING_PATTERN = /^([A-Z0-9]+)_([A-Z-]+)_([A-Z0-9-]+)_v(\d+)_(FINAL|BORRADOR|REVISION)$/i;

export function validate(fileName: string, clientCode: string): NamingValidationResult {
  const errors: string[] = [];

  if (/\s/.test(fileName)) {
    errors.push('No se permiten espacios en el nombre');
  }

  if (/[^A-Za-z0-9_.\-]/.test(fileName)) {
    errors.push('Solo caracteres alfanuméricos, guiones, underscores y puntos');
  }

  const expectedPrefix = clientCode.toUpperCase() + '_';
  if (!fileName.toUpperCase().startsWith(expectedPrefix)) {
    errors.push(`Debe comenzar con el código del cliente en mayúsculas (${clientCode}_)`);
  }

  if (!/_v\d+_/i.test(fileName)) {
    errors.push('Falta versión con prefijo v (ej. v2). Formato: _vN_');
  }

  const match = fileName.match(NAMING_PATTERN);
  if (!match) {
    errors.push('Formato: CLIENTE_TIPO-PIEZA_FORMATO_vVERSIÓN_ESTADO (ej: GRDS_FLYER-LANZAMIENTO_FEED-1080x1080_v2_FINAL)');
    return new NamingValidationResult(fileName, false, errors);
  }

  return new NamingValidationResult(fileName, errors.length === 0, errors);
}

export function isValid(fileName: string, clientCode: string): boolean {
  return validate(fileName, clientCode).isValid;
}

export function extractState(fileName: string): string | null {
  const match = fileName.match(/_(FINAL|BORRADOR|REVISION)$/i);
  return match ? match[1].toUpperCase() : null;
}
