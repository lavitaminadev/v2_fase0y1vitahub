export function normalizeSearch(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function matchesSearch(query: string, values: unknown[]): boolean {
  const normalizedQuery = normalizeSearch(query);
  if (!normalizedQuery) return true;
  return values.some((value) => normalizeSearch(value).includes(normalizedQuery));
}
