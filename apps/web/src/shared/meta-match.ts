export interface MetaMatchData {
  fbclid?: string;
  fbp?: string;
  fbc?: string;
}

function getCookie(name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escaped}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

export function readMetaMatchData(): MetaMatchData {
  const params = new URLSearchParams(window.location.search);
  const fbclid = params.get('fbclid') || undefined;
  const fbp = getCookie('_fbp') || undefined;
  const fbcCookie = getCookie('_fbc');
  const fbc = fbcCookie || (fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined);
  return { fbclid, fbp, fbc };
}
