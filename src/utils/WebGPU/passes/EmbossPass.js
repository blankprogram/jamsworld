import WebGPUSampledComputePass from "./SampledComputePass";

const EMBOSS_SHADER = `
struct Params {
  width: f32,
  height: f32,
  texelX: f32,
  texelY: f32,
  strength: f32,
  value1: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var srcSampler: sampler;
@group(0) @binding(2) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> params: Params;

fn sampleAt(uv: vec2<f32>) -> vec4<f32> {
  return textureSampleLevel(srcTex, srcSampler, uv, 0.0);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let uv = (vec2<f32>(gid.xy) + vec2<f32>(0.5)) / vec2<f32>(params.width, params.height);
  let t = vec2<f32>(params.texelX, params.texelY);
  let center = sampleAt(uv);
  if (center.a <= 0.0001) {
    textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(0.0));
    return;
  }

  let t00 = sampleAt(uv + vec2<f32>(-1.0, -1.0) * t);
  let t10 = sampleAt(uv + vec2<f32>(0.0, -1.0) * t);
  let t20 = sampleAt(uv + vec2<f32>(1.0, -1.0) * t);
  let t01 = sampleAt(uv + vec2<f32>(-1.0, 0.0) * t);
  let t11 = center;
  let t21 = sampleAt(uv + vec2<f32>(1.0, 0.0) * t);
  let t02 = sampleAt(uv + vec2<f32>(-1.0, 1.0) * t);
  let t12 = sampleAt(uv + vec2<f32>(0.0, 1.0) * t);
  let t22 = sampleAt(uv + vec2<f32>(1.0, 1.0) * t);

  let sum =
    t00.rgb * -2.0 +
    t10.rgb * -1.0 +
    t20.rgb * 0.0 +
    t01.rgb * -1.0 +
    t11.rgb * 1.0 +
    t21.rgb * 1.0 +
    t02.rgb * 0.0 +
    t12.rgb * 1.0 +
    t22.rgb * 2.0;

  let embossed = vec3<f32>(0.5) + (sum * (params.strength / 8.0));
  textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(clamp(embossed, vec3<f32>(0.0), vec3<f32>(1.0)), center.a));
}
`;

export default class WebGPUEmbossPass extends WebGPUSampledComputePass {
  static type = "EMBOSS";

  constructor(device, opts = {}) {
    super(device, EMBOSS_SHADER, opts);
    this.strength = opts.strength ?? 1;
  }

  setOption(name, value) {
    if (name === "strength") {
      this.strength = Math.max(0, parseFloat(value) || 0);
    }
  }

  getUniformData(width, height) {
    this.uniformData[0] = width;
    this.uniformData[1] = height;
    this.uniformData[2] = 1 / Math.max(1, width);
    this.uniformData[3] = 1 / Math.max(1, height);
    this.uniformData[4] = this.strength;
    this.uniformData[5] = 0;
    this.uniformData[6] = 0;
    this.uniformData[7] = 0;
    return this.uniformData;
  }
}
