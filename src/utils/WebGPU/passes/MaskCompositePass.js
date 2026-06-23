import { GPU_BUFFER_USAGE, GPU_TEXTURE_USAGE } from "../constants";
import { createBindGroup, dispatchCompute } from "./shared";

const BLACK_PIXEL = new Uint8Array([0, 0, 0, 0]);

const MASK_COMPOSITE_SHADER = `
struct Params {
  width: f32,
  height: f32,
  invert: f32,
  pad0: f32,
};

@group(0) @binding(0) var processedTex: texture_2d<f32>;
@group(0) @binding(1) var originalTex: texture_2d<f32>;
@group(0) @binding(2) var maskTex: texture_2d<f32>;
@group(0) @binding(3) var srcSampler: sampler;
@group(0) @binding(4) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(5) var<uniform> params: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let uv = (vec2<f32>(gid.xy) + vec2<f32>(0.5)) / vec2<f32>(params.width, params.height);
  let processed = textureSampleLevel(processedTex, srcSampler, uv, 0.0);
  let original = textureSampleLevel(originalTex, srcSampler, uv, 0.0);
  var maskValue = textureSampleLevel(maskTex, srcSampler, uv, 0.0).a;
  if (params.invert > 0.5) {
    maskValue = 1.0 - maskValue;
  }
  maskValue = clamp(maskValue, 0.0, 1.0);
  textureStore(dstTex, vec2<i32>(gid.xy), mix(original, processed, maskValue));
}
`;

export default class WebGPUMaskCompositePass {
  static type = "MASK";

  constructor(device, opts = {}) {
    this.device = device;
    this.invert = !!opts.invert;
    this.maskCanvas = opts.canvas || null;
    this.maskVersion = Number(opts.version ?? 0);
    this.uploadedMaskVersion = -1;
    this.maskTextureSize = { width: 0, height: 0 };

    this.module = device.createShaderModule({ code: MASK_COMPOSITE_SHADER });
    this.pipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module: this.module, entryPoint: "main" },
    });
    this.uniformBuffer = device.createBuffer({
      size: 16,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
    });
    this.uniformData = new Float32Array(4);
    this.sampler = device.createSampler({
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
    });
    this._createMaskTexture(1, 1);
    this.device.queue.writeTexture(
      { texture: this.maskTexture },
      BLACK_PIXEL,
      { bytesPerRow: 4 },
      { width: 1, height: 1 },
    );
  }

  setOption(name, value) {
    if (name === "invert") {
      this.invert = !!value;
      return;
    }
    if (name === "canvas") {
      this.maskCanvas = value || null;
      this.uploadedMaskVersion = -1;
      return;
    }
    if (name === "version") {
      this.maskVersion = Number(value ?? 0);
    }
  }

  _createMaskTexture(width, height) {
    this.maskTexture?.destroy();
    this.maskTexture = this.device.createTexture({
      size: { width, height },
      format: "rgba8unorm",
      usage: GPU_TEXTURE_USAGE.TEXTURE_BINDING | GPU_TEXTURE_USAGE.COPY_DST,
    });
    this.maskTextureSize = { width, height };
  }

  updateMaskTexture() {
    const canvas = this.maskCanvas;
    if (!canvas || !canvas.width || !canvas.height) {
      if (
        this.maskTextureSize.width !== 1 ||
        this.maskTextureSize.height !== 1
      ) {
        this._createMaskTexture(1, 1);
      }
      this.device.queue.writeTexture(
        { texture: this.maskTexture },
        BLACK_PIXEL,
        { bytesPerRow: 4 },
        { width: 1, height: 1 },
      );
      this.uploadedMaskVersion = this.maskVersion;
      return;
    }

    if (
      this.maskTextureSize.width !== canvas.width ||
      this.maskTextureSize.height !== canvas.height
    ) {
      this._createMaskTexture(canvas.width, canvas.height);
    }

    this.device.queue.copyExternalImageToTexture(
      { source: canvas },
      { texture: this.maskTexture },
      { width: canvas.width, height: canvas.height },
    );
    this.uploadedMaskVersion = this.maskVersion;
  }

  render(encoder, state, pool) {
    const originalTexture = state.originalTexture || state.texture;
    if (!state.texture || !originalTexture) return state;

    if (this.uploadedMaskVersion !== this.maskVersion) {
      this.updateMaskTexture();
    }

    const width = state.originalWidth || state.width;
    const height = state.originalHeight || state.height;
    const output = pool.getTemp(width, height, [state.texture, originalTexture]);

    this.uniformData[0] = width;
    this.uniformData[1] = height;
    this.uniformData[2] = this.invert ? 1 : 0;
    this.uniformData[3] = 0;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData);

    const bindGroup = createBindGroup(this.device, this.pipeline, [
      { binding: 0, resource: state.texture.createView() },
      { binding: 1, resource: originalTexture.createView() },
      { binding: 2, resource: this.maskTexture.createView() },
      { binding: 3, resource: this.sampler },
      { binding: 4, resource: output.createView() },
      { binding: 5, resource: { buffer: this.uniformBuffer } },
    ]);

    dispatchCompute(encoder, this.pipeline, bindGroup, width, height);

    return { texture: output, width, height };
  }

  destroy() {
    this.uniformBuffer?.destroy();
    this.maskTexture?.destroy();
  }
}
