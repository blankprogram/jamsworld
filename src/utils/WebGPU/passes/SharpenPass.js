import WebGPUSampledComputePass from "./SampledComputePass";

const SHARPEN_SHADER = `
struct Params {
  width: f32,
  height: f32,
  texelX: f32,
  texelY: f32,
  amount: f32,
  radius: f32,
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
  let texel = vec2<f32>(params.texelX, params.texelY);
  let src = sampleAt(uv);
  let r = i32(params.radius);
  let d = 2 * r + 1;
  var sum = vec3<f32>(0.0);

  for (var y = -r; y <= r; y = y + 1) {
    for (var x = -r; x <= r; x = x + 1) {
      sum = sum + sampleAt(uv + vec2<f32>(f32(x), f32(y)) * texel).rgb;
    }
  }

  let blurred = sum / f32(d * d);
  let mask = src.rgb - blurred;
  let result = src.rgb + params.amount * mask;
  textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(clamp(result, vec3<f32>(0.0), vec3<f32>(1.0)), src.a));
}
`;

export default class WebGPUSharpenPass extends WebGPUSampledComputePass {
  static type = "SHARPEN";

  constructor(device, opts = {}) {
    super(device, SHARPEN_SHADER, opts);
    this.amount = opts.amount ?? 1;
    this.radius = opts.radius ?? 1;
  }

  setOption(name, value) {
    if (name === "amount") this.amount = Math.max(0, parseFloat(value) || 0);
    else if (name === "radius") this.radius = Math.max(1, parseFloat(value) || 1);
  }

  getUniformData(width, height) {
    this.uniformData[0] = width;
    this.uniformData[1] = height;
    this.uniformData[2] = 1 / Math.max(1, width);
    this.uniformData[3] = 1 / Math.max(1, height);
    this.uniformData[4] = this.amount;
    this.uniformData[5] = this.radius;
    this.uniformData[6] = 0;
    this.uniformData[7] = 0;
    return this.uniformData;
  }
}
