import { GPU_BUFFER_USAGE } from "../constants";
import { createBindGroup, dispatchCompute } from "./shared";

const BLUR_SHADER = `
struct Params {
  width: f32,
  height: f32,
  texelX: f32,
  texelY: f32,
  sigma: f32,
  radius: f32,
  dirX: f32,
  dirY: f32,
};

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var srcSampler: sampler;
@group(0) @binding(2) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> params: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let uv = (vec2<f32>(gid.xy) + vec2<f32>(0.5)) / vec2<f32>(params.width, params.height);
  let texel = vec2<f32>(params.texelX, params.texelY);
  let direction = vec2<f32>(params.dirX, params.dirY);
  let twoSigma2 = 2.0 * params.sigma * params.sigma;
  let radius = i32(params.radius);
  var sumC = vec3<f32>(0.0);
  var sumA = 0.0;
  var sumW = 0.0;

  for (var i = -30; i <= 30; i = i + 1) {
    if (i >= -radius && i <= radius) {
      let x = f32(i);
      let w = exp(-(x * x) / twoSigma2);
      let sample = textureSampleLevel(srcTex, srcSampler, uv + direction * x * texel, 0.0);
      sumC = sumC + sample.rgb * w;
      sumA = sumA + sample.a * w;
      sumW = sumW + w;
    }
  }

  textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(sumC / sumW, sumA / sumW));
}
`;

export default class WebGPUGaussianBlurPass {
  static type = "GAUSSIAN_BLUR";

  constructor(device, opts = {}) {
    this.device = device;
    this.sigma = opts.sigma ?? 1;
    this._updateRadius();
    this.module = device.createShaderModule({ code: BLUR_SHADER });
    this.pipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module: this.module, entryPoint: "main" },
    });
    this.uniformBuffer = device.createBuffer({
      size: 32,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
    });
    this.uniformData = new Float32Array(8);
    this.sampler = device.createSampler({
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
    });
  }

  setOption(name, value) {
    if (name === "sigma") {
      this.sigma = parseFloat(value) || 1;
      this._updateRadius();
    }
  }

  _updateRadius() {
    this.radius = Math.ceil(2 * this.sigma);
  }

  _writeUniforms(width, height, dirX, dirY) {
    this.uniformData[0] = width;
    this.uniformData[1] = height;
    this.uniformData[2] = 1 / Math.max(1, width);
    this.uniformData[3] = 1 / Math.max(1, height);
    this.uniformData[4] = Math.max(0.001, this.sigma);
    this.uniformData[5] = this.radius;
    this.uniformData[6] = dirX;
    this.uniformData[7] = dirY;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData);
  }

  _dispatch(encoder, src, dst, width, height, dirX, dirY) {
    this._writeUniforms(width, height, dirX, dirY);
    const bindGroup = createBindGroup(this.device, this.pipeline, [
      { binding: 0, resource: src.createView() },
      { binding: 1, resource: this.sampler },
      { binding: 2, resource: dst.createView() },
      { binding: 3, resource: { buffer: this.uniformBuffer } },
    ]);
    dispatchCompute(encoder, this.pipeline, bindGroup, width, height);
  }

  render(encoder, state, pool) {
    const passH = pool.getTemp(state.width, state.height, state.texture);
    const passV = pool.getTemp(state.width, state.height, [
      state.texture,
      passH,
    ]);
    this._dispatch(encoder, state.texture, passH, state.width, state.height, 1, 0);
    this._dispatch(encoder, passH, passV, state.width, state.height, 0, 1);
    pool.returnTemp(passH, state.width, state.height);
    return { texture: passV, width: state.width, height: state.height };
  }

  destroy() {
    this.uniformBuffer?.destroy();
    this.uniformBuffer = null;
  }
}
