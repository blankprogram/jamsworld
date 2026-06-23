import WebGPUSampledComputePass from "./SampledComputePass";

const SOBEL_SHADER = `
struct Params {
  width: f32,
  height: f32,
  texelX: f32,
  texelY: f32,
  value0: f32,
  value1: f32,
  pad0: f32,
  pad1: f32,
};

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var srcSampler: sampler;
@group(0) @binding(2) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> params: Params;

fn sampleR(uv: vec2<f32>) -> f32 {
  return textureSampleLevel(srcTex, srcSampler, uv, 0.0).r;
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
  var gx = 0.0;
  var gy = 0.0;

  gx = gx - sampleR(uv + vec2<f32>(-t.x, -t.y));
  gx = gx - 2.0 * sampleR(uv + vec2<f32>(-t.x, 0.0));
  gx = gx - sampleR(uv + vec2<f32>(-t.x, t.y));
  gx = gx + sampleR(uv + vec2<f32>(t.x, -t.y));
  gx = gx + 2.0 * sampleR(uv + vec2<f32>(t.x, 0.0));
  gx = gx + sampleR(uv + vec2<f32>(t.x, t.y));

  gy = gy - sampleR(uv + vec2<f32>(-t.x, -t.y));
  gy = gy - 2.0 * sampleR(uv + vec2<f32>(0.0, -t.y));
  gy = gy - sampleR(uv + vec2<f32>(t.x, -t.y));
  gy = gy + sampleR(uv + vec2<f32>(-t.x, t.y));
  gy = gy + 2.0 * sampleR(uv + vec2<f32>(0.0, t.y));
  gy = gy + sampleR(uv + vec2<f32>(t.x, t.y));

  let g = length(vec2<f32>(gx, gy));
  textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(vec3<f32>(g), 1.0));
}
`;

export default class WebGPUSobelPass extends WebGPUSampledComputePass {
  static type = "SOBEL";

  constructor(device, opts = {}) {
    super(device, SOBEL_SHADER, opts);
  }
}
