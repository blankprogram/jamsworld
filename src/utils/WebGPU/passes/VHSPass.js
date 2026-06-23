import WebGPUSampledComputePass from "./SampledComputePass";

const VHS_SHADER = `
struct Params {
  width: f32,
  height: f32,
  time: f32,
  amount: f32,
  noise: f32,
  chromaSmear: f32,
  headSwitch: f32,
  pad0: f32,
};

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var srcSampler: sampler;
@group(0) @binding(2) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> params: Params;

fn hash11(pIn: f32) -> f32 {
  var p = fract(pIn * 0.1031);
  p = p * (p + 33.33);
  p = p * (p + p);
  return fract(p);
}

fn hash21(p: vec2<f32>) -> f32 {
  var p3 = fract(vec3<f32>(p.x, p.y, p.x) * 0.1031);
  p3 = p3 + dot(p3, p3.yzx + vec3<f32>(33.33, 33.33, 33.33));
  return fract((p3.x + p3.y) * p3.z);
}

fn rgb2yiq(c: vec3<f32>) -> vec3<f32> {
  return vec3<f32>(
    dot(c, vec3<f32>(0.299, 0.587, 0.114)),
    dot(c, vec3<f32>(0.596, -0.275, -0.321)),
    dot(c, vec3<f32>(0.212, -0.523, 0.311))
  );
}

fn yiq2rgb(y: vec3<f32>) -> vec3<f32> {
  return vec3<f32>(
    y.x + 0.956 * y.y + 0.621 * y.z,
    y.x - 0.272 * y.y - 0.647 * y.z,
    y.x - 1.106 * y.y + 1.703 * y.z
  );
}

fn texRGB(uv: vec2<f32>) -> vec3<f32> {
  return textureSampleLevel(srcTex, srcSampler, uv, 0.0).rgb;
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
  var uv = (pixel + vec2<f32>(0.5)) / vec2<f32>(params.width, params.height);
  let src = textureSampleLevel(srcTex, srcSampler, uv, 0.0);
  let a = src.a;
  if (a <= 0.001) {
    textureStore(dstTex, coord, src);
    return;
  }

  let timebase = 1.0;
  let chromaLoss = 1.0;
  let softness = 0.6;
  let dropouts = 0.3;
  let seed = 1.0;

  let yPix = floor(uv.y * params.height);
  let frame = floor(params.time * 60.0);
  let slowDrift = sin(params.time * 0.7 + seed) * 0.0015;
  let lineRnd = hash11(yPix + frame * 13.0 + seed * 101.0) - 0.5;
  let lineJit = lineRnd * 0.0035 * timebase;

  let block = floor(yPix / 24.0);
  var corr = hash11(block + frame * 3.0 + seed * 7.0) - 0.5;
  corr = corr * step(0.93, hash11(frame + block * 9.0 + seed * 2.0));
  corr = corr * 0.006 * timebase;

  let uvShift = (slowDrift + lineJit + corr) * params.amount;
  uv = clamp(
    vec2<f32>(uv.x + uvShift, uv.y),
    vec2<f32>(0.001, 0.001),
    vec2<f32>(0.999, 0.999)
  );

  let px = 1.0 / vec2<f32>(params.width, params.height);
  let c0 = texRGB(uv);
  let cL = texRGB(uv + vec2<f32>(-px.x, 0.0));
  let cR = texRGB(uv + vec2<f32>(px.x, 0.0));
  let soft = mix(c0, (cL + c0 + cR) / 3.0, clamp(softness * 0.6, 0.0, 1.0) * params.amount);
  let yiq = rgb2yiq(soft);

  let chromaRes = mix(params.width, 160.0, clamp(chromaLoss * 0.6 * params.amount, 0.0, 1.0));
  let uvCX = (floor(uv.x * chromaRes) + 0.5) / chromaRes;
  let uvC = vec2<f32>(uvCX, uv.y);

  let yiqC0 = rgb2yiq(texRGB(uvC));
  let smearPx = (1.0 + 6.0 * params.chromaSmear) * px.x * params.amount;
  let yiqC1 = rgb2yiq(texRGB(uvC + vec2<f32>(smearPx, 0.0)));
  let yiqC2 = rgb2yiq(texRGB(uvC - vec2<f32>(smearPx, 0.0)));
  let chroma = (yiqC0.yz + yiqC1.yz + yiqC2.yz) / 3.0;
  var outY = yiq.x;
  var outI = chroma.x;
  var outQ = chroma.y;

  let band = smoothstep(0.80, 0.96, uv.y) * params.headSwitch * params.amount;
  let tear = (hash11(frame + seed * 17.0) - 0.5) * 0.02 * band;
  let uvT = clamp(
    vec2<f32>(uv.x + tear, uv.y),
    vec2<f32>(0.001, 0.001),
    vec2<f32>(0.999, 0.999)
  );

  let n = hash21(vec2<f32>(yPix, frame) + vec2<f32>(seed, seed)) - 0.5;
  outY = outY + n * 0.18 * band;
  outI = outI + sin(uv.y * 900.0 + params.time * 40.0) * 0.02 * band;
  outQ = outQ + cos(uv.y * 700.0 - params.time * 35.0) * 0.02 * band;

  let doChance = dropouts * 0.015 * params.amount;
  let doLine = step(1.0 - doChance, hash11(yPix + frame * 19.0 + seed * 5.0));
  let doSeed = seed * 3.0;
  let doLen = step(0.7, hash21(vec2<f32>(frame, yPix) + vec2<f32>(doSeed, doSeed)));
  let doMask = doLine * doLen;
  outY = mix(outY, outY * 0.2 + 0.8, doMask);

  let luma = outY;
  let noiseSeed = frame + seed;
  let vidNoise = hash21(vec2<f32>(uv.x * params.width, yPix) + vec2<f32>(noiseSeed, noiseSeed)) - 0.5;
  outY = outY + vidNoise * (0.06 + 0.10 * (1.0 - luma)) * params.noise * params.amount;

  let outYIQ = vec3<f32>(outY, outI, outQ);
  var rgb = yiq2rgb(outYIQ);
  let tearY = rgb2yiq(texRGB(uvT)).x;
  let rgbT = yiq2rgb(vec3<f32>(tearY, outI, outQ));
  rgb = mix(rgb, rgbT, band * 0.25);

  textureStore(dstTex, coord, vec4<f32>(clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0)), a));
}
`;

export default class WebGPUVHSPass extends WebGPUSampledComputePass {
  static type = "VHS";

  constructor(device, opts = {}) {
    super(device, VHS_SHADER, opts);
    this._t = 0;
    this.amount = opts.amount ?? 0.65;
    this.noise = opts.noise ?? 0.35;
    this.chromaSmear = opts.chromaSmear ?? 1.2;
    this.headSwitch = opts.headSwitch ?? 1;
  }

  setOption(name, value) {
    const v = +value;
    if (name === "amount") this.amount = v;
    else if (name === "noise") this.noise = v;
    else if (name === "chromaSmear") this.chromaSmear = v;
    else if (name === "headSwitch") this.headSwitch = v;
  }

  getUniformData(width, height) {
    this._t += 1 / 60;
    this.uniformData[0] = width;
    this.uniformData[1] = height;
    this.uniformData[2] = this._t;
    this.uniformData[3] = this.amount;
    this.uniformData[4] = this.noise;
    this.uniformData[5] = this.chromaSmear;
    this.uniformData[6] = this.headSwitch;
    this.uniformData[7] = 0;
    return this.uniformData;
  }
}
