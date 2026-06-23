import { GPU_BUFFER_USAGE } from "../constants";
import WebGPUGaussianBlurPass from "./GaussianBlurPass";

const TENSOR_SHADER = `
struct Params {
  width: f32,
  height: f32,
  texelX: f32,
  texelY: f32,
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
  let lx = (textureSampleLevel(srcTex, srcSampler, uv + vec2<f32>(texel.x, 0.0), 0.0).r -
            textureSampleLevel(srcTex, srcSampler, uv - vec2<f32>(texel.x, 0.0), 0.0).r) * 0.5;
  let ly = (textureSampleLevel(srcTex, srcSampler, uv + vec2<f32>(0.0, texel.y), 0.0).r -
            textureSampleLevel(srcTex, srcSampler, uv - vec2<f32>(0.0, texel.y), 0.0).r) * 0.5;
  let a = lx * lx;
  let b = lx * ly;
  let c = ly * ly;
  textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(a, b * 2.0 + 0.5, 0.0, c));
}
`;

const ORIENTATION_SHADER = `
struct Params {
  width: f32,
  height: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var tensorTex: texture_2d<f32>;
@group(0) @binding(1) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let t = textureLoad(tensorTex, vec2<i32>(gid.xy), 0);
  let a = t.r;
  let b = (t.g - 0.5) * 0.5;
  let c = t.a;
  let theta = 0.5 * atan2(2.0 * b, a - c);
  let tangent = normalize(vec2<f32>(cos(theta + 1.57079632679), sin(theta + 1.57079632679)));
  textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(tangent * 0.5 + vec2<f32>(0.5), 0.0, 1.0));
}
`;

const FLOW_SHADER = `
struct Params {
  width: f32,
  height: f32,
  texelX: f32,
  texelY: f32,
  sigma: f32,
  radius: f32,
  orthogonal: f32,
  pad0: f32,
};

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var directionTex: texture_2d<f32>;
@group(0) @binding(2) var srcSampler: sampler;
@group(0) @binding(3) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(4) var<uniform> params: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let uv = (vec2<f32>(gid.xy) + vec2<f32>(0.5)) / vec2<f32>(params.width, params.height);
  var dir = textureSampleLevel(directionTex, srcSampler, uv, 0.0).xy * 2.0 - vec2<f32>(1.0);
  if (params.orthogonal > 0.5) {
    dir = vec2<f32>(-dir.y, dir.x);
  }

  let twoSigma2 = 2.0 * params.sigma * params.sigma;
  let radius = i32(params.radius);
  let texel = vec2<f32>(params.texelX, params.texelY);
  var sumC = vec3<f32>(0.0);
  var sumA = 0.0;
  var sumW = 0.0;

  for (var i = -30; i <= 30; i = i + 1) {
    if (i >= -radius && i <= radius) {
      let t = f32(i);
      let w = exp(-(t * t) / twoSigma2);
      let s = textureSampleLevel(srcTex, srcSampler, uv + dir * t * texel, 0.0);
      sumC = sumC + s.rgb * w;
      sumA = sumA + s.a * w;
      sumW = sumW + w;
    }
  }

  textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(sumC / sumW, sumA / sumW));
}
`;

const THRESHOLD_SHADER = `
struct Params {
  width: f32,
  height: f32,
  p: f32,
  phi: f32,
  epsilon: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var srcA: texture_2d<f32>;
@group(0) @binding(1) var srcB: texture_2d<f32>;
@group(0) @binding(2) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> params: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let coord = vec2<i32>(gid.xy);
  let g1 = textureLoad(srcA, coord, 0).r;
  let g2 = textureLoad(srcB, coord, 0).r;
  let s = g1 + params.p * (g1 - g2);
  var m = 1.0 + tanh(params.phi * (s - params.epsilon));
  if (s >= params.epsilon) {
    m = 1.0;
  }
  textureStore(dstTex, coord, vec4<f32>(vec3<f32>(m), 1.0));
}
`;

class ComputeStage {
  constructor(device, shader, uniformSize) {
    this.device = device;
    this.module = device.createShaderModule({ code: shader });
    this.pipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module: this.module, entryPoint: "main" },
    });
    this.uniformBuffer = device.createBuffer({
      size: uniformSize,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
    });
  }

  bind(entries) {
    return this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries,
    });
  }

  dispatch(encoder, bindGroup, width, height) {
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    pass.end();
  }

  write(data) {
    this.device.queue.writeBuffer(this.uniformBuffer, 0, data);
  }

  destroy() {
    this.uniformBuffer?.destroy();
    this.uniformBuffer = null;
  }
}

export default class WebGPUXDoGPass {
  static type = "XDOG";

  constructor(device, opts = {}) {
    this.device = device;
    this.sigmaC = opts.sigmaC ?? 1;
    this.sigmaE = opts.sigmaE ?? 1.6;
    this.k = opts.k ?? 1.6;
    this.sigmaM = opts.sigmaM ?? 1;
    this.p = opts.p ?? 20;
    this.phi = opts.phi ?? 10;
    this.epsilon = opts.epsilon ?? 0.5;
    this.sigmaA = opts.sigmaA ?? 1;

    this.sampler = device.createSampler({
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      magFilter: "linear",
      minFilter: "linear",
    });
    this.blurC = new WebGPUGaussianBlurPass(device, { sigma: this.sigmaC });
    this.blurA = new WebGPUGaussianBlurPass(device, { sigma: this.sigmaA });
    this.tensor = new ComputeStage(device, TENSOR_SHADER, 16);
    this.orientation = new ComputeStage(device, ORIENTATION_SHADER, 16);
    this.flow = new ComputeStage(device, FLOW_SHADER, 32);
    this.threshold = new ComputeStage(device, THRESHOLD_SHADER, 32);
    this.tensorUniformData = new Float32Array(4);
    this.orientationUniformData = new Float32Array(4);
    this.flowUniformData = new Float32Array(8);
    this.thresholdUniformData = new Float32Array(8);
  }

