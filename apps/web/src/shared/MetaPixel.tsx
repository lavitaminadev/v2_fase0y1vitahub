import { useEffect } from 'react';

interface MetaPixelProps {
  pixelId?: string;
}

export function MetaPixel({ pixelId }: MetaPixelProps) {
  useEffect(() => {
    if (!pixelId) return;
    if (!window.fbq) {
      const queue = ((...args: unknown[]) => {
        if (queue.callMethod) queue.callMethod(...args);
        else queue.queue.push(args);
      }) as MetaFbq;
      queue.push = queue;
      queue.loaded = true;
      queue.version = '2.0';
      queue.queue = [];
      window.fbq = queue;
      window._fbq = queue;
    }

    if (!document.getElementById('meta-pixel-script')) {
      const script = document.createElement('script');
      script.id = 'meta-pixel-script';
      script.async = true;
      script.src = 'https://connect.facebook.net/en_US/fbevents.js';
      document.head.appendChild(script);
    }

    window.__vitahubMetaPixels ??= new Set<string>();
    if (!window.__vitahubMetaPixels.has(pixelId)) {
      window.fbq('init', pixelId);
      window.__vitahubMetaPixels.add(pixelId);
    }
    window.fbq('trackSingle', pixelId, 'PageView');
  }, [pixelId]);

  return null;
}

declare global {
  interface MetaFbq {
    (...args: unknown[]): void;
    callMethod?: (...args: unknown[]) => void;
    push: MetaFbq;
    loaded: boolean;
    version: string;
    queue: unknown[][];
  }
  interface Window {
    fbq?: MetaFbq;
    _fbq?: unknown;
    __vitahubMetaPixels?: Set<string>;
  }
}
