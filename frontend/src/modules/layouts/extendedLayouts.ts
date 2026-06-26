import type { MetricItem } from '../overlayRenderer';
import type { ExtendedOverlayConfig } from '../../core/types';
import { applyTextShadow, getResolutionTuning } from '../overlayUtils';
import type { OverlayContext2D } from '../overlayUtils';
import type { MetricMap, Orientation } from './shared';
import { getOrientation, toMetricMap } from './shared';

import { drawArcGauge } from './arcGaugeLayout';
import { drawHeroNumber } from './heroNumberLayout';
import { drawCinematicBar } from './cinematicBarLayout';
import { drawEditorial } from './editorialLayout';
import { drawTickerTape } from './tickerTapeLayout';
import { drawWhisper } from './whisperLayout';
import { drawTwoTone } from './twoToneLayout';
import { drawCondensedStrip } from './condensedStripLayout';
import { drawSoftRounded } from './softRoundedLayout';
import { drawThinLine } from './thinLineLayout';
import { drawSwissGrid } from './swissGridLayout';
import { drawGarminStyle } from './garminStyleLayout';
import { drawSportsBroadcast } from './sportsBroadcastLayout';
import { drawCockpitHud } from './cockpitHudLayout';
import { drawTerminal } from './terminalLayout';
import { drawNightRunner } from './nightRunnerLayout';
import { drawDataBlock } from './dataBlockLayout';
import { drawRaceTag } from './raceTagLayout';
import { drawGlassPanel } from './glassPanelLayout';
import { drawFocusType } from './focusTypeLayout';

export function renderExtendedLayout(
    ctx: OverlayContext2D,
    metrics: MetricItem[],
    w: number,
    h: number,
    config: ExtendedOverlayConfig,
    layoutMode: string,
): void {
    const data = toMetricMap(metrics);
    const orientation = getOrientation(w, h);
    const tuning = getResolutionTuning(w, h);

    ctx.save();
    applyTextShadow(ctx, config);

    switch (layoutMode) {
        case 'arc-gauge':
            drawArcGauge(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'hero-number':
            drawHeroNumber(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'cinematic-bar':
            drawCinematicBar(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'editorial':
            drawEditorial(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'ticker-tape':
            drawTickerTape(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'whisper':
            drawWhisper(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'two-tone':
            drawTwoTone(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'condensed-strip':
            drawCondensedStrip(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'soft-rounded':
            drawSoftRounded(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'thin-line':
            drawThinLine(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'swiss-grid':
            drawSwissGrid(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'garmin-style':
            drawGarminStyle(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'sports-broadcast':
            drawSportsBroadcast(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'cockpit-hud':
            drawCockpitHud(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'terminal':
            drawTerminal(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'night-runner':
            drawNightRunner(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'data-block':
            drawDataBlock(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'race-tag':
            drawRaceTag(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'glass-panel':
            drawGlassPanel(ctx, data, w, h, config, orientation, tuning);
            break;
        case 'minimal-ring':
            break;
        case 'focus-type':
            drawFocusType(ctx, data, w, h, config, orientation, tuning);
            break;
        default:
            break;
    }

    ctx.restore();
}

export { drawMetricBlock } from './shared';
export type { MetricMap, Orientation };
export type { OverlayContext2D, ExtendedOverlayConfig };