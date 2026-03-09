import type {
    VideoProcessingPhaseMetrics,
    VideoProcessingProfile,
    VideoProcessingProfilePhase,
} from '../core/types';

export interface VideoProcessingProfiler {
    measure<T>(phase: VideoProcessingProfilePhase | string, action: () => Promise<T> | T): Promise<T>;
    record(phase: VideoProcessingProfilePhase | string, durationMs: number): void;
    incrementFallbackTranscodes(): void;
    finish(details: { processedFrames: number; usedStreamingMux: boolean }): VideoProcessingProfile;
}

export function createVideoProcessingProfiler(
    now: () => number = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
): VideoProcessingProfiler {
    const startedAt = now();
    const phases = new Map<string, VideoProcessingPhaseMetrics>();
    let fallbackTranscodeCount = 0;

    const record = (phase: VideoProcessingProfilePhase | string, durationMs: number): void => {
        const previous = phases.get(phase) ?? { durationMs: 0, runs: 0 };
        phases.set(phase, {
            durationMs: previous.durationMs + Math.max(0, durationMs),
            runs: previous.runs + 1,
        });
    };

    return {
        async measure<T>(phase: VideoProcessingProfilePhase | string, action: () => Promise<T> | T): Promise<T> {
            const phaseStartedAt = now();
            try {
                return await action();
            } finally {
                record(phase, now() - phaseStartedAt);
            }
        },
        record,
        incrementFallbackTranscodes(): void {
            fallbackTranscodeCount += 1;
        },
        finish(details: { processedFrames: number; usedStreamingMux: boolean }): VideoProcessingProfile {
            const totalDurationMs = Math.max(0, now() - startedAt);
            const phaseEntries = Object.fromEntries(phases.entries());
            phaseEntries.total = {
                durationMs: totalDurationMs,
                runs: 1,
            };

            return {
                phases: phaseEntries,
                fallbackTranscodeCount,
                processedFrames: details.processedFrames,
                usedStreamingMux: details.usedStreamingMux,
                totalDurationMs,
            };
        },
    };
}
