/**
 * FFmpeg utilities for video transcoding and remuxing.
 * Extracted from video-processor for SRP compliance.
 */

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { ProcessingError } from '../core/errors';

/** Default CDN candidates for FFmpeg core */
const DEFAULT_CORE_CANDIDATES = [
    'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm',
    'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm',
];

/** Local vendor path for FFmpeg core */
const LOCAL_VENDOR_PATH = '/vendor/ffmpeg';

/**
 * Load FFmpeg core from multiple CDN candidates with fallbacks.
 * Returns undefined on success, Error on failure.
 */
export async function loadFfmpegCore(
    ffmpeg: FFmpeg,
    candidates: string[] = DEFAULT_CORE_CANDIDATES,
): Promise<Error | undefined> {
    const attemptErrors: string[] = [];
    const augmentedCandidates = [LOCAL_VENDOR_PATH, ...candidates];

    for (const baseURL of augmentedCandidates) {
        const diagnostics = await probeFfmpegCore(baseURL);

        try {
            // Try direct URLs for remote CDNs only
            if (baseURL.startsWith('http')) {
                try {
                    await ffmpeg.load({
                        coreURL: `${baseURL}/ffmpeg-core.js`,
                        wasmURL: `${baseURL}/ffmpeg-core.wasm`,
                    });
                    console.info(`[ffmpeg core] loaded from ${baseURL} (direct URLs)`);
                    return undefined;
                } catch {
                    // Fall through to blob URL approach
                }
            }

            // Fallback to blob URLs
            const coreUrl = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
            const wasmUrl = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
            await ffmpeg.load({ coreURL: coreUrl, wasmURL: wasmUrl });

            console.info(`[ffmpeg core] loaded from ${baseURL} (blob URLs)`);
            return undefined;
        } catch (err) {
            console.warn(`[ffmpeg core] failed to load from ${baseURL}`);
            if (diagnostics.length) {
                console.warn(`[ffmpeg core diagnostics] ${baseURL}\n` + diagnostics.join('\n'));
                attemptErrors.push(`[${baseURL}] diagnostics:\n${diagnostics.join('\n')}`);
            }
            attemptErrors.push(`[${baseURL}] error: ${err instanceof Error ? err.message : String(err)}`);
        }
    }

    return new Error('Failed to load ffmpeg core from all candidates: ' + attemptErrors.join('\n---\n'));
}

/**
 * Probe FFmpeg core URLs for diagnostics.
 */
async function probeFfmpegCore(baseURL: string): Promise<string[]> {
    const diagnostics: string[] = [];

    try {
        const probeResp = await fetch(`${baseURL}/ffmpeg-core.js`, { method: 'GET', mode: 'cors' });
        diagnostics.push(`ffmpeg-core.js -> ${probeResp.status} ${probeResp.statusText}`);
        diagnostics.push(`content-type: ${probeResp.headers.get('content-type')}`);
        diagnostics.push(`access-control-allow-origin: ${probeResp.headers.get('access-control-allow-origin')}`);
    } catch (probeErr) {
        diagnostics.push(`probe failed: ${probeErr instanceof Error ? probeErr.message : String(probeErr)}`);
    }

    try {
        const wasmProbe = await fetch(`${baseURL}/ffmpeg-core.wasm`, { method: 'GET', mode: 'cors' });
        diagnostics.push(`ffmpeg-core.wasm -> ${wasmProbe.status} ${wasmProbe.statusText}`);
        diagnostics.push(`wasm content-type: ${wasmProbe.headers.get('content-type')}`);
    } catch (probeErr) {
        diagnostics.push(`wasm probe failed: ${probeErr instanceof Error ? probeErr.message : String(probeErr)}`);
    }

    return diagnostics;
}

/**
 * Create and configure FFmpeg instance with logging.
 */
export function createFfmpegInstance(): FFmpeg {
    const ffmpeg = new FFmpeg();
    const logBuffer: string[] = [];

    ffmpeg.on('log', ({ message }) => {
        console.debug('[ffmpeg log]', message);
        logBuffer.push(message);
        if (logBuffer.length > 50) logBuffer.shift();
    });

    ffmpeg.on('progress', ({ progress, time }) => {
        console.debug('[ffmpeg progress]', { progress, time });
    });

    return ffmpeg;
}

/**
 * Remux a video file through FFmpeg (strips problematic metadata).
 */
