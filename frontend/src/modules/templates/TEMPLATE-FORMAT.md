# Template Format Specification (v2)

## Self-Contained Template Modules

Each template is now a **single, self-contained file** that exports everything needed:

```typescript
// templates/my-template.ts
import type { TemplateDefinition } from './types';
import type { MetricItem } from '../overlay-renderer';
import type { ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlay-utils';

// 1. Template definition with metadata, config, capabilities, styles
export const myTemplate: TemplateDefinition = {
  id: 'my-template',
  metadata: { ... },
  config: { ... },
  capabilities: { ... },
  styles: { ... },
};

// 2. Renderer function
export function renderMyTemplate(
  ctx: OverlayContext2D,
  metrics: MetricItem[],
  w: number,
  h: number,
  config: ExtendedOverlayConfig,
): void {
  // Rendering logic here
}
```

## Usage

```typescript
// Import everything from one file
import { myTemplate, renderMyTemplate } from './templates/my-template';

// Use the template definition
const config = myTemplate.config;
const capabilities = myTemplate.capabilities;

// Check if a metric is supported
if (myTemplate.capabilities.supportedMetrics.includes('hr')) {
  // Heart rate is supported
}

// Render the template
renderMyTemplate(ctx, metrics, width, height, config);
```

## Template Definition Structure

### Metadata

```typescript
metadata: {
  id: 'my-template',
  name: 'My Template',
  description: 'Description of the template',
  previewColors: {
    bg: '#000000',
    accent: '#ffffff',
    text: '#ffffff',
  },
  capabilities: { ... },  // Optional, can be at top level
  styles: { ... },        // Optional, can be at top level
}
```

### Capabilities

```typescript
capabilities: {
  // Which metrics can be displayed
  supportedMetrics: ['pace', 'hr', 'distance', 'time'],
  
  // Which metrics are required (cannot be disabled)
  requiredMetrics: ['pace'],
  
  // Feature support flags
  supportsPosition: true,
  supportsBackgroundOpacity: true,
  supportsGradient: true,
  supportsBorder: true,
  supportsTextShadow: true,
  supportsAccentColor: true,
  supportsLayoutDirection: true,
  
  // Optional: custom reason for unavailable metrics
  getMetricUnavailableReason: (metric) => {
    if (metric === 'time') {
      return 'This template does not support time display';
    }
    return undefined;
  },
}
```

### Styles

```typescript
styles: {
  typography: {
    fontFamily: 'Inter, sans-serif',
    valueFontWeight: 'bold',
    labelFontWeight: 'normal',
    valueSizeMultiplier: 2.5,
    labelSizeMultiplier: 0.4,
    labelLetterSpacing: 0.15,
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
    labelStyle: 'uppercase',
  },
}
```

## Migration Checklist

To migrate an existing template:

1. ✅ Add `capabilities` with metric support and feature flags
2. ✅ Add `styles` with typography, spacing, and visual presets
3. ✅ Move renderer logic into the same file
4. ✅ Export both template definition and renderer function
5. ✅ Update `templates/index.ts` to export the new renderer
6. ✅ Update `layouts/extended-layouts.ts` to import and use the new renderer
7. ✅ Remove old renderer function from `extended-layouts.ts`
8. ✅ Add tests for the template module

## Example: Minimal Ring

See `minimal-ring.ts` for a complete example of the new format.

Key features:
- **Single file** - No subdirectories or multiple files
- **Self-contained** - Definition + renderer in one place
- **Type-safe** - Full TypeScript support
- **Testable** - Easy to unit test both definition and renderer
- **DRY** - No duplicated logic or configuration

## Benefits

| Before | After |
|--------|-------|
| Logic spread across multiple files | Single source of truth |
| Implicit capabilities | Explicit, typed capabilities |
| Hard to test renderers | Easy to test |
| Template limitations hardcoded in UI | Self-describing capabilities |
| 2+ files per template | 1 file per template |
