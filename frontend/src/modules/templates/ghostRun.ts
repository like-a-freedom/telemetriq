import { TRAIL_RUN_FONT_FAMILY } from '../trailRunFonts';
import { DEFAULT_CAPABILITIES, defineTemplate } from './types';

export const GHOST_RUN_COLORS = {
    text: '#F7FBFA',
    accent: '#7DE6E3',
    heart: '#FF5B72',
    contour: '#152321',
};

export const ghostRunTemplate = defineTemplate({
    id: 'ghost-run',
    metadata: {
        name: 'Ghost Run',
        description: 'Transparent running HUD with a live route map and elevation progress',
        previewColors: { bg: '#152321', accent: GHOST_RUN_COLORS.accent, text: GHOST_RUN_COLORS.text },
    },
    config: {
        layoutMode: 'ghost-run',
        position: 'top-left',
        backgroundOpacity: 0,
        fontSizePercent: 5.8,
        showHr: true,
        showPace: true,
        showDistance: true,
        showTime: true,
        showElevation: true,
        showGrade: true,
        fontFamily: TRAIL_RUN_FONT_FAMILY,
        textColor: GHOST_RUN_COLORS.text,
        backgroundColor: 'transparent',
        textShadow: true,
        textShadowColor: GHOST_RUN_COLORS.contour,
        textShadowBlur: 0,
        gradientBackground: false,
        gradientStartColor: 'transparent',
        gradientEndColor: 'transparent',
        lineSpacing: 1,
        layout: 'vertical',
        labelStyle: 'uppercase',
        valueFontWeight: 'bold',
        valueSizeMultiplier: 1,
        labelSizeMultiplier: 0.4,
        labelLetterSpacing: 0,
        accentColor: GHOST_RUN_COLORS.accent,
    },
    capabilities: {
        ...DEFAULT_CAPABILITIES,
        supportedMetrics: ['pace', 'distance', 'time', 'hr', 'elevation', 'grade'],
        supportsPosition: false,
        supportsBackgroundOpacity: false,
        supportsGradient: false,
        supportsBorder: false,
        supportsLayoutDirection: false,
    },
});
