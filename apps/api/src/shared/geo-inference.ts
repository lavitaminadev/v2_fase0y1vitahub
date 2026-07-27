/**
 * Inferencia de ubicación aproximada (país / región / ciudad) a partir del
 * teléfono, sin depender de ningún proveedor externo de geolocalización.
 *
 * Por qué el teléfono y no la IP:
 * - El teléfono ya se captura y es obligatorio en los formularios de reserva.
 * - Meta ya resuelve la geolocalización por su cuenta a partir del
 *   `client_ip_address` que le enviamos, así que resolver la IP nosotros sería
 *   trabajo duplicado y requeriría una base tipo MaxMind (~70 MB), inviable en
 *   el hosting compartido de iHosting.
 * - Lo que Meta NO puede deducir de la IP es el país/región declarado del
 *   usuario, y esos son campos propios de `user_data` que suben el Match
 *   Quality Score.
 *
 * Alcance: la precisión buscada es de zona/región, no de dirección exacta.
 * Los fijos chilenos codifican la región en el prefijo; los móviles (+569) no,
 * y en ese caso sólo se infiere el país.
 */

/** Regiones de Chile por prefijo de red fija (Plan Nacional de Numeración). */
const CL_AREA_CODES: Record<string, { region: string; city: string }> = {
  '2': { region: 'Region Metropolitana de Santiago', city: 'Santiago' },
  '32': { region: 'Valparaiso', city: 'Valparaiso' },
  '33': { region: 'Valparaiso', city: 'Quillota' },
  '34': { region: 'Valparaiso', city: 'San Felipe' },
  '35': { region: 'Valparaiso', city: 'San Antonio' },
  '41': { region: 'Biobio', city: 'Concepcion' },
  '42': { region: 'Nuble', city: 'Chillan' },
  '43': { region: 'Biobio', city: 'Los Angeles' },
  '45': { region: 'La Araucania', city: 'Temuco' },
  '51': { region: 'Coquimbo', city: 'La Serena' },
  '52': { region: 'Atacama', city: 'Copiapo' },
  '53': { region: 'Coquimbo', city: 'Ovalle' },
  '55': { region: 'Antofagasta', city: 'Antofagasta' },
  '57': { region: 'Tarapaca', city: 'Iquique' },
  '58': { region: 'Arica y Parinacota', city: 'Arica' },
  '61': { region: 'Magallanes', city: 'Punta Arenas' },
  '63': { region: 'Los Rios', city: 'Valdivia' },
  '64': { region: 'Los Lagos', city: 'Osorno' },
  '65': { region: 'Los Lagos', city: 'Puerto Montt' },
  '67': { region: 'Aysen', city: 'Coyhaique' },
  '71': { region: 'Maule', city: 'Talca' },
  '72': { region: "O'Higgins", city: 'Rancagua' },
  '73': { region: 'Maule', city: 'Linares' },
  '75': { region: 'Maule', city: 'Curico' },
};

/** Códigos de país que sabemos reconocer por prefijo E.164. */
const COUNTRY_PREFIXES: Array<{ prefix: string; country: string }> = [
  { prefix: '56', country: 'cl' },
  { prefix: '54', country: 'ar' },
  { prefix: '51', country: 'pe' },
  { prefix: '591', country: 'bo' },
  { prefix: '598', country: 'uy' },
  { prefix: '595', country: 'py' },
  { prefix: '57', country: 'co' },
  { prefix: '52', country: 'mx' },
  { prefix: '34', country: 'es' },
  { prefix: '1', country: 'us' },
];

export interface InferredLocation {
  /** ISO 3166-1 alpha-2 en minúsculas, ej. 'cl'. */
  country?: string;
  /** Región/estado normalizado, ej. 'regionmetropolitanadesantiago'. */
  region?: string;
  /** Ciudad normalizada, ej. 'santiago'. */
  city?: string;
}

/**
 * Normaliza texto según las reglas de Meta para `ct` y `st`: minúsculas, sin
 * acentos, sin espacios ni signos de puntuación.
 */
export function normalizeGeoValue(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** Deja sólo los dígitos de un teléfono en cualquier formato. */
function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Infiere país (y región/ciudad cuando el número es fijo chileno) desde un
 * teléfono. Devuelve un objeto vacío si no se puede inferir nada, nunca lanza.
 *
 * @param phone teléfono en cualquier formato
 * @param defaultCountryPrefix prefijo asumido si el número parece local
 */
export function inferLocationFromPhone(
  phone: string | null | undefined,
  defaultCountryPrefix = '56',
): InferredLocation {
  if (!phone) return {};
  let digits = digitsOnly(phone);
  if (!digits) return {};

  // Los números chilenos locales se guardan como 9 dígitos (ej. 912345678) o
  // como fijo sin código de país. Si no parece internacional, se antepone el
  // prefijo por defecto, igual que hace normalizePhoneForMeta.
  if (digits.length <= 9) digits = `${defaultCountryPrefix}${digits}`;

  const match = COUNTRY_PREFIXES
    .filter((entry) => digits.startsWith(entry.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  if (!match) return {};

  const result: InferredLocation = { country: match.country };

  // La región sólo se puede deducir de la red fija chilena.
  if (match.country !== 'cl') return result;

  const national = digits.slice(match.prefix.length);
  // Los móviles chilenos empiezan con 9 y no codifican región.
  if (national.startsWith('9')) return result;

  // Santiago usa prefijo de 1 dígito; el resto usa 2.
  const area = national.startsWith('2') ? '2' : national.slice(0, 2);
  const location = CL_AREA_CODES[area];
  if (!location) return result;

  return {
    country: match.country,
    region: normalizeGeoValue(location.region),
    city: normalizeGeoValue(location.city),
  };
}
