/**
 * @fileoverview Card de métrica usada en los dashboards.
 */

import { memo, type JSX } from 'react';

/**
 * Props del componente de card de métrica.
 */
export interface CardProps {
  /** Título de la card. */
  title: string;
  /** Valor principal, numérico o de texto. */
  value: string | number;
  /** Texto de apoyo opcional debajo del valor. */
  subtitle?: string;
  /** Color alternativo opcional para el valor. */
  color?: string;
  /** Icono emoji opcional. */
  icon?: string;
}

/**
 * Renderiza una única card de métrica.
 */
export const Card = memo(function Card({ title, value, subtitle, color = '#1a1a2e', icon }: CardProps): JSX.Element {
  const marker = title.replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 2).toUpperCase();
  return (
    <div className="card">
      <div className="card-header">
        {icon && <span className="metric-marker" aria-hidden="true">{marker}</span>}
        <span className="card-title">{title}</span>
      </div>
      <div className="card-value" style={{ color }}>{value}</div>
      {subtitle && <div className="card-subtitle">{subtitle}</div>}
    </div>
  );
});
