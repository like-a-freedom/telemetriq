export interface WebGPUContextOptions {
  powerPreference?: GPUPowerPreference;
  forceFallback?: boolean;
  alphaMode?: GPUCanvasAlphaMode;
}

export interface WebGPUDeviceInfo {
  adapterInfo: GPUAdapterInfo | null;
  deviceLimits: GPUSupportedLimits;
  deviceFeatures: GPUFeatureName[];
}

/**
 * WebGPU context manager that handles initialization and resource management
 */
export class WebGPUContext {
  private adapter: GPUAdapter | null = null;
  private device: GPUDevice | null = null;
  private canvasContext: GPUCanvasContext | null = null;
  private isInitialized = false;

  constructor(options: WebGPUContextOptions = {}) {
    this.options = options;
  }
  private options: WebGPUContextOptions;

  /**
   * Check if WebGPU is supported in the current environment
   */
  static isSupported(): boolean {
    return typeof navigator !== 'undefined' &&
      'gpu' in navigator &&
      navigator.gpu !== undefined;
  }

  /**
   * Get GPU adapter info for debugging and feature detection
   */
  static async getGPUInfo(): Promise<GPUAdapterInfo | null> {
    if (!WebGPUContext.isSupported()) return null;

    try {
      const adapter = await navigator.gpu.requestAdapter();
      return adapter?.info || null;
    } catch {
      return null;
    }
  }

  /**
   * Initialize WebGPU context
   * @param canvas Optional canvas element to configure context for
   */
  async initialize(canvas?: HTMLCanvasElement | OffscreenCanvas): Promise<boolean> {
    if (!WebGPUContext.isSupported()) {
      console.warn('WebGPU is not supported in this environment');
      return false;
    }

    try {
      // Request adapter
      const adapterOptions: GPURequestAdapterOptions = {
        powerPreference: this.options.powerPreference || 'high-performance',
      };

      this.adapter = await navigator.gpu.requestAdapter(adapterOptions);

      if (!this.adapter) {
        console.warn('No WebGPU adapter available');
        return false;
      }

      // Request device (only available optional features to avoid init failures)
      const requiredFeatures: GPUFeatureName[] = [];
      if (this.adapter.features.has('timestamp-query')) {
        requiredFeatures.push('timestamp-query');
      }

      const requiredLimits: Record<string, number> = {
        maxTextureDimension2D: 8192,
        maxTextureArrayLayers: 1,
        maxBindGroups: 4,
        maxUniformBuffersPerShaderStage: 12,
        maxStorageBuffersPerShaderStage: 4,
        maxSampledTexturesPerShaderStage: 16,
        maxStorageTexturesPerShaderStage: 4,
        maxUniformBufferBindingSize: 65536,
        maxStorageBufferBindingSize: 134217728,
        minUniformBufferOffsetAlignment: 256,
        minStorageBufferOffsetAlignment: 256,
        maxVertexBuffers: 8,
        maxBufferSize: 268435456,
        maxVertexAttributes: 16,
        maxVertexBufferArrayStride: 2048,
        maxInterStageShaderComponents: 60,
        maxComputeWorkgroupStorageSize: 16384,
        maxComputeInvocationsPerWorkgroup: 256,
        maxComputeWorkgroupSizeX: 256,
        maxComputeWorkgroupSizeY: 256,
        maxComputeWorkgroupSizeZ: 64,
        maxComputeWorkgroupsPerDimension: 65535,
      };

      this.device = await this.adapter.requestDevice({
        requiredFeatures,
        requiredLimits,
      });

      if (!this.device) {
        console.warn('Failed to request WebGPU device');
        return false;
      }

      // Configure canvas context if provided
      if (canvas) {
        await this.configureCanvas(canvas);
      }

      this.isInitialized = true;

      // Set up error handling
      this.device.addEventListener('uncapturederror', (event) => {
        console.error('WebGPU uncaptured error:', event.error);
      });

      this.device.pushErrorScope('validation');
      this.device.pushErrorScope('out-of-memory');
      this.device.pushErrorScope('internal');

      return true;
    } catch (error) {
      console.error('Failed to initialize WebGPU:', error);
      return false;
    }
  }

  /**
   * Configure canvas for WebGPU rendering
   */
  async configureCanvas(canvas: HTMLCanvasElement | OffscreenCanvas): Promise<boolean> {
    if (!this.device || !this.adapter) {
      console.warn('WebGPU device not initialized');
      return false;
    }

    try {
      const context = canvas.getContext('webgpu');
      if (!context) {
        console.warn('Failed to get WebGPU context from canvas');
        return false;
      }

      const format = navigator.gpu.getPreferredCanvasFormat();

      context.configure({
        device: this.device,
        format,
        usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
        alphaMode: this.options.alphaMode || 'premultiplied',
      });

      this.canvasContext = context;
      return true;
    } catch (error) {
      console.error('Failed to configure canvas for WebGPU:', error);
      return false;
    }
  }