export async function remuxWithFfmpeg(inputBlob: Blob): Promise<Blob> {
    const ffmpeg = createFfmpegInstance();

    const loadError = await loadFfmpegCore(ffmpeg);
    if (loadError) throw loadError;

    const inputData = new Uint8Array(await inputBlob.arrayBuffer());
    await ffmpeg.writeFile('input.mp4', inputData);

    // -map_metadata -1 strips metadata and rewrites container atoms
    await ffmpeg.exec(['-i', 'input.mp4', '-c', 'copy', '-map_metadata', '-1', 'output.mp4']);

    const output = await ffmpeg.readFile('output.mp4');
    const outputData = output instanceof Uint8Array
        ? output
        : new Uint8Array(output as unknown as ArrayBuffer);

    return new Blob([outputData.slice().buffer], { type: 'video/mp4' });
}

/** Transcode options for FFmpeg */
export interface TranscodeOptions {
    gopSize: number;
    onProgress?: (percent: number, time: number) => void;
}

/**
 * Transcode video with forced keyframes for compatibility.
 */
export async function transcodeWithForcedKeyframes(
    file: File,
    _meta: { fps: number; duration: number },
    options: TranscodeOptions,
): Promise<File> {
    const { gopSize, onProgress } = options;
    const ffmpeg = createFfmpegInstance();
    const logBuffer: string[] = [];
    const attemptLogs: string[] = [];

    ffmpeg.on('log', ({ message }) => {
        console.debug('[ffmpeg transcode log]', message);
        logBuffer.push(message);
        if (logBuffer.length > 50) logBuffer.shift();
    });

    ffmpeg.on('progress', ({ progress, time }) => {
        const percent = Number.isFinite(progress) ? Math.round(progress * 100) : 0;
        console.debug('[ffmpeg transcode progress]', { percent, time });
        onProgress?.(percent, time);
    });

    const loadError = await loadFfmpegCore(ffmpeg);
    if (loadError) throw loadError;

    const inputData = new Uint8Array(await file.arrayBuffer());
    await ffmpeg.writeFile('input.mp4', inputData);

    const forceKeyframesExpr = 'expr:gte(t,n_forced*1)';
    const x264Params = `keyint=${gopSize}:min-keyint=${gopSize}:scenecut=0:open-gop=0`;
    const baseArgs = [
        '-i', 'input.mp4',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-crf', '23',
        '-tune', 'zerolatency',
        '-pix_fmt', 'yuv420p',
        '-g', `${gopSize}`,
        '-keyint_min', `${gopSize}`,
        '-sc_threshold', '0',
        '-bf', '0',
        '-refs', '1',
        '-x264-params', x264Params,
        '-force_key_frames', forceKeyframesExpr,
        '-movflags', '+faststart',
    ];

    const runTranscode = async (args: string[], label: string): Promise<void> => {
        logBuffer.length = 0;
        try {
            console.info(`[ffmpeg transcode] running ${label}`);
            await ffmpeg.exec(args);
            console.info(`[ffmpeg transcode] ${label} succeeded`);
        } catch (error) {
            if (logBuffer.length > 0) {
                attemptLogs.push(`[${label}]\n${logBuffer.join('\n')}`);
            }
            console.warn(`[ffmpeg transcode] ${label} failed`);
            throw error;
        }
    };

    try {
        // First attempt: copy audio (fastest)
        await runTranscode([...baseArgs, '-c:a', 'copy', 'output.mp4'], 'audio-copy');
    } catch {
        // Second attempt: re-encode audio
        try {
            await runTranscode([...baseArgs, '-c:a', 'aac', '-b:a', '256k', 'output.mp4'], 'audio-aac');
        } catch (secondError) {
            console.error('[ffmpeg transcode] both attempts failed', { attemptLogs });
            throw new ProcessingError(
                `FFmpeg transcode failed: ${secondError instanceof Error ? secondError.message : 'Unknown error'}`,
                attemptLogs.length > 0 ? { details: attemptLogs.join('\n\n') } : undefined,
            );
        }
    }

    const output = await ffmpeg.readFile('output.mp4');
    const outputData = output instanceof Uint8Array
        ? output
        : new Uint8Array(output as unknown as ArrayBuffer);

    const fileName = file.name.replace(/\.[^/.]+$/, '') + '.keyframes.mp4';
    return new File([outputData.slice().buffer], fileName, { type: 'video/mp4' });
}
