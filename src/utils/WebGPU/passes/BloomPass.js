import WebGPUSampledComputePass from "./SampledComputePass";

const BLOOM_SHADER = `
struct Params {
  width: f32,
  height: f32,
  texelX: f32,
  texelY: f32,
  strength: f32,
  threshold: f32,
  radius: f32,
  pad1: f32,
};

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var srcSampler: sampler;
@group(0) @binding(2) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> params: Params;

fn lum(c: vec3<f32>) -> f32 {
  return dot(c, vec3<f32>(0.299, 0.587, 0.114));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let uv = (vec2<f32>(gid.xy) + vec2<f32>(0.5)) / vec2<f32>(params.width, params.height);
  let color = textureSampleLevel(srcTex, srcSampler, uv, 0.0);
  if (lum(color.rgb) < params.threshold) {
    textureStore(dstTex, vec2<i32>(gid.xy), color);
    return;
  }

  let radius = i32(params.radius);
  let texel = vec2<f32>(params.texelX, params.texelY);
  var bloom = vec3<f32>(0.0);
  var count = 0.0;

  for (var y = -radius; y <= radius; y = y + 1) {
    for (var x = -radius; x <= radius; x = x + 1) {
      bloom = bloom + textureSampleLevel(srcTex, srcSampler, uv + vec2<f32>(f32(x), f32(y)) * texel, 0.0).rgb;
      count = count + 1.0;
    }
  }

  let result = color.rgb + (bloom / count) * params.strength;
  textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(result, color.a));
}
`;

export default class WebGPUBloomPass extends WebGPUSampledComputePass {
  static type = "BLOOM";

  constructor(device, opts = {}) {
    super(device, BLOOM_SHADER, opts);
    this.strength = opts.strength ?? 1;
    this.threshold = opts.threshold ?? 0.8;
    this.radius = opts.radius ?? 5;
  }

  setOption(name, value) {
    if (name === "strength") this.strength = Math.max(0, parseFloat(value) || 0);
    if (name === "threshold") this.threshold = Math.min(1, Math.max(0, parseFloat(value) || 0));
    if (name === "radius") this.radius = Math.min(10, Math.max(1, parseInt(value, 10) || 1));
  }

  getUniformData(width, height) {
    this.uniformData[0] = width;
    this.uniformData[1] = height;
    this.uniformData[2] = 1 / Math.max(1, width);
    this.uniformData[3] = 1 / Math.max(1, height);
    this.uniformData[4] = this.strength;
    this.uniformData[5] = this.threshold;
    this.uniformData[6] = this.radius;
    this.uniformData[7] = 0;
    return this.uniformData;
  }
}
