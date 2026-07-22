/**
 * @fileoverview Feature manifest contract used to register feature routes
 * and navigation entries dynamically.
 */

import type { ComponentType, ReactNode } from 'react';
import type { UserRole } from '@vitahub/shared';

/**
 * Route registered by a feature module.
 */
export interface FeatureRoute {
  /** React Router path. */
  path: string;
  /** Lazy-loaded route component. */
  element: ComponentType;
}

/**
 * Navigation entry exposed by a feature module.
 */
export interface FeatureNavigation {
  /** Visible label in the sidebar. */
  label: string;
  /** Target route path. */
  path: string;
  /** Icon rendered in the sidebar (emoji or SVG). */
  icon: ReactNode;
  /** Optional role allow-list. When omitted, the item is visible to everyone. */
  roles?: UserRole[];
}

/**
 * Feature descriptor consumed by the navigation registry.
 */
export interface FeatureManifest {
  /** Unique feature identifier. */
  id: string;
  /** Human-readable feature name. */
  name: string;
  /** Routes exposed by the feature. */
  routes: FeatureRoute[];
  /** Navigation entries exposed by the feature. */
  navigation: FeatureNavigation[];
  /** Optional permission keys required to enable the feature. */
  permissions?: string[];
  /** Optional feature ids that must be present for this feature to work. */
  dependencies?: string[];
  /** Whether the feature is enabled. Defaults to true. */
  enabled?: boolean;
}
