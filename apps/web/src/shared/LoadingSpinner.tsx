/**
 * @fileoverview Loading spinner with optional helper text.
 */

import { memo, type JSX } from 'react';

/**
 * Props for the loading spinner.
 */
export interface LoadingSpinnerProps {
  /** Text shown below the spinner. */
  text?: string;
}

/**
 * Renders a centered loading indicator.
 */
export const LoadingSpinner = memo(function LoadingSpinner({ text = 'Cargando...' }: LoadingSpinnerProps): JSX.Element {
  return (
    <div className="loading-shell" role="status" aria-live="polite">
      <div className="loading-shell-top"><div className="spinner" /><p>{text}</p></div>
      <div className="loading-skeleton" aria-hidden="true"><i /><i /><i /><i /></div>
    </div>
  );
});
