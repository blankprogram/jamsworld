import WebGPUTexturePool from "./WebGPUTexturePool";
import { GPU_BUFFER_USAGE, GPU_TEXTURE_USAGE } from "./constants";

const PRESENT_SHADER = `
struct VertexOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );

  var uv = array<vec2<f32>, 3>(
    vec2<f32>(0.0, 1.0),
    vec2<f32>(2.0, 1.0),
    vec2<f32>(0.0, -1.0)
  );

  var out: VertexOut;
  out.position = vec4<f32>(pos[vertexIndex], 0.0, 1.0);
  out.uv = uv[vertexIndex];
  return out;
}

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var srcSampler: sampler;

@fragment
fn fs(in: VertexOut) -> @location(0) vec4<f32> {
  return textureSample(srcTex, srcSampler, in.uv);
}
`;

function assertWebGPUAvailable() {
  return !!(
    typeof navigator !== "undefined" &&
    navigator.gpu &&
    typeof navigator.gpu.requestAdapter === "function" &&
    typeof navigator.gpu.getPreferredCanvasFormat === "function"
  );
}

function alignTo(value, alignment) {
  return Math.ceil(value / alignment) * alignment;
}

const MAX_REQUESTED_WORKGROUP_STORAGE_SIZE = 65536;

export default class WebGPUPipeline {
  static isSupported() {
    return assertWebGPUAvailable();
  }

  static async create(canvas) {
    if (!WebGPUPipeline.isSupported()) {
      throw new Error("WebGPU is not supported in this browser");
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("No WebGPU adapter available");

    const requiredLimits = {};
    const requestedWorkgroupStorageSize = Math.min(
      adapter.limits.maxComputeWorkgroupStorageSize,
      MAX_REQUESTED_WORKGROUP_STORAGE_SIZE,
    );
    if (requestedWorkgroupStorageSize > 16384) {
      requiredLimits.maxComputeWorkgroupStorageSize =
        requestedWorkgroupStorageSize;
    }

    const deviceDescriptor = {};
    if (Object.keys(requiredLimits).length) {
      deviceDescriptor.requiredLimits = requiredLimits;
    }

    const device = await adapter.requestDevice(
      Object.keys(deviceDescriptor).length ? deviceDescriptor : undefined,
    );
    return new WebGPUPipeline(canvas, device);
  }

  constructor(canvas, device) {
    this.canvas = canvas;
    this.device = device;
    this.context = canvas.getContext("webgpu");
    if (!this.context) throw new Error("Failed to create WebGPU context");

    this.format = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device,
      format: this.format,
      usage: GPU_TEXTURE_USAGE.RENDER_ATTACHMENT,
      alphaMode: "premultiplied",
    });

