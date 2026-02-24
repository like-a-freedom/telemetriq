import type { TelemetryFrame, ExtendedOverlayConfig } from '../../core/types';
import type { OverlayContext2D } from '../overlayUtils';
import { formatPace } from '../telemetryCore';

const WEBGPU_STORAGE_KEY = 'enableWebGPU.v2';

/**
 * Feature flag for WebGPU rendering
 */
export const WEBGPU_FEATURE_FLAG = {
  get enabled(): boolean {
    if (typeof localStorage === 'undefined') return true;

    const persisted = localStorage.getItem(WEBGPU_STORAGE_KEY);
    if (persisted === null) {
      // Default is enabled for all users unless explicitly overridden in v2 flag.
      return true;
    }

    return persisted !== 'false';
  },

  toggle(enabled: boolean): void {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(WEBGPU_STORAGE_KEY, enabled.toString());
    }
  },
};

interface GPUResources {
  adapter: GPUAdapter;
  device: GPUDevice;
  pipeline: GPURenderPipeline;
  sampler: GPUSampler;
  format: GPUTextureFormat;
}

interface GPUCompositeResources {
  canvas: OffscreenCanvas | HTMLCanvasElement;
  context: GPUCanvasContext;
  width: number;
  height: number;
  baseTexture: GPUTexture;
  overlayTexture: GPUTexture;
  uniformBuffer: GPUBuffer;
  bindGroup: GPUBindGroup;
  lastOverlayKey: string | null;
}

type Canvas2DContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * WebGPU adapter for GPU-accelerated overlay rendering
 * 
 * CURRENTLY DISABLED - Using optimized Canvas 2D instead
 * WebGPU implementation is kept for future use when browser support
 * for canvas readback improves.
 */
export class WebGPUAdapter {
  private static instance: WebGPUAdapter | null = null;
  private enabled = false;
  private gpu: GPUResources | null = null;
  private compositeResources: GPUCompositeResources | null = null;
  private isInitialized = false;
  private initPromise: Promise<boolean> | null = null;

  private constructor() {
    this.enabled = WEBGPU_FEATURE_FLAG.enabled;
  }

  static getInstance(): WebGPUAdapter {
    if (!WebGPUAdapter.instance) {
      WebGPUAdapter.instance = new WebGPUAdapter();
    }
    return WebGPUAdapter.instance;
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' &&
      'gpu' in navigator &&
      navigator.gpu !== undefined;
  }

  isEnabled(): boolean {
    return this.enabled && WebGPUAdapter.isSupported();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    WEBGPU_FEATURE_FLAG.toggle(enabled);
  }

