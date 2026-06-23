import WebGPUSampledComputePass from "./SampledComputePass";

const CHROMA_SHADER = `
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

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let uv = (vec2<f32>(gid.xy) + vec2<f32>(0.5)) / vec2<f32>(params.width, params.height);
  let dir = uv - vec2<f32>(0.5);
  let off = dir * params.strength * vec2<f32>(params.texelX, params.texelY);
  let r = textureSampleLevel(srcTex, srcSampler, uv + off, 0.0).r;
  let g = textureSampleLevel(srcTex, srcSampler, uv, 0.0).g;
  let b = textureSampleLevel(srcTex, srcSampler, uv - off, 0.0).b;
  let a = textureSampleLevel(srcTex, srcSampler, uv, 0.0).a;
  textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(r, g, b, a));
}
`;

export default class WebGPUChromaticAberrationPass extends WebGPUSampledComputePass {
  static type = "CHROMA";

  constructor(device, opts = {}) {
    super(device, CHROMA_SHADER, opts);
    this.strength = opts.strength ?? 10;
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