    this.pool = new WebGPUTexturePool(device, "rgba8unorm");
    this.presentSampler = device.createSampler({
      magFilter: "nearest",
      minFilter: "nearest",
    });
    this.presentModule = device.createShaderModule({ code: PRESENT_SHADER });
    this.presentPipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: {
        module: this.presentModule,
        entryPoint: "vs",
      },
      fragment: {
        module: this.presentModule,
        entryPoint: "fs",
        targets: [{ format: this.format }],
      },
      primitive: { topology: "triangle-list" },
    });
    this.passes = [];
    this._inputTexture = null;
    this._imgSize = { width: 0, height: 0 };
    this._videoCanvas = null;
    this._videoCtx = null;
  }

  _setCanvasSize(width, height) {
    if (this.canvas.width !== width) {
      this.canvas.width = width;
      this.canvas.setAttribute("width", String(width));
    }
    if (this.canvas.height !== height) {
      this.canvas.height = height;
      this.canvas.setAttribute("height", String(height));
    }
  }

  _ensureInputTexture(width, height) {
    const sizeChanged =
      this._imgSize.width !== width || this._imgSize.height !== height;

    if (this._inputTexture && !sizeChanged) return this._inputTexture;

    this._inputTexture?.destroy();
    this._inputTexture = this.device.createTexture({
      size: { width, height },
      format: "rgba8unorm",
      usage:
        GPU_TEXTURE_USAGE.TEXTURE_BINDING |
        GPU_TEXTURE_USAGE.STORAGE_BINDING |
        GPU_TEXTURE_USAGE.COPY_DST |
        GPU_TEXTURE_USAGE.COPY_SRC |
        GPU_TEXTURE_USAGE.RENDER_ATTACHMENT,
    });
    this._imgSize = { width, height };
    this._setCanvasSize(width, height);
    return this._inputTexture;
  }

  _copyExternalSource(src, width, height) {
    const texture = this._ensureInputTexture(width, height);
    this.device.queue.copyExternalImageToTexture(
      { source: src },
      { texture },
      { width, height },
    );
    return true;
  }

  prepareImage(src) {
    const width = src?.width | 0 || 0;
    const height = src?.height | 0 || 0;
    if (width <= 0 || height <= 0) return false;
    return this._copyExternalSource(src, width, height);
  }

  prepareVideo(videoEl) {
    const width = videoEl?.videoWidth | 0;
    const height = videoEl?.videoHeight | 0;
    if (width <= 0 || height <= 0) return false;
    this._ensureInputTexture(width, height);
    return true;
  }

  _getVideoCanvas(width, height) {
    if (!this._videoCanvas) {
      this._videoCanvas = document.createElement("canvas");
      this._videoCtx = this._videoCanvas.getContext("2d", {
        alpha: false,
        willReadFrequently: false,
      });
    }
    if (this._videoCanvas.width !== width) this._videoCanvas.width = width;
    if (this._videoCanvas.height !== height) this._videoCanvas.height = height;
    return this._videoCanvas;
  }

  updateVideoFrame(videoEl) {
    const width = videoEl?.videoWidth | 0;
    const height = videoEl?.videoHeight | 0;
    if (width <= 0 || height <= 0) return false;
    const canvas = this._getVideoCanvas(width, height);
    if (!this._videoCtx) return false;
    this._videoCtx.drawImage(videoEl, 0, 0, width, height);
    return this._copyExternalSource(canvas, width, height);
  }

  _createInitialState() {
    return {
      texture: this._inputTexture,
      width: this._imgSize.width,
      height: this._imgSize.height,
      originalTexture: this._inputTexture,
      originalWidth: this._imgSize.width,
      originalHeight: this._imgSize.height,
    };
  }

  _runPassChain(encoder) {
    const usedTextures = [];
    let state = this._createInitialState();

    for (const pass of this.passes) {
      const next = pass.render(encoder, state, this.pool);
      if (state.texture !== this._inputTexture) {
        usedTextures.push({ ...state });
      }
      state = {
        ...next,
        originalTexture: this._inputTexture,
        originalWidth: this._imgSize.width,
        originalHeight: this._imgSize.height,
      };
    }

    return { state, usedTextures };
  }

  _returnUsedTextures(state, usedTextures) {
    for (const temp of usedTextures) {
      this.pool.returnTemp(temp.texture, temp.width, temp.height);
    }
    if (state.texture !== this._inputTexture) {
      this.pool.returnTemp(state.texture, state.width, state.height);
    }
  }

  renderFrame() {
    if (!this._inputTexture || this._imgSize.width <= 0 || this._imgSize.height <= 0) {
      return {
        texture: null,
        width: this._imgSize.width,
        height: this._imgSize.height,
      };
    }

    const encoder = this.device.createCommandEncoder();
    const { state, usedTextures } = this._runPassChain(encoder);

    this._setCanvasSize(state.width, state.height);
    this._present(encoder, state.texture);

    this.device.queue.submit([encoder.finish()]);
    this._returnUsedTextures(state, usedTextures);

    return state;
  }

  async renderFrameToImageData() {
    if (!this._inputTexture || this._imgSize.width <= 0 || this._imgSize.height <= 0) {
      return null;
    }

    const encoder = this.device.createCommandEncoder();
    const { state, usedTextures } = this._runPassChain(encoder);

    this._setCanvasSize(state.width, state.height);
    this._present(encoder, state.texture);

    const bytesPerPixel = 4;
    const unpaddedBytesPerRow = state.width * bytesPerPixel;
    const bytesPerRow = alignTo(unpaddedBytesPerRow, 256);
    const bufferSize = bytesPerRow * state.height;
    const readBuffer = this.device.createBuffer({
      size: bufferSize,
      usage: GPU_BUFFER_USAGE.COPY_DST | GPU_BUFFER_USAGE.MAP_READ,
    });

    encoder.copyTextureToBuffer(
      { texture: state.texture },
      { buffer: readBuffer, bytesPerRow, rowsPerImage: state.height },
      { width: state.width, height: state.height },
    );

    this.device.queue.submit([encoder.finish()]);
    await readBuffer.mapAsync(GPU_BUFFER_USAGE.MAP_READ);

    const mapped = new Uint8Array(readBuffer.getMappedRange());
    const pixels = new Uint8ClampedArray(unpaddedBytesPerRow * state.height);
    for (let row = 0; row < state.height; row += 1) {
      const srcStart = row * bytesPerRow;
      const dstStart = row * unpaddedBytesPerRow;
      pixels.set(
        mapped.subarray(srcStart, srcStart + unpaddedBytesPerRow),
        dstStart,
      );
    }

    readBuffer.unmap();
    readBuffer.destroy();

    this._returnUsedTextures(state, usedTextures);

    return new ImageData(pixels, state.width, state.height);
  }

  _present(encoder, texture) {
    const presentation = this.context.getCurrentTexture();
    const bindGroup = this.device.createBindGroup({
      layout: this.presentPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: texture.createView() },
        { binding: 1, resource: this.presentSampler },
      ],
    });
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: presentation.createView(),
          loadOp: "clear",
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          storeOp: "store",
        },
      ],
    });
    pass.setPipeline(this.presentPipeline);
    pass.setBindGroup(0, bindGroup);
    pass.draw(3);
    pass.end();
  }

  clearToTransparent() {
    const texture = this.context.getCurrentTexture();
    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: texture.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
    });
    pass.end();
    this.device.queue.submit([encoder.finish()]);
  }

  clearInputTexture() {
    this._inputTexture?.destroy();
    this._inputTexture = null;
    this._imgSize = { width: 0, height: 0 };
    this._setCanvasSize(1, 1);
    this.clearToTransparent();
  }

  destroy() {
    for (const pass of this.passes) pass.destroy?.();
    this.passes = [];
    this.pool.destroy();
    this._inputTexture?.destroy();
    this._inputTexture = null;
  }
}
