/**
 * @fileoverview Metric card used in dashboards.
 */

import { memo, type JSX } from 'react';

/**
 * Props for the metric card component.
 */
export interface CardProps {
  /** Card title. */
  title: string;
  /** Main numeric or textual value. */
  value: string | number;
  /** Optional supporting text below the value. */
  subtitle?: string;
  /** Optional color override for the value. */
  color?: string;
  /** Optional emoji icon. */
  icon?: string;
}

/**
 * Renders a single metric card.
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
