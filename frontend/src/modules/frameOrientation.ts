export type VideoRotation = 0 | 90 | 180 | 270;

export function normalizeVideoRotation(value: number | undefined): VideoRotation {
    if (value === 90 || value === 180 || value === 270) return value;
    return 0;
}

export function drawVideoFrameWithRotation(
    ctx: OffscreenCanvasRenderingContext2D,
    frame: VideoFrame,
    targetWidth: number,
    targetHeight: number,
    rotation: number | undefined,
): void {
    const normalizedRotation = normalizeVideoRotation(rotation);

    ctx.save();

    if (normalizedRotation === 0) {
        ctx.drawImage(frame, 0, 0, targetWidth, targetHeight);
        ctx.restore();
        return;
    }

    if (normalizedRotation === 90) {
        ctx.translate(targetWidth, 0);
        ctx.rotate(Math.PI / 2);
        ctx.drawImage(frame, 0, 0, targetHeight, targetWidth);
        ctx.restore();
        return;
    }

    if (normalizedRotation === 180) {
        ctx.translate(targetWidth, targetHeight);
        ctx.rotate(Math.PI);
        ctx.drawImage(frame, 0, 0, targetWidth, targetHeight);
        ctx.restore();
        return;
    }

    // 270° clockwise
    ctx.translate(0, targetHeight);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(frame, 0, 0, targetHeight, targetWidth);
    ctx.restore();
}