  /**
   * Initialize WebGPU resources
   */
  private async initialize(): Promise<boolean> {
    if (this.isInitialized) return true;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private get2dContext(canvas: OffscreenCanvas | HTMLCanvasElement): Canvas2DContext | null {
    return canvas.getContext('2d') as Canvas2DContext | null;
  }

  private isGPUCopyExternalImageSource(source: unknown): boolean {
    if (typeof VideoFrame !== 'undefined' && source instanceof VideoFrame) return true;
    if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) return true;
    if (typeof OffscreenCanvas !== 'undefined' && source instanceof OffscreenCanvas) return true;
    if (typeof HTMLCanvasElement !== 'undefined' && source instanceof HTMLCanvasElement) return true;
    if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) return true;
    if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) return true;
    return false;
  }

  private copyExternalSourceToTexture(
    texture: GPUTexture,
    source: CanvasImageSource | VideoFrame,
    width: number,
    height: number,
  ): boolean {
    if (!this.gpu || !this.isGPUCopyExternalImageSource(source)) {
      return false;
    }

    this.gpu.device.queue.copyExternalImageToTexture(
      { source: source as GPUCopyExternalImageSource },
      { texture },
      { width, height },
    );

    return true;
  }

  private async doInitialize(): Promise<boolean> {
    try {
      if (!WebGPUAdapter.isSupported()) {
        return false;
      }

      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: 'high-performance',
      });

      if (!adapter) {
        console.warn('[WebGPUAdapter] No WebGPU adapter available');
        return false;
      }

      const device = await adapter.requestDevice();
      const format = navigator.gpu.getPreferredCanvasFormat();

      // Create shader module
      const shaderModule = device.createShaderModule({
        code: this.getOverlayShaderCode(),
      });

      // Create pipeline
      const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: shaderModule,
          entryPoint: 'vertexMain',
        },
        fragment: {
          module: shaderModule,
          entryPoint: 'fragmentMain',
          targets: [{
            format,
            blend: {
              color: {
                srcFactor: 'src-alpha',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
              alpha: {
                srcFactor: 'one',
                dstFactor: 'one-minus-src-alpha',
                operation: 'add',
              },
            },
          }],
        },
        primitive: {
          topology: 'triangle-list',
        },
      });

      // Create sampler
      const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
        addressModeU: 'clamp-to-edge',
        addressModeV: 'clamp-to-edge',
      });

      this.gpu = { adapter, device, pipeline, sampler, format };
      this.isInitialized = true;

      return true;
    } catch (error) {
      console.error('[WebGPUAdapter] Failed to initialize WebGPU:', error);
      return false;
    }
  }

  async compositeOverlay(
    ctx: OverlayContext2D,
    overlaySource: CanvasImageSource,
    videoWidth: number,
    videoHeight: number,
    overlayKey?: string,
  ): Promise<boolean> {
    if (!this.isEnabled()) return false;

    try {
      const initialized = await this.initialize();
      if (!initialized || !this.gpu) return false;

      const resources = this.ensureCompositeResources(videoWidth, videoHeight);
      if (!resources) return false;

      if (!this.copyExternalSourceToTexture(resources.baseTexture, ctx.canvas, videoWidth, videoHeight)) {
        return false;
      }

      const shouldRefreshOverlay = overlayKey === undefined || resources.lastOverlayKey !== overlayKey;
      if (shouldRefreshOverlay) {
        if (!this.copyExternalSourceToTexture(resources.overlayTexture, overlaySource, videoWidth, videoHeight)) {
          return false;
        }
        resources.lastOverlayKey = overlayKey ?? null;
      }

      const commandEncoder = this.gpu.device.createCommandEncoder();
      const currentTexture = resources.context.getCurrentTexture();
      const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: currentTexture.createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });

      passEncoder.setPipeline(this.gpu.pipeline);
      passEncoder.setBindGroup(0, resources.bindGroup);
      passEncoder.draw(6, 1, 0, 0);
      passEncoder.end();

      this.gpu.device.queue.submit([commandEncoder.finish()]);
      ctx.drawImage(resources.canvas as CanvasImageSource, 0, 0, videoWidth, videoHeight);

      return true;
    } catch (error) {
      console.warn('[WebGPUAdapter] compositeOverlay failed:', error);
      return false;
    }
  }

  async compositeVideoFrame(
    videoFrame: VideoFrame,
    overlaySource: CanvasImageSource,
    videoWidth: number,
    videoHeight: number,
    overlayKey?: string,
  ): Promise<VideoFrame | null> {
    if (!this.isEnabled()) return null;

    try {
      const initialized = await this.initialize();
      if (!initialized || !this.gpu) return null;

      const resources = this.ensureCompositeResources(videoWidth, videoHeight);
      if (!resources) return null;

      this.gpu.device.queue.copyExternalImageToTexture(
        { source: videoFrame },
        { texture: resources.baseTexture },
        { width: videoWidth, height: videoHeight },
      );

      const shouldRefreshOverlay = overlayKey === undefined || resources.lastOverlayKey !== overlayKey;
      if (shouldRefreshOverlay) {
        if (!this.copyExternalSourceToTexture(resources.overlayTexture, overlaySource, videoWidth, videoHeight)) {
          return null;
        }
        resources.lastOverlayKey = overlayKey ?? null;
      }

      const commandEncoder = this.gpu.device.createCommandEncoder();
      const currentTexture = resources.context.getCurrentTexture();
      const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [
          {
            view: currentTexture.createView(),
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: 'clear',
            storeOp: 'store',
          },
        ],
      });

      passEncoder.setPipeline(this.gpu.pipeline);
      passEncoder.setBindGroup(0, resources.bindGroup);
      passEncoder.draw(6, 1, 0, 0);
      passEncoder.end();

      this.gpu.device.queue.submit([commandEncoder.finish()]);

      return new VideoFrame(resources.canvas, {
        timestamp: videoFrame.timestamp,
        duration: videoFrame.duration ?? undefined,
      });
    } catch (error) {
      console.warn('[WebGPUAdapter] compositeVideoFrame failed:', error);
      return null;
    }
  }

  /**
   * Render overlay using WebGPU
   */
  async renderOverlay(
    ctx: OverlayContext2D,
    frame: TelemetryFrame,
    videoWidth: number,
    videoHeight: number,
    config: ExtendedOverlayConfig
  ): Promise<boolean> {
    if (!this.isEnabled()) return false;

    const overlayCanvas = this.renderOverlayToCanvas(frame, videoWidth, videoHeight, config);
    return this.compositeOverlay(
      ctx,
      overlayCanvas as CanvasImageSource,
      videoWidth,
      videoHeight,
    );
  }

  /**
   * Render overlay on VideoFrame
   */
  async renderOverlayOnFrame(
    videoFrame: VideoFrame,
    telemetryFrame: TelemetryFrame,
    config: ExtendedOverlayConfig
  ): Promise<VideoFrame | null> {
    const width = videoFrame.displayWidth;
    const height = videoFrame.displayHeight;

    const canvas = this.createCanvas(width, height);
    const ctx = this.get2dContext(canvas);
    if (!ctx) return null;

    ctx.drawImage(videoFrame, 0, 0, width, height);
    const rendered = await this.renderOverlay(ctx as OverlayContext2D, telemetryFrame, width, height, config);
    if (!rendered) return null;

    return new VideoFrame(canvas, {
      timestamp: videoFrame.timestamp,
      duration: videoFrame.duration ?? undefined,
    });
  }

  private createCanvas(width: number, height: number): OffscreenCanvas | HTMLCanvasElement {
    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(width, height);
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  private ensureCompositeResources(width: number, height: number): GPUCompositeResources | null {
    if (!this.gpu) return null;

    if (this.compositeResources && this.compositeResources.width === width && this.compositeResources.height === height) {
      return this.compositeResources;
    }

    this.disposeCompositeResources();

    const canvas = this.createCanvas(width, height);
    const context = canvas.getContext('webgpu') as GPUCanvasContext | null;
    if (!context) return null;

    context.configure({
      device: this.gpu.device,
      format: this.gpu.format,
      alphaMode: 'premultiplied',
      usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
    });

    const baseTexture = this.gpu.device.createTexture({
      size: [width, height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const overlayTexture = this.gpu.device.createTexture({
      size: [width, height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });

    const uniformData = new Float32Array([1.0, 0, 0, 0]);
    const uniformBuffer = this.gpu.device.createBuffer({
      size: uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.gpu.device.queue.writeBuffer(uniformBuffer, 0, uniformData);

    const bindGroup = this.gpu.device.createBindGroup({
      layout: this.gpu.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: this.gpu.sampler },
        { binding: 1, resource: baseTexture.createView() },
        { binding: 2, resource: overlayTexture.createView() },
        { binding: 3, resource: { buffer: uniformBuffer } },
      ],
    });

    this.compositeResources = {
      canvas,
      context,
      width,
      height,
      baseTexture,
      overlayTexture,
      uniformBuffer,
      bindGroup,
      lastOverlayKey: null,
    };

    return this.compositeResources;
  }

  private disposeCompositeResources(): void {
    if (!this.compositeResources) return;

    this.compositeResources.baseTexture.destroy();
    this.compositeResources.overlayTexture.destroy();
    this.compositeResources.uniformBuffer.destroy();
    this.compositeResources = null;
  }

  private renderOverlayToCanvas(
    frame: TelemetryFrame,
    width: number,
    height: number,
    config: ExtendedOverlayConfig,
  ): OffscreenCanvas | HTMLCanvasElement {
    const overlayCanvas = this.createCanvas(width, height);
    const overlayCtx = this.get2dContext(overlayCanvas);
    if (!overlayCtx) return overlayCanvas;

    const lines: string[] = [];
    if (config.showPace && frame.paceSecondsPerKm !== undefined) {
      const pace = formatPace(frame.paceSecondsPerKm);
      if (pace) lines.push(`PACE  ${pace} min/km`);
    }
    if (config.showHr && frame.hr !== undefined) {
      lines.push(`HR    ${frame.hr} bpm`);
    }
    if (config.showDistance) {
      lines.push(`DIST  ${frame.distanceKm.toFixed(2)} km`);
    }
    if (config.showTime) {
      lines.push(`TIME  ${frame.elapsedTime}`);
    }

    if (lines.length === 0) return overlayCanvas;

    const fontSize = Math.max(14, Math.round((config.fontSizePercent || 2.4) * Math.min(width, height) / 100));
    const lineHeight = Math.round(fontSize * (config.lineSpacing || 1.2));
    const padding = Math.max(10, Math.round(fontSize * 0.7));

    overlayCtx.font = `${config.valueFontWeight || '600'} ${fontSize}px ${config.fontFamily || 'sans-serif'}`;
    overlayCtx.textBaseline = 'top';

    const textWidth = Math.max(...lines.map((line) => overlayCtx.measureText(line).width));
    const boxWidth = Math.ceil(textWidth + padding * 2);
    const boxHeight = Math.ceil(lineHeight * lines.length + padding * 2);

    const x = Math.max(16, Math.round(width * 0.03));
    const y = Math.max(16, height - boxHeight - Math.round(height * 0.03));

    overlayCtx.save();
    overlayCtx.globalAlpha = config.backgroundOpacity ?? 0.85;
    overlayCtx.fillStyle = config.backgroundColor || '#000000';
    const radius = Math.max(0, Math.round(config.cornerRadius || 0));
    if ('roundRect' in overlayCtx && typeof overlayCtx.roundRect === 'function' && radius > 0) {
      overlayCtx.beginPath();
      overlayCtx.roundRect(x, y, boxWidth, boxHeight, radius);
      overlayCtx.fill();
    } else {
      overlayCtx.fillRect(x, y, boxWidth, boxHeight);
    }
    overlayCtx.restore();

    overlayCtx.fillStyle = config.textColor || '#FFFFFF';
    lines.forEach((line, idx) => {
      overlayCtx.fillText(line, x + padding, y + padding + idx * lineHeight);
    });

    return overlayCanvas;
  }

  /**
   * Get WGSL shader code for overlay rendering
   */
  private getOverlayShaderCode(): string {
    return `
      struct VertexOutput {
        @builtin(position) position: vec4f,
        @location(0) uv: vec2f,
      };

      struct Uniforms {
        overlayOpacity: f32,
        padding0: f32,
        padding1: f32,
        padding2: f32,
      };
      
      @vertex
      fn vertexMain(@builtin(vertex_index) vertexIndex: u32) -> VertexOutput {
        const pos = array(
          vec2f(-1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, -1.0),
          vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0)
        );
        const uv = array(
          vec2f(0.0, 1.0), vec2f(0.0, 0.0), vec2f(1.0, 1.0),
          vec2f(1.0, 1.0), vec2f(0.0, 0.0), vec2f(1.0, 0.0)
        );
        
        var output: VertexOutput;
        output.position = vec4f(pos[vertexIndex], 0.0, 1.0);
        output.uv = uv[vertexIndex];
        return output;
      }
      
      @group(0) @binding(0) var textureSampler: sampler;
      @group(0) @binding(1) var baseTexture: texture_2d<f32>;
      @group(0) @binding(2) var overlayTexture: texture_2d<f32>;
      @group(0) @binding(3) var<uniform> uniforms: Uniforms;
      
      @fragment
      fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
        let base = textureSample(baseTexture, textureSampler, input.uv);
        let overlay = textureSample(overlayTexture, textureSampler, input.uv);
        let overlayAlpha = overlay.a * uniforms.overlayOpacity;

        let rgb = mix(base.rgb, overlay.rgb, overlayAlpha);
        let outAlpha = max(base.a, overlayAlpha);
        return vec4f(rgb, outAlpha);
      }
    `;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.disposeCompositeResources();
    this.gpu?.device.destroy();
    this.gpu = null;
    this.isInitialized = false;
    this.initPromise = null;
  }
}

/**
 * Get WebGPU status
 */
export function getWebGPUStatus(): {
  supported: boolean;
  enabled: boolean;
  available: boolean;
} {
  const supported = WebGPUAdapter.isSupported();
  const adapter = WebGPUAdapter.getInstance();
  const enabled = adapter.isEnabled();

  return {
    supported,
    enabled,
    available: supported && enabled,
  };
}

/**
 * Toggle WebGPU
 */
export function toggleWebGPU(enabled: boolean): void {
  const adapter = WebGPUAdapter.getInstance();
  adapter.setEnabled(enabled);
}

/**
 * Check if WebGPU is available
 */
export function isWebGPUAvailable(): boolean {
  const status = getWebGPUStatus();
  return status.available;
}
