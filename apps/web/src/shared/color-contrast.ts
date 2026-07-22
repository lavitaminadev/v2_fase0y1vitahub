const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function normalizeHexColor(value: string | undefined, fallback: string): string {
  return value && HEX_COLOR.test(value) ? value : fallback;
}

function luminance(color: string): number {
  const channels = color.slice(1).match(/.{2}/g)!.map((channel) => parseInt(channel, 16) / 255);
  const [red, green, blue] = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(first: string, second: string): number {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

export function contrastText(background: string): '#ffffff' | '#17211e' {
  return contrastRatio(background, '#ffffff') >= 4.5 ? '#ffffff' : '#17211e';
}

export function accessibleForeground(preferred: string, background: string, fallback: string): string {
  return contrastRatio(preferred, background) >= 4.5 ? preferred : fallback;
}
