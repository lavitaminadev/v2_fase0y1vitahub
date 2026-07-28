/**
 * @fileoverview Encabezado de página unificado.
 *
 * Sustituye a las nueve clases que existían para el mismo bloque (`.module-hero`,
 * `.settings-hero`, `.direction-hero`, `.knowledge-hero`, `.team-hero`,
 * `.governance-hero`, `.client-hero`, `.portal-welcome` y `.hero-header`), que diferían
 * en alto, escala tipográfica, familia y radio sin que la diferencia significara nada.
 */

import type { ReactNode } from 'react';
import './PageHero.css';

/** Cuánto peso visual ocupa el encabezado. */
export type PageHeroVariant =
  /** Sin fondo, para pantallas cuyo contenido empieza de inmediato. */
  | 'compact'
  /** Fondo de marca, altura media. Es el caso habitual. */
  | 'standard'
  /** Fondo de marca y más aire, para portadas de módulo con cifras al costado. */
  | 'feature';

/** Familia de color del fondo. Sin efecto en `compact`. */
export type PageHeroTone =
  /** Verde institucional. */
  | 'brand'
  /** Verde con acento cálido, para el portal del cliente. */
  | 'portal'
  /** Verde con acento ámbar, para la ficha de una entidad concreta. */
  | 'entity';

export interface PageHeroProps {
  /** Texto del encabezado principal. */
  title: string;
  /** Etiqueta breve sobre el título. */
  eyebrow?: string;
  /** Descripción de una línea bajo el título. */
  subtitle?: string;
  /** Peso visual. Por defecto `standard`. */
  variant?: PageHeroVariant;
  /** Familia de color. Por defecto `brand`. */
  tone?: PageHeroTone;
  /** Acciones alineadas a la derecha del título. */
  actions?: ReactNode;
  /** Bloque secundario a la derecha: cifras, marca o período. */
  aside?: ReactNode;
  /** Insignia junto al título, como el estado de un cliente. */
  badge?: ReactNode;
  /** Contenido a lo ancho bajo el encabezado, como una tira de datos. */
  footer?: ReactNode;
  /**
   * Nivel del encabezado. Es 1 salvo que la vista ya tenga su propio `h1`, en cuyo caso
   * baja a 2 para no romper la jerarquía del documento.
   */
  headingLevel?: 1 | 2;
  /** Pega el borde inferior al bloque siguiente, para pestañas encajadas. */
  attached?: boolean;
}

/**
 * Encabezado de página.
 *
 * @example
 * <PageHero eyebrow="LECTURA EJECUTIVA" title="Reportes" subtitle="Ingresos y carga real."
 *           aside={<PeriodSummary />} />
 */
export function PageHero({
  title,
  eyebrow,
  subtitle,
  variant = 'standard',
  tone = 'brand',
  actions,
  aside,
  badge,
  footer,
  headingLevel = 1,
  attached = false,
}: PageHeroProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  const classes = [
    'page-hero',
    `is-${variant}`,
    variant === 'compact' ? '' : `tone-${tone}`,
    attached ? 'is-attached' : '',
  ].filter(Boolean).join(' ');

  return (
    <section className={classes}>
      <div className="page-hero-main">
        {eyebrow && <span className="page-eyebrow">{eyebrow}</span>}
        <div className="page-hero-title">
          <Heading>{title}</Heading>
          {badge}
        </div>
        {subtitle && <p className="page-hero-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-hero-actions">{actions}</div>}
      {aside && <div className="page-hero-aside">{aside}</div>}
      {footer && <div className="page-hero-footer">{footer}</div>}
    </section>
  );
}
