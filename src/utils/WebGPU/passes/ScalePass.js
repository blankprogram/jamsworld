import { GPU_BUFFER_USAGE } from "../constants";
import { createBindGroup, dispatchCompute } from "./shared";

const SCALE_SHADER = `
struct Params {
  srcWidth: f32,
  srcHeight: f32,
  dstWidth: f32,
  dstHeight: f32,
};

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var srcSampler: sampler;
@group(0) @binding(2) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> params: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dstWidth = u32(params.dstWidth);
  let dstHeight = u32(params.dstHeight);
  if (gid.x >= dstWidth || gid.y >= dstHeight) {
    return;
  }

  let coord = vec2<i32>(i32(gid.x), i32(gid.y));
  let pixel = vec2<f32>(f32(gid.x), f32(gid.y));
  let uv = (pixel + vec2<f32>(0.5)) / vec2<f32>(params.dstWidth, params.dstHeight);
  let color = textureSampleLevel(srcTex, srcSampler, uv, 0.0);
  textureStore(dstTex, coord, color);
}
`;

export default class WebGPUScalePass {
  static type = "SCALE";

  constructor(device, opts = {}) {
    this.device = device;
    this.scale = Number(opts.scale ?? 1);
    this.scaleX = Number(opts.scaleX ?? 1);
    this.scaleY = Number(opts.scaleY ?? 1);
    this.filter = opts.filter || "Nearest";
    this.uniform = opts.uniform || "Yes";
    this.maxTextureSize = Math.max(
      1,
      Number(device.limits?.maxTextureDimension2D) || 8192,
    );
    this.module = device.createShaderModule({
      label: "ScalePass shader",
      code: SCALE_SHADER,
    });
    this.pipeline = device.createComputePipeline({
      label: "ScalePass pipeline",
      layout: "auto",
      compute: { module: this.module, entryPoint: "main" },
    });
    this.uniformBuffer = device.createBuffer({
      size: 16,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
    });
    this.uniformData = new Float32Array(4);
    this.samplers = {
      Nearest: device.createSampler({
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        magFilter: "nearest",
        minFilter: "nearest",
      }),
      Linear: device.createSampler({
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
        magFilter: "linear",
        minFilter: "linear",
      }),
    };
  }

  setOption(name, value) {
    if (name === "scale") this.scale = Number(value);
    else if (name === "scaleX") this.scaleX = Number(value);
    else if (name === "scaleY") this.scaleY = Number(value);
    else if (name === "filter") this.filter = value;
    else if (name === "uniform") this.uniform = value;
  }

  _clampOutputSize(width, height) {
    if (width <= this.maxTextureSize && height <= this.maxTextureSize) {
      return { width, height };
    }

    const ratio = Math.min(
      this.maxTextureSize / width,
      this.maxTextureSize / height,
    );
    return {
      width: Math.max(1, Math.floor(width * ratio)),
      height: Math.max(1, Math.floor(height * ratio)),
    };
  }

  render(encoder, state, pool) {
    const sx = this.uniform === "Yes" ? this.scale : this.scaleX;
    const sy = this.uniform === "Yes" ? this.scale : this.scaleY;
    const requestedW = Math.max(1, Math.round(state.width * sx));
    const requestedH = Math.max(1, Math.round(state.height * sy));
    const { width: outW, height: outH } = this._clampOutputSize(
      requestedW,
      requestedH,
    );
    const output = pool.getTemp(outW, outH, state.texture);

    this.uniformData[0] = state.width;
    this.uniformData[1] = state.height;
    this.uniformData[2] = outW;
    this.uniformData[3] = outH;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData);

    const bindGroup = createBindGroup(this.device, this.pipeline, [
      { binding: 0, resource: state.texture.createView() },
      {
        binding: 1,
        resource: this.samplers[this.filter] || this.samplers.Nearest,
      },
      { binding: 2, resource: output.createView() },
      { binding: 3, resource: { buffer: this.uniformBuffer } },
    ]);

    dispatchCompute(encoder, this.pipeline, bindGroup, outW, outH);

    return { texture: output, width: outW, height: outH };
  }

  destroy() {
    this.uniformBuffer?.destroy();
    this.uniformBuffer = null;
  }
}
