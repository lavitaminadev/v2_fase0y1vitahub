export function uuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export function imageOverlayAlpha(value?: string): number {
  const visibility = Math.max(0, Math.min(100, Number(value || 88))) / 100;
  return Number((1 - visibility).toFixed(3));
}

export function safeDesignChoice(value: string | undefined, allowed: readonly string[], fallback: string): string {
  return value && allowed.includes(value) ? value : fallback;
}

export function safeNumber(value: string | undefined, fallback: number, min: number, max: number): number {
  const number = Number(value ?? fallback);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

export function visible(value: string | undefined, fallback = true): boolean {
  if (value === 'false') return false;
  if (value === 'true') return true;
  return fallback;
}

export function slotDateKey(startsAt: string, timezone: string): string {
  return new Date(startsAt).toLocaleDateString('es-CL', { timeZone: timezone });
}
