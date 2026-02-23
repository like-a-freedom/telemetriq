/**
 * Template types and interfaces.
 */

import type { ExtendedOverlayConfig, TemplateId } from '../../core/types';

/** Metric type identifier */
export type MetricType = 'pace' | 'hr' | 'distance' | 'time';

/** Template capabilities - what the template supports and requires */
export interface TemplateCapabilities {
  /** Metrics that can be displayed (user can toggle these) */
  supportedMetrics: MetricType[];
  /** Metrics that are always shown (cannot be disabled) */
  requiredMetrics: MetricType[];
  /** Whether template supports position configuration */
  supportsPosition: boolean;
  /** Whether template supports background opacity */
  supportsBackgroundOpacity: boolean;
  /** Whether template supports gradient backgrounds */
  supportsGradient: boolean;
  /** Whether template supports border configuration */
  supportsBorder: boolean;
  /** Whether template supports text shadow */
  supportsTextShadow: boolean;
  /** Whether template supports accent color */
  supportsAccentColor: boolean;
  /** Whether template supports layout direction (horizontal/vertical) */
  supportsLayoutDirection: boolean;
  /** Optional: explanation for why a metric might be unavailable */
  getMetricUnavailableReason?: (metric: MetricType) => string | undefined;
}

/** Typography presets for templates */
export interface TypographyPreset {
  /** Base font family */
  fontFamily: string;
  /** Font weight for values: 'light' (300), 'normal' (400), 'bold' (700) */
  valueFontWeight: 'light' | 'normal' | 'bold';
  /** Font weight for labels */
  labelFontWeight: 'light' | 'normal' | 'bold';
  /** Value font size multiplier relative to base fontSizePercent */
  valueSizeMultiplier: number;
  /** Label font size multiplier relative to base fontSizePercent */
  labelSizeMultiplier: number;
  /** Letter spacing for labels in em units */
  labelLetterSpacing: number;
}

/** Spacing presets for templates */
export interface SpacingPreset {
  /** Base padding as percentage of short video side */
  basePaddingPercent: number;
  /** Gap between metrics */
  metricGapPercent: number;
  /** Line height multiplier */
  lineSpacing: number;
}

/** Visual style preset for templates */
export interface VisualPreset {
  /** Corner radius as percentage of overlay height */
  cornerRadius: number;
  /** Border width in pixels */
  borderWidth: number;
  /** Text shadow enabled */
  textShadow: boolean;
  /** Text shadow blur radius */
  textShadowBlur: number;
  /** Icon style */
  iconStyle: 'none' | 'filled' | 'outline';
  /** Label style: 'uppercase' for small caps, 'hidden' for no labels */
  labelStyle: 'uppercase' | 'hidden' | 'normal';
}

/** Template styles - combined visual presets */
export interface TemplateStyles {
  typography: TypographyPreset;
  spacing: SpacingPreset;
  visual: VisualPreset;
}

/** Template display metadata */
export interface TemplateMetadata {
  id: TemplateId;
  name: string;
  description: string;
  /** CSS-like preview colors for the UI thumbnail */
  previewColors: {
    bg: string;
    accent: string;
    text: string;
  };
  /** Template capabilities - what features and metrics are supported (optional for backward compatibility) */
  capabilities?: TemplateCapabilities;
  /** Template styles - typography, spacing, and visual presets (optional for backward compatibility) */
  styles?: TemplateStyles;
}

/** Template definition combining metadata, configuration, and capabilities */
export interface TemplateDefinition {
  id: TemplateId;
  metadata: TemplateMetadata;
  config: ExtendedOverlayConfig;
  capabilities?: TemplateCapabilities;
  styles?: TemplateStyles;
}

/** Base template configuration with common defaults */
export const BASE_TEMPLATE_CONFIG: Partial<ExtendedOverlayConfig> = {
  showHr: true,
  showPace: true,
  showDistance: true,
  showTime: true,
  borderWidth: 0,
  borderColor: 'transparent',
  cornerRadius: 0,
  textShadow: false,
  textShadowBlur: 0,
  iconStyle: 'none',
};

/** Default capabilities - full-featured template */
export const DEFAULT_CAPABILITIES: TemplateCapabilities = {
  supportedMetrics: ['pace', 'hr', 'distance', 'time'],
  requiredMetrics: [],
  supportsPosition: true,
  supportsBackgroundOpacity: true,
  supportsGradient: true,
  supportsBorder: true,
  supportsTextShadow: true,
  supportsAccentColor: true,
  supportsLayoutDirection: true,
};

/** Default styles - neutral baseline */
export const DEFAULT_STYLES: TemplateStyles = {
  typography: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    valueFontWeight: 'normal',
    labelFontWeight: 'normal',
    valueSizeMultiplier: 1.0,
    labelSizeMultiplier: 0.5,
    labelLetterSpacing: 0.1,
  },
  spacing: {
    basePaddingPercent: 0.02,
    metricGapPercent: 0.01,
    lineSpacing: 1.2,
  },
  visual: {
    cornerRadius: 0,
    borderWidth: 0,
    textShadow: false,
    textShadowBlur: 0,
    iconStyle: 'none',
    labelStyle: 'hidden',
  },
};

/**
 * Check if a metric is available for a template
 */
export function isMetricAvailable(
  capabilities: TemplateCapabilities,
  metric: MetricType
): boolean {
  return capabilities.supportedMetrics.includes(metric);
}

/**
 * Check if a metric is required (cannot be disabled)
 */
export function isMetricRequired(
  capabilities: TemplateCapabilities,
  metric: MetricType
): boolean {
  return capabilities.requiredMetrics.includes(metric);
}

/**
 * Get reason why a metric is unavailable
 */
export function getMetricUnavailableReason(
  capabilities: TemplateCapabilities,
  metric: MetricType
): string | undefined {
  if (capabilities.getMetricUnavailableReason) {
    return capabilities.getMetricUnavailableReason(metric);
  }
  if (!capabilities.supportedMetrics.includes(metric)) {
    return `${metric.charAt(0).toUpperCase() + metric.slice(1)} is not supported by this template`;
  }
  return undefined;
}
