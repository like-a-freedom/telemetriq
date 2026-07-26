import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const terminalTemplate = defineTemplate({
  id: 'terminal',
  metadata: {
    name: 'Terminal',
    description: 'Green hacker terminal top-left: › pace = 5:30 min/km style',
    previewColors: { bg: '#000000', accent: '#22c55e', text: '#4ade80' },
  },
  config: {
    layoutMode: 'terminal',
    position: 'top-left',
    backgroundOpacity: 0.82,
    fontSizePercent: 1.8,
    fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
    textColor: '#86efac',
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
    cornerRadius: 4,
    lineSpacing: 1.2,
    layout: 'vertical',
    labelStyle: 'uppercase',
    valueSizeMultiplier: 1.0,
    labelSizeMultiplier: 0.45,
    labelLetterSpacing: 0.08,
    accentColor: '#22c55e',
  },
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    supportedMetrics: ['pace', 'hr', 'distance', 'time', 'power'],
    supportsPosition: false,
    supportsGradient: false,
    supportsBorder: false,
    supportsTextShadow: true,
    supportsLayoutDirection: false,
  },
});
