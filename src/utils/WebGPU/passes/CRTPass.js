import WebGPUSampledComputePass from "./SampledComputePass";

const CRT_SHADER = `
struct Params {
  width: f32,
  height: f32,
  texelX: f32,
  texelY: f32,
  scanlines: f32,
  mask: f32,
  warp: f32,
  vignette: f32,
  glow: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var srcSampler: sampler;
@group(0) @binding(2) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> params: Params;

fn warpUV(uv: vec2<f32>, amt: f32) -> vec2<f32> {
  var cc = uv * 2.0 - vec2<f32>(1.0);
  let r2 = dot(cc, cc);
  cc = cc * (1.0 + amt * 0.12 * r2);
  return cc * 0.5 + vec2<f32>(0.5);
}

fn sampleRGB(uv: vec2<f32>) -> vec3<f32> {
  return textureSampleLevel(srcTex, srcSampler, uv, 0.0).rgb;
}

fn glowApprox(uv: vec2<f32>, px: vec2<f32>, amt: f32) -> vec3<f32> {
  let c = sampleRGB(uv);
  let l = dot(c, vec3<f32>(0.299, 0.587, 0.114));
  let m = smoothstep(0.55, 1.0, l) * amt;
  let a = sampleRGB(clamp(uv + vec2<f32>(px.x, 0.0), vec2<f32>(0.0), vec2<f32>(1.0)));
  let b = sampleRGB(clamp(uv - vec2<f32>(px.x, 0.0), vec2<f32>(0.0), vec2<f32>(1.0)));
  let d = sampleRGB(clamp(uv + vec2<f32>(0.0, px.y), vec2<f32>(0.0), vec2<f32>(1.0)));
  let e = sampleRGB(clamp(uv - vec2<f32>(0.0, px.y), vec2<f32>(0.0), vec2<f32>(1.0)));
  let blur = (a + b + d + e + c) / 5.0;
  return c + (blur - c) * m;
}

fn phosphorMask(uv: vec2<f32>, strength: f32) -> vec3<f32> {
  let x = floor(uv.x * params.width);
  let tri = x - floor(x / 3.0) * 3.0;
  var maskColor = vec3<f32>(0.55, 0.55, 1.0);
  if (tri < 1.0) {
    maskColor = vec3<f32>(1.0, 0.55, 0.55);
  } else if (tri < 2.0) {
    maskColor = vec3<f32>(0.55, 1.0, 0.55);
  }
  return mix(vec3<f32>(1.0), maskColor, clamp(strength, 0.0, 1.0));
}

fn scanBeam(uv: vec2<f32>, strength: f32) -> f32 {
  let y = uv.y * params.height;
  let fy = fract(y) - 0.5;
  let beam = exp(-fy * fy * 18.0);
  return mix(1.0, beam, clamp(strength, 0.0, 1.0));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let coord = vec2<i32>(i32(gid.x), i32(gid.y));
  let pixel = vec2<f32>(f32(gid.x), f32(gid.y));
  let baseUV = (pixel + vec2<f32>(0.5)) / vec2<f32>(params.width, params.height);
  let src0 = textureSampleLevel(srcTex, srcSampler, baseUV, 0.0);
  if (src0.a <= 0.001) {
    textureStore(dstTex, coord, src0);
    return;
  }

  let px = vec2<f32>(params.texelX, params.texelY);
  var uv = warpUV(baseUV, params.warp);
  let crop = 0.015 * params.warp;
  uv = (uv - vec2<f32>(0.5)) * (1.0 + crop * 2.0) + vec2<f32>(0.5);

  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    textureStore(dstTex, coord, vec4<f32>(0.0));
    return;
  }

  let src = textureSampleLevel(srcTex, srcSampler, uv, 0.0);
  let a = src.a;
  if (a <= 0.001) {
    textureStore(dstTex, coord, src);
    return;
  }

  var col = glowApprox(uv, px * (1.0 + 1.5 * params.glow), params.glow);
  col = col * scanBeam(uv, 0.75 * params.scanlines);
  col = col * phosphorMask(uv, 0.85 * params.mask);

  let cc = uv * 2.0 - vec2<f32>(1.0);
  let v = smoothstep(1.15, 0.25, dot(cc, cc));
  col = col * mix(1.0, v, clamp(params.vignette, 0.0, 1.0));
  col = pow(max(col, vec3<f32>(0.0)), vec3<f32>(0.95));

  textureStore(dstTex, coord, vec4<f32>(clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)), a));
}
`;

export default class WebGPUCRTPass extends WebGPUSampledComputePass {
  static type = "CRT";

  constructor(device, opts = {}) {
    super(device, CRT_SHADER, opts);
    this.scanlines = opts.scanlines ?? 1;
    this.mask = opts.mask ?? 0.9;
    this.warp = opts.warp ?? 0.6;
    this.vignette = opts.vignette ?? 0.7;
    this.glow = opts.glow ?? 0.35;
  }

  setOption(name, value) {
    const v = +value;
    if (name === "scanlines") this.scanlines = v;
    else if (name === "mask") this.mask = v;
    else if (name === "warp") this.warp = v;
    else if (name === "vignette") this.vignette = v;
    else if (name === "glow") this.glow = v;
  }

  getUniformData(width, height) {
    this.uniformData[0] = width;
    this.uniformData[1] = height;
    this.uniformData[2] = 1 / Math.max(1, width);
    this.uniformData[3] = 1 / Math.max(1, height);
    this.uniformData[4] = this.scanlines;
    this.uniformData[5] = this.mask;
    this.uniformData[6] = this.warp;
    this.uniformData[7] = this.vignette;
    this.uniformData[8] = this.glow;
    this.uniformData[9] = 0;
    this.uniformData[10] = 0;
    this.uniformData[11] = 0;
    return this.uniformData;
  }
}