  /**
   * Get device info for debugging
   */
  getDeviceInfo(): WebGPUDeviceInfo | null {
    if (!this.device || !this.adapter) return null;

    return {
      adapterInfo: this.adapter.info,
      deviceLimits: this.device.limits,
      deviceFeatures: [] as GPUFeatureName[],
    };
  }

  /**
   * Create a texture from image source
   */
  createTextureFromImage(
    source: ImageBitmap | HTMLCanvasElement | OffscreenCanvas | VideoFrame,
    usage: GPUTextureUsageFlags = GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
  ): GPUTexture | null {
    if (!this.device) return null;

    try {
      const width = (source as HTMLCanvasElement).width || (source as ImageBitmap).width || 0;
      const height = (source as HTMLCanvasElement).height || (source as ImageBitmap).height || 0;

      const texture = this.device.createTexture({
        size: [width, height],
        format: 'rgba8unorm',
        usage,
        label: 'ImageTexture',
      });

      // Copy image data to texture
      this.device.queue.copyExternalImageToTexture(
        { source },
        { texture },
        [width, height]
      );

      return texture;
    } catch (error) {
      console.error('Failed to create texture from image:', error);
      return null;
    }
  }

  /**
   * Create a texture for SDF data
   */
  createSDFTexture(
    width: number,
    height: number,
    data?: Uint8Array
  ): GPUTexture | null {
    if (!this.device) return null;

    try {
      const texture = this.device.createTexture({
        size: [width, height],
        format: 'r8unorm', // Single channel for SDF
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        label: 'SDFTexture',
      });

      if (data) {
        const uploadData = new Uint8Array(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
        this.device.queue.writeTexture(
          { texture },
          uploadData as unknown as BufferSource,
          { bytesPerRow: width, rowsPerImage: height },
          [width, height]
        );
      }

      return texture;
    } catch (error) {
      console.error('Failed to create SDF texture:', error);
      return null;
    }
  }

  /**
   * Create a buffer with data
   */
  createBuffer(
    data: ArrayBufferView,
    usage: GPUBufferUsageFlags
  ): GPUBuffer | null {
    if (!this.device) return null;

    try {
      const buffer = this.device.createBuffer({
        size: data.byteLength,
        usage,
        mappedAtCreation: true,
      });

      const arrayBuffer = buffer.getMappedRange();
      new Uint8Array(arrayBuffer).set(new Uint8Array(data.buffer as ArrayBuffer));
      buffer.unmap();

      return buffer;
    } catch (error) {
      console.error('Failed to create buffer:', error);
      return null;
    }
  }

  /**
   * Create a render pipeline for 2D compositing
   */
  createRenderPipeline(vertexShader: string, fragmentShader: string): GPURenderPipeline | null {
    if (!this.device) return null;

    try {
      const module = this.device.createShaderModule({
        code: fragmentShader,
      });

      const pipeline = this.device.createRenderPipeline({
        layout: 'auto',
        vertex: {
          module: this.device.createShaderModule({
            code: vertexShader,
          }),
          entryPoint: 'main',
        },
        fragment: {
          module,
          entryPoint: 'main',
          targets: [{
            format: navigator.gpu.getPreferredCanvasFormat(),
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

      return pipeline;
    } catch (error) {
      console.error('Failed to create render pipeline:', error);
      return null;
    }
  }

  /**
   * Begin a render pass
   */
  beginRenderPass(
    colorAttachment: GPURenderPassColorAttachment,
    depthStencilAttachment?: GPURenderPassDepthStencilAttachment
  ): {
    commandEncoder: GPUCommandEncoder;
    passEncoder: GPURenderPassEncoder;
  } | null {
    if (!this.device) return null;

    try {
      const commandEncoder = this.device.createCommandEncoder();
      const passEncoder = commandEncoder.beginRenderPass({
        colorAttachments: [colorAttachment],
        depthStencilAttachment,
      });

      return { commandEncoder, passEncoder };
    } catch (error) {
      console.error('Failed to begin render pass:', error);
      return null;
    }
  }

  /**
   * Submit commands to GPU
   */
  submitCommands(commands: GPUCommandBuffer[]): boolean {
    if (!this.device) return false;

    try {
      this.device.queue.submit(commands);
      return true;
    } catch (error) {
      console.error('Failed to submit commands:', error);
      return false;
    }
  }

  /**
   * Get the current device
   */
  getDevice(): GPUDevice | null {
    return this.device;
  }

  /**
   * Get the current canvas context
   */
  getCanvasContext(): GPUCanvasContext | null {
    return this.canvasContext;
  }

  /**
   * Check if context is initialized
   */
  isReady(): boolean {
    return this.isInitialized && this.device !== null;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.device?.destroy();
    this.device = null;
    this.adapter = null;
    this.canvasContext = null;
    this.isInitialized = false;
  }
}