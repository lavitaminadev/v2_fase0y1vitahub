function parts(date: Date, timeZone: string): Record<string, string> {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

export function plainDateInZone(date: Date, timeZone: string): string {
  const value = parts(date, timeZone);
  return `${value.year}-${value.month}-${value.day}`;
}

export function localInputToUtc(value: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error('Selecciona una fecha y hora válidas');
  const [, year, month, day, hour, minute] = match;
  const target = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  let guess = target;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const represented = parts(new Date(guess), timeZone);
    const representedUtc = Date.UTC(Number(represented.year), Number(represented.month) - 1, Number(represented.day), Number(represented.hour), Number(represented.minute));
    guess -= representedUtc - target;
  }
  const check = parts(new Date(guess), timeZone);
  if (check.year !== year || check.month !== month || check.day !== day || check.hour !== hour || check.minute !== minute) throw new Error('Esa hora no existe en la zona horaria seleccionada');
  return new Date(guess).toISOString();
}
