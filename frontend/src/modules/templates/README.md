# Templates System

## Overview

The templates system allows you to define and manage different overlay layouts for the telemetry display. Each template is a self-contained module that defines both the visual configuration and metadata.

## Directory Structure

```
src/modules/templates/
├── types.ts          # Shared types and interfaces
├── index.ts          # Registry and exports
├── horizon.ts        # Horizon template
├── margin.ts         # Margin template
├── lframe.ts         # L-Frame template
├── classic.ts        # Classic template
└── custom.ts         # Custom template
```

## Adding a New Template

To add a new template, follow these steps:

### 1. Create Template File

Create a new file in `src/modules/templates/` (e.g., `my-template.ts`):

```typescript
import type { TemplateDefinition } from './types';

export const myTemplate: TemplateDefinition = {
  id: 'my-template',
  metadata: {
    id: 'my-template',
    name: 'My Template',
    description: 'Description of what this template does',
    previewColors: {
      bg: '#000000',      // Background color for preview
      accent: '#ff0000',  // Accent color
      text: '#ffffff',    // Text color
    },
  },
  config: {
    templateId: 'my-template',
    layoutMode: 'box',           // 'box' | 'bottom-bar' | 'side-margins' | 'corner-frame'
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
};
```

### 2. Register Template

Add your template to the registry in `src/modules/templates/index.ts`:

```typescript
import { myTemplate } from './my-template';

export const TEMPLATES: TemplateDefinition[] = [
  horizonTemplate,
  marginTemplate,
  lframeTemplate,
  classicTemplate,
  customTemplate,
  myTemplate,  // Add here
];

export const TEMPLATE_MAP: Record<TemplateId, TemplateDefinition> = {
  'horizon': horizonTemplate,
  'margin': marginTemplate,
  'l-frame': lframeTemplate,
  'classic': classicTemplate,
  'custom': customTemplate,
  'my-template': myTemplate,  // Add here
};
```

### 3. Update Type (if needed)

If TypeScript complains about the template ID, add it to the `TemplateId` type in `src/core/types.ts`:

```typescript
export type TemplateId = 'horizon' | 'margin' | 'l-frame' | 'classic' | 'custom' | 'my-template';
```

### 4. Test Your Template

Add tests in `src/__tests__/templates.test.ts`:

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

The old `template-configs.ts` file still works and re-exports all functions for backward compatibility. Existing code using:

```typescript
import { getTemplateConfig } from '../modules/template-configs';
```

will continue to work without changes.

## Best Practices

1. **Keep templates self-contained** - Each template file should be independent
2. **Use descriptive names** - Template names should clearly indicate the layout
3. **Test thoroughly** - Add tests for new templates
4. **Document changes** - Update this README when adding features
5. **Maintain backward compatibility** - Don't remove existing templates without deprecation period
