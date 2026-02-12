/**
 * Unit tests for ffmpeg utilities with dependency injection boundaries.
 */
import { describe, it, expect, vi } from 'vitest';
import {
    probeFfmpegCore,
    loadFfmpegCore,
    remuxWithFfmpeg,
    transcodeWithForcedKeyframes,
} from '../modules/ffmpeg-utils';

function createHeaders(map: Record<string, string>) {
    return {
        get(key: string) {
            return map[key.toLowerCase()] ?? null;
        },
    };
}

function createFfmpegMock() {
    return {
        on: vi.fn(),
        load: vi.fn(),
        writeFile: vi.fn(),
        exec: vi.fn(),
        readFile: vi.fn(),
    };
}

describe('ffmpeg-utils', () => {
    it('probeFfmpegCore should collect diagnostics on success', async () => {
        const fetchFn = vi.fn()
            .mockResolvedValueOnce({
                status: 200,
                statusText: 'OK',
                headers: createHeaders({
                    'content-type': 'text/javascript',
                    'access-control-allow-origin': '*',
                }),
            })
            .mockResolvedValueOnce({
                status: 200,
                statusText: 'OK',
                headers: createHeaders({
                    'content-type': 'application/wasm',
                }),
            });

        const diagnostics = await probeFfmpegCore('https://cdn.example', fetchFn as unknown as typeof fetch);

        expect(diagnostics.some((line) => line.includes('ffmpeg-core.js -> 200 OK'))).toBe(true);
        expect(diagnostics.some((line) => line.includes('ffmpeg-core.wasm -> 200 OK'))).toBe(true);
    });

    it('probeFfmpegCore should handle fetch errors', async () => {
        const fetchFn = vi.fn().mockRejectedValue(new Error('network down'));

        const diagnostics = await probeFfmpegCore('https://cdn.example', fetchFn as unknown as typeof fetch);

        expect(diagnostics.some((line) => line.includes('probe failed'))).toBe(true);
        expect(diagnostics.some((line) => line.includes('wasm probe failed'))).toBe(true);
    });

    it('loadFfmpegCore should succeed with injected blob URL loader', async () => {
        const ffmpeg = createFfmpegMock();
        ffmpeg.load.mockResolvedValue(undefined);

        const fetchFn = vi.fn().mockResolvedValue({
            status: 200,
            statusText: 'OK',
            headers: createHeaders({
                'content-type': 'application/octet-stream',
                'access-control-allow-origin': '*',
            }),
        });

        const toBlobUrlFn = vi.fn()
            .mockResolvedValueOnce('blob:core')
            .mockResolvedValueOnce('blob:wasm');

        const error = await loadFfmpegCore(ffmpeg as unknown as any, ['https://cdn.example'], {
            fetchFn: fetchFn as unknown as typeof fetch,
            toBlobUrlFn: toBlobUrlFn as unknown as typeof import('@ffmpeg/util').toBlobURL,
        });

        expect(error).toBeUndefined();
        expect(ffmpeg.load).toHaveBeenCalled();
        expect(toBlobUrlFn).toHaveBeenCalledTimes(2);
    });

    it('loadFfmpegCore should return Error when all candidates fail', async () => {
        const ffmpeg = createFfmpegMock();
        ffmpeg.load.mockRejectedValue(new Error('cannot load'));

        const fetchFn = vi.fn().mockRejectedValue(new Error('offline'));
        const toBlobUrlFn = vi.fn().mockRejectedValue(new Error('blob fail'));

        const error = await loadFfmpegCore(ffmpeg as unknown as any, ['https://cdn.example'], {
            fetchFn: fetchFn as unknown as typeof fetch,
            toBlobUrlFn: toBlobUrlFn as unknown as typeof import('@ffmpeg/util').toBlobURL,
        });

        expect(error).toBeInstanceOf(Error);
        expect(error?.message).toContain('Failed to load ffmpeg core');
    });

    it('remuxWithFfmpeg should produce mp4 blob', async () => {
        const ffmpeg = createFfmpegMock();
        ffmpeg.load.mockResolvedValue(undefined);
        ffmpeg.writeFile.mockResolvedValue(undefined);
        ffmpeg.exec.mockResolvedValue(undefined);
        ffmpeg.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));

        const inputBlob = new Blob([new Uint8Array([9, 9, 9])], { type: 'video/mp4' });

        const result = await remuxWithFfmpeg(inputBlob, {
            ffmpegFactory: () => ffmpeg as unknown as any,
            coreDeps: {
                fetchFn: vi.fn().mockResolvedValue({
                    status: 200,
                    statusText: 'OK',
                    headers: createHeaders({
                        'content-type': 'application/octet-stream',
                        'access-control-allow-origin': '*',
                    }),
                }) as unknown as typeof fetch,
                toBlobUrlFn: vi.fn()
                    .mockResolvedValueOnce('blob:core')
                    .mockResolvedValueOnce('blob:wasm') as unknown as typeof import('@ffmpeg/util').toBlobURL,
            },
        });

        expect(result.type).toBe('video/mp4');
        expect(ffmpeg.exec).toHaveBeenCalledWith(['-i', 'input.mp4', '-c', 'copy', '-map_metadata', '-1', 'output.mp4']);
    });

    it('transcodeWithForcedKeyframes should retry with audio re-encode', async () => {
        const ffmpeg = createFfmpegMock();
        ffmpeg.load.mockResolvedValue(undefined);
        ffmpeg.writeFile.mockResolvedValue(undefined);
        ffmpeg.exec
            .mockRejectedValueOnce(new Error('audio copy failed'))
            .mockResolvedValueOnce(undefined);
        ffmpeg.readFile.mockResolvedValue(new Uint8Array([5, 6, 7]));

        const file = new File([new Uint8Array([1, 2])], 'clip.mp4', { type: 'video/mp4' });

        const output = await transcodeWithForcedKeyframes(
            file,
            { fps: 30, duration: 10 },
            { gopSize: 30 },
            {
                ffmpegFactory: () => ffmpeg as unknown as any,
                coreDeps: {
                    fetchFn: vi.fn().mockResolvedValue({
                        status: 200,
                        statusText: 'OK',
                        headers: createHeaders({
                            'content-type': 'application/octet-stream',
                            'access-control-allow-origin': '*',
                        }),
                    }) as unknown as typeof fetch,
                    toBlobUrlFn: vi.fn()
                        .mockResolvedValueOnce('blob:core')
                        .mockResolvedValueOnce('blob:wasm') as unknown as typeof import('@ffmpeg/util').toBlobURL,
                },
            },
        );

        expect(output.name.endsWith('.keyframes.mp4')).toBe(true);
        expect(ffmpeg.exec).toHaveBeenCalledTimes(2);
    });
});
