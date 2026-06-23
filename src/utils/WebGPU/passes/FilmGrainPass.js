import WebGPUSampledComputePass from "./SampledComputePass";

const FILM_GRAIN_SHADER = `
struct Params {
  width: f32,
  height: f32,
  texelX: f32,
  texelY: f32,
  intensity: f32,
  time: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var srcSampler: sampler;
@group(0) @binding(2) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> params: Params;

fn rand(co: vec2<f32>) -> f32 {
  return fract(sin(dot(co + vec2<f32>(params.time), vec2<f32>(12.9898, 78.233))) * 43758.5453);
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
  let grain = (rand(vec2<f32>(gid.xy)) - 0.5) * params.intensity;
  textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(clamp(color.rgb + vec3<f32>(grain), vec3<f32>(0.0), vec3<f32>(1.0)), color.a));
}
`;

export default class WebGPUFilmGrainPass extends WebGPUSampledComputePass {
  static type = "FILMGRAIN";

  constructor(device, opts = {}) {
    super(device, FILM_GRAIN_SHADER, opts);
    this.intensity = opts.intensity ?? 0.05;
    this.speed = opts.speed ?? 1;
  }

  setOption(name, value) {
    if (name === "intensity") this.intensity = Math.max(0, Math.min(1, parseFloat(value) || 0));
    if (name === "speed") this.speed = Math.max(0, parseFloat(value) || 1);
  }

  getUniformData(width, height) {
    const time =
      typeof performance !== "undefined" ? performance.now() * 0.001 * this.speed : 0;
    this.uniformData[0] = width;
    this.uniformData[1] = height;
    this.uniformData[2] = 1 / Math.max(1, width);
    this.uniformData[3] = 1 / Math.max(1, height);
    this.uniformData[4] = this.intensity;
    this.uniformData[5] = time;
    this.uniformData[6] = 0;
    this.uniformData[7] = 0;
    return this.uniformData;
  }
}
