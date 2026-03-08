# Templates System

## Overview

The templates system allows you to define and manage different overlay layouts for the telemetry display. Each template is a self-contained module that defines visual configuration, metadata, capabilities, and optional style presets.

The canonical source of truth is `src/modules/templates/registry.ts`. New templates should be created with `defineTemplate(...)` and registered once in that registry.

## Directory Structure

```
src/modules/templates/
├── types.ts          # Shared types, defineTemplate helper
├── registry.ts       # Canonical template registration and derived maps
├── index.ts          # Public exports
├── horizon.ts        # Horizon template
├── ...               # Other system templates
└── custom.ts         # Custom template
```

## Adding a New Template

To add a new template, follow these steps:

### 1. Create Template File

Create a new file in `src/modules/templates/` (e.g., `my-template.ts`):

```typescript
import { defineTemplate } from './types';

export const myTemplate = defineTemplate({
  id: 'my-template',
  metadata: {
    name: 'My Template',
    description: 'Description of what this template does',
    previewColors: {
      bg: '#000000',      // Background color for preview
      accent: '#ff0000',  // Accent color
      text: '#ffffff',    // Text color
    },
  },
  config: {
    layoutMode: 'box',
    position: 'top-right',       // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
    backgroundOpacity: 0.8,
    fontSizePercent: 2.0,
    showHr: true,
    showPace: true,
    showDistance: true,
    showTime: true,
    fontFamily: 'Inter, sans-serif',
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    borderWidth: 0,
    borderColor: 'transparent',
    cornerRadius: 4,
    textShadow: false,
    textShadowBlur: 0,
    lineSpacing: 1.2,
    layout: 'vertical',          // 'vertical' | 'horizontal'
    iconStyle: 'none',           // 'none' | 'outline'
    gradientBackground: false,
    gradientStartColor: '#000000',
    gradientEndColor: '#333333',
    labelStyle: 'hidden',        // 'hidden' | 'uppercase'
    valueFontWeight: 'bold',     // 'light' | 'normal' | 'bold'
    valueSizeMultiplier: 1.0,
    labelSizeMultiplier: 0.5,
    labelLetterSpacing: 0.1,
    accentColor: '#ff0000',
  },
});
```

### 2. Register Template

Register the template once in `src/modules/templates/registry.ts`:

```typescript
import { myTemplate } from './my-template';

const REGISTERED_TEMPLATES = [
  horizonTemplate,
  marginTemplate,
  lframeTemplate,
  classicTemplate,
  customTemplate,
  myTemplate,
];
```

Once registered, the template automatically participates in:

- `TEMPLATES`
- `TEMPLATE_MAP`
- `getTemplateConfig()`
- `getAvailableTemplates()`
- `getTemplateMetadata()`
- UI selector lists
- capabilities lookup

### 3. Add renderer code only if needed

If the new template uses an existing `layoutMode`, no additional registry wiring is needed.

If it introduces a brand-new draw algorithm, implement the renderer in `src/modules/layouts/extendedLayouts.ts` (or the appropriate basic layout module).

### 4. Test Your Template

Add focused tests in `src/__tests__/templates.test.ts` and, when relevant, layout tests in `src/__tests__/extendedLayouts.test.ts`:

```typescript
it('my template should have correct layout', () => {
    expect(myTemplate.config.layoutMode).toBe('box');
    expect(myTemplate.metadata.name).toBe('My Template');
});
```

## Template Configuration Options

### Layout Modes

- `box` - Simple positioned overlay with background
- `bottom-bar` - Full-width bar at the bottom
- `side-margins` - Metrics on left and right edges
- `corner-frame` - L-shaped frame in corner
- plus template-specific modes such as `arc-gauge`, `cockpit-hud`, `glass-panel`, `focus-type`, etc.

### Positions

- `top-left`
- `top-right`
- `bottom-left`
- `bottom-right`

### Visual Options

- `backgroundOpacity` - Background transparency (0-1)
- `fontSizePercent` - Base font size as percentage of height
- `textShadow` - Enable text shadow
- `gradientBackground` - Use gradient instead of solid color
- `cornerRadius` - Border radius for box layouts

### Metric Display

- `showHr` - Show heart rate
- `showPace` - Show pace
- `showDistance` - Show distance
- `showTime` - Show elapsed time

## Using Templates

### Import in Components

```typescript
import { getTemplateConfig, getAllTemplateMetadata } from '../modules/templates';

// Get all templates for display
const templates = getAllTemplateMetadata();

// Get specific template config
const config = getTemplateConfig('horizon');
```

### Import Individual Templates

```typescript
import { horizonTemplate } from '../modules/templates';

// Access template directly
const metadata = horizonTemplate.metadata;
const config = horizonTemplate.config;
```

## Backward Compatibility

The old `templateConfigs.ts` file still works and re-exports registry-derived functions for backward compatibility. Existing code using:

```typescript
import { getTemplateConfig } from '../modules/templateConfigs';
```

will continue to work without changes.

## Best Practices

1. **Keep templates self-contained** - Each template file should be independent
2. **Prefer `defineTemplate(...)`** - Define `id` once and let the helper normalize metadata/config ids
3. **Register once** - Add new system templates only in `registry.ts`
4. **Use descriptive names** - Template names should clearly indicate the layout
5. **Test thoroughly** - Add focused registry/layout tests for new templates
6. **Document behavior changes** - Update this README and top-level docs when template workflow changes
