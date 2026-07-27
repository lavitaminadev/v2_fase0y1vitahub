import type { JSX } from 'react';

interface BrandAssetProps {
  className?: string;
  decorative?: boolean;
}

export function BrandMark({ className = '', decorative = false }: BrandAssetProps): JSX.Element {
  return (
    <span className={`brand-mark ${className}`.trim()}>
      <img
        src="/brand/la-vitamina-mark.svg"
        width="513"
        height="463"
        alt={decorative ? '' : 'La Vitamina'}
        aria-hidden={decorative || undefined}
      />
    </span>
  );
}

export function BrandLockup({ className = '', decorative = false }: BrandAssetProps): JSX.Element {
  return (
    <img
      className={`brand-lockup ${className}`.trim()}
      src="/brand/la-vitamina-lockup.png"
      width="240"
      height="46"
      alt={decorative ? '' : 'La Vitamina'}
      aria-hidden={decorative || undefined}
    />
  );
}
