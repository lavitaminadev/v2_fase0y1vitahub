/**
 * @fileoverview Spinner de carga con texto de ayuda opcional.
 */

import { memo, type JSX } from 'react';

/**
 * Props del spinner de carga.
 */
export interface LoadingSpinnerProps {
  /** Texto mostrado debajo del spinner. */
  text?: string;
}

/**
 * Renderiza un indicador de carga centrado.
 */
export const LoadingSpinner = memo(function LoadingSpinner({ text = 'Cargando...' }: LoadingSpinnerProps): JSX.Element {
  return (
    <div className="loading-shell" role="status" aria-live="polite">
      <div className="loading-shell-top"><div className="spinner" /><p>{text}</p></div>
      <div className="loading-skeleton" aria-hidden="true"><i /><i /><i /><i /></div>
    </div>
  );
});
