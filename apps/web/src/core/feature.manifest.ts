/**
 * @fileoverview Contrato de manifiesto de feature usado para registrar rutas
 * y entradas de navegación de forma dinámica.
 */

import type { ComponentType, ReactNode } from 'react';
import type { UserRole } from '@vitahub/shared';

/**
 * Ruta registrada por un módulo de feature.
 */
export interface FeatureRoute {
  /** Ruta de React Router. */
  path: string;
  /** Componente de ruta cargado de forma lazy. */
  element: ComponentType;
}

/**
 * Entrada de navegación expuesta por un módulo de feature.
 */
export interface FeatureNavigation {
  /** Etiqueta visible en el sidebar. */
  label: string;
  /** Ruta de destino. */
  path: string;
  /** Icono renderizado en el sidebar (emoji o SVG). */
  icon: ReactNode;
  /** Lista blanca de roles opcional. Si se omite, el item es visible para todos. */
  roles?: UserRole[];
}

/**
 * Descriptor de feature consumido por el registro de navegación.
 */
export interface FeatureManifest {
  /** Identificador único de la feature. */
  id: string;
  /** Nombre legible de la feature. */
  name: string;
  /** Rutas expuestas por la feature. */
  routes: FeatureRoute[];
  /** Entradas de navegación expuestas por la feature. */
  navigation: FeatureNavigation[];
  /** Claves de permiso opcionales requeridas para habilitar la feature. */
  permissions?: string[];
  /** Ids de features opcionales que deben estar presentes para que esta feature funcione. */
  dependencies?: string[];
  /** Si la feature está habilitada. Por defecto, true. */
  enabled?: boolean;
}