  setOption(name, value) {
    const v = parseFloat(value);
    this[name] = v;
    if (name === "sigmaC") this.blurC.setOption("sigma", v);
    if (name === "sigmaA") this.blurA.setOption("sigma", v);
  }

  _tensor(encoder, src, width, height, pool) {
    const output = pool.getTemp(width, height, src);
    this.tensorUniformData[0] = width;
    this.tensorUniformData[1] = height;
    this.tensorUniformData[2] = 1 / width;
    this.tensorUniformData[3] = 1 / height;
    this.tensor.write(this.tensorUniformData);
    const bindGroup = this.tensor.bind([
      { binding: 0, resource: src.createView() },
      { binding: 1, resource: this.sampler },
      { binding: 2, resource: output.createView() },
      { binding: 3, resource: { buffer: this.tensor.uniformBuffer } },
    ]);
    this.tensor.dispatch(encoder, bindGroup, width, height);
    return output;
  }

  _orientation(encoder, tensor, width, height, pool) {
    const output = pool.getTemp(width, height, tensor);
    this.orientationUniformData[0] = width;
    this.orientationUniformData[1] = height;
    this.orientationUniformData[2] = 0;
    this.orientationUniformData[3] = 0;
    this.orientation.write(this.orientationUniformData);
    const bindGroup = this.orientation.bind([
      { binding: 0, resource: tensor.createView() },
      { binding: 1, resource: output.createView() },
      { binding: 2, resource: { buffer: this.orientation.uniformBuffer } },
    ]);
    this.orientation.dispatch(encoder, bindGroup, width, height);
    return output;
  }

  _flow(encoder, src, direction, width, height, sigma, orthogonal, pool) {
    const output = pool.getTemp(width, height, [src, direction]);
    this.flowUniformData[0] = width;
    this.flowUniformData[1] = height;
    this.flowUniformData[2] = 1 / width;
    this.flowUniformData[3] = 1 / height;
    this.flowUniformData[4] = Math.max(0.001, sigma);
    this.flowUniformData[5] = Math.ceil(2 * sigma);
    this.flowUniformData[6] = orthogonal ? 1 : 0;
    this.flowUniformData[7] = 0;
    this.flow.write(this.flowUniformData);
    const bindGroup = this.flow.bind([
      { binding: 0, resource: src.createView() },
      { binding: 1, resource: direction.createView() },
      { binding: 2, resource: this.sampler },
      { binding: 3, resource: output.createView() },
      { binding: 4, resource: { buffer: this.flow.uniformBuffer } },
    ]);
    this.flow.dispatch(encoder, bindGroup, width, height);
    return output;
  }

  _threshold(encoder, srcA, srcB, width, height, pool) {
    const output = pool.getTemp(width, height, [srcA, srcB]);
    this.thresholdUniformData[0] = width;
    this.thresholdUniformData[1] = height;
    this.thresholdUniformData[2] = this.p;
    this.thresholdUniformData[3] = this.phi;
    this.thresholdUniformData[4] = this.epsilon;
    this.thresholdUniformData[5] = 0;
    this.thresholdUniformData[6] = 0;
    this.thresholdUniformData[7] = 0;
    this.threshold.write(this.thresholdUniformData);
    const bindGroup = this.threshold.bind([
      { binding: 0, resource: srcA.createView() },
      { binding: 1, resource: srcB.createView() },
      { binding: 2, resource: output.createView() },
      { binding: 3, resource: { buffer: this.threshold.uniformBuffer } },
    ]);
    this.threshold.dispatch(encoder, bindGroup, width, height);
    return output;
  }

  render(encoder, state, pool) {
    const { width, height } = state;
    const blurCState = this.blurC.render(encoder, state, pool);
    const tensor = this._tensor(encoder, blurCState.texture, width, height, pool);
    const direction = this._orientation(encoder, tensor, width, height, pool);
    const blurE1 = this._flow(encoder, blurCState.texture, direction, width, height, this.sigmaE, true, pool);
    const blurE2 = this._flow(encoder, blurCState.texture, direction, width, height, this.k * this.sigmaE, true, pool);
    const threshold = this._threshold(encoder, blurE1, blurE2, width, height, pool);
    const blurM = this._flow(encoder, threshold, direction, width, height, this.sigmaM, false, pool);
    const blurAState = this.blurA.render(encoder, { texture: blurM, width, height }, pool);

    pool.returnTemp(blurCState.texture, width, height);
    pool.returnTemp(tensor, width, height);
    pool.returnTemp(direction, width, height);
    pool.returnTemp(blurE1, width, height);
    pool.returnTemp(blurE2, width, height);
    pool.returnTemp(threshold, width, height);
    pool.returnTemp(blurM, width, height);

    return blurAState;
  }

  destroy() {
    this.blurC?.destroy();
    this.blurA?.destroy();
    this.tensor?.destroy();
    this.orientation?.destroy();
    this.flow?.destroy();
    this.threshold?.destroy();
  }
}
