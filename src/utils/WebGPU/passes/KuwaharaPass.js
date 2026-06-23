import { GPU_BUFFER_USAGE, GPU_TEXTURE_USAGE } from "../constants";
import { dispatchCompute } from "./shared";

const SHADER_STAGE_COMPUTE = 4;
const INTERNAL_FORMAT = "rgba32float";

const PARAMS = `
struct Params {
  width: f32,
  height: f32,
  radius: f32,
  hardness: f32,
  q: f32,
  anisotropy: f32,
  zeroCrossing: f32,
  zeta: f32,
  blend: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};
`;

const TENSOR_SHADER = `
${PARAMS}

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var tensorTex: texture_storage_2d<rgba32float, write>;
@group(0) @binding(2) var<uniform> params: Params;

fn samplePixel(coord: vec2<i32>) -> vec3<f32> {
  let maxCoord = vec2<i32>(i32(params.width) - 1, i32(params.height) - 1);
  return textureLoad(srcTex, clamp(coord, vec2<i32>(0, 0), maxCoord), 0).rgb;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let coord = vec2<i32>(gid.xy);

  let sx =
    samplePixel(coord + vec2<i32>(-1, -1)) +
    2.0 * samplePixel(coord + vec2<i32>(-1, 0)) +
    samplePixel(coord + vec2<i32>(-1, 1)) -
    samplePixel(coord + vec2<i32>(1, -1)) -
    2.0 * samplePixel(coord + vec2<i32>(1, 0)) -
    samplePixel(coord + vec2<i32>(1, 1));

  let sy =
    samplePixel(coord + vec2<i32>(-1, -1)) +
    2.0 * samplePixel(coord + vec2<i32>(0, -1)) +
    samplePixel(coord + vec2<i32>(1, -1)) -
    samplePixel(coord + vec2<i32>(-1, 1)) -
    2.0 * samplePixel(coord + vec2<i32>(0, 1)) -
    samplePixel(coord + vec2<i32>(1, 1));

  let gx = sx * 0.25;
  let gy = sy * 0.25;
  textureStore(
    tensorTex,
    coord,
    vec4<f32>(dot(gx, gx), dot(gy, gy), dot(gx, gy), 1.0)
  );
}
`;

const BLUR_X_SHADER = `
${PARAMS}

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var dstTex: texture_storage_2d<rgba32float, write>;
@group(0) @binding(2) var<uniform> params: Params;

fn gaussian(pos: f32) -> f32 {
  return exp(-(pos * pos) * 0.125);
}

fn sampleTensor(coord: vec2<i32>) -> vec4<f32> {
  let maxCoord = vec2<i32>(i32(params.width) - 1, i32(params.height) - 1);
  return textureLoad(srcTex, clamp(coord, vec2<i32>(0, 0), maxCoord), 0);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let coord = vec2<i32>(gid.xy);
  var sum = vec4<f32>(0.0);
  var weightSum = 0.0;
  for (var x = -5; x <= 5; x = x + 1) {
    let w = gaussian(f32(x));
    sum = sum + sampleTensor(coord + vec2<i32>(x, 0)) * w;
    weightSum = weightSum + w;
  }

  textureStore(dstTex, coord, sum / weightSum);
}
`;

const TFM_SHADER = `
${PARAMS}

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var tfmTex: texture_storage_2d<rgba32float, write>;
@group(0) @binding(2) var<uniform> params: Params;

fn gaussian(pos: f32) -> f32 {
  return exp(-(pos * pos) * 0.125);
}

fn sampleTensor(coord: vec2<i32>) -> vec4<f32> {
  let maxCoord = vec2<i32>(i32(params.width) - 1, i32(params.height) - 1);
  return textureLoad(srcTex, clamp(coord, vec2<i32>(0, 0), maxCoord), 0);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let coord = vec2<i32>(gid.xy);
  var sum = vec4<f32>(0.0);
  var weightSum = 0.0;
  for (var y = -5; y <= 5; y = y + 1) {
    let w = gaussian(f32(y));
    sum = sum + sampleTensor(coord + vec2<i32>(0, y)) * w;
    weightSum = weightSum + w;
  }

  let g = (sum / weightSum).xyz;
  let root = sqrt(max(0.0, g.y * g.y - 2.0 * g.x * g.y + g.x * g.x + 4.0 * g.z * g.z));
  let lambda1 = 0.5 * (g.y + g.x + root);
  let lambda2 = 0.5 * (g.y + g.x - root);
  let v = vec2<f32>(lambda1 - g.x, -g.z);

  var tangent = vec2<f32>(0.0, 1.0);
  if (dot(v, v) > 0.000001) {
    tangent = normalize(v);
  }

  let phi = -atan2(tangent.y, tangent.x);
  var anisotropy = 0.0;
  if (lambda1 + lambda2 > 0.0) {
    anisotropy = (lambda1 - lambda2) / (lambda1 + lambda2);
  }

  textureStore(tfmTex, coord, vec4<f32>(tangent, phi, clamp(anisotropy, 0.0, 1.0)));
}
`;

const APPLY_SHADER = `
${PARAMS}

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var tfmTex: texture_2d<f32>;
@group(0) @binding(2) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(3) var<uniform> params: Params;

fn sampleSource(coord: vec2<i32>) -> vec4<f32> {
  let maxCoord = vec2<i32>(i32(params.width) - 1, i32(params.height) - 1);
  return textureLoad(srcTex, clamp(coord, vec2<i32>(0, 0), maxCoord), 0);
}

fn sampleTfm(coord: vec2<i32>) -> vec4<f32> {
  let maxCoord = vec2<i32>(i32(params.width) - 1, i32(params.height) - 1);
  return textureLoad(tfmTex, clamp(coord, vec2<i32>(0, 0), maxCoord), 0);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let coord = vec2<i32>(gid.xy);
  let source = sampleSource(coord);
  let tfm = sampleTfm(coord);
  let kernelRadius = max(1.0, params.radius);
  let response = tfm.w * clamp(params.anisotropy, 0.0, 1.0) * 1.5;
  let a = kernelRadius * clamp(1.0 + response, 0.1, 2.0);
  let b = kernelRadius * clamp(1.0 / (1.0 + response), 0.1, 2.0);

  let cosPhi = cos(tfm.z);
  let sinPhi = sin(tfm.z);
  let maxX = i32(ceil(sqrt(a * a * cosPhi * cosPhi + b * b * sinPhi * sinPhi)));
  let maxY = i32(ceil(sqrt(a * a * sinPhi * sinPhi + b * b * cosPhi * cosPhi)));

  let sx = 0.5 / a;
  let sy = 0.5 / b;
  let zeta = params.zeta;
  let zeroCross = params.zeroCrossing;
  let sinZeroCross = max(0.0001, sin(zeroCross));
  let eta = (zeta + cos(zeroCross)) / (sinZeroCross * sinZeroCross);

  var m: array<vec4<f32>, 8>;
  var s: array<vec3<f32>, 8>;
  for (var k = 0u; k < 8u; k = k + 1u) {
    m[k] = vec4<f32>(0.0);
    s[k] = vec3<f32>(0.0);
  }

  for (var y = -maxY; y <= maxY; y = y + 1) {
    for (var x = -maxX; x <= maxX; x = x + 1) {
      let p = vec2<f32>(f32(x), f32(y));
      var v = vec2<f32>(
        sx * (cosPhi * p.x - sinPhi * p.y),
        sy * (sinPhi * p.x + cosPhi * p.y)
      );

      if (dot(v, v) <= 0.25) {
        let c = clamp(sampleSource(coord + vec2<i32>(x, y)).rgb, vec3<f32>(0.0), vec3<f32>(1.0));
        var w: array<f32, 8>;
        var weightSum = 0.0;

        var vxx = zeta - eta * v.x * v.x;
        var vyy = zeta - eta * v.y * v.y;
        var z = max(0.0, v.y + vxx);
        w[0] = z * z;
        weightSum = weightSum + w[0];
        z = max(0.0, -v.x + vyy);
        w[2] = z * z;
        weightSum = weightSum + w[2];
        z = max(0.0, -v.y + vxx);
        w[4] = z * z;
        weightSum = weightSum + w[4];
        z = max(0.0, v.x + vyy);
        w[6] = z * z;
        weightSum = weightSum + w[6];

        v = vec2<f32>(0.70710678118 * (v.x - v.y), 0.70710678118 * (v.x + v.y));
        vxx = zeta - eta * v.x * v.x;
        vyy = zeta - eta * v.y * v.y;
        z = max(0.0, v.y + vxx);
        w[1] = z * z;
        weightSum = weightSum + w[1];
        z = max(0.0, -v.x + vyy);
        w[3] = z * z;
        weightSum = weightSum + w[3];
        z = max(0.0, -v.y + vxx);
        w[5] = z * z;
        weightSum = weightSum + w[5];
        z = max(0.0, v.x + vyy);
        w[7] = z * z;
        weightSum = weightSum + w[7];

        if (weightSum > 0.0) {
          let g = exp(-3.125 * dot(v, v)) / weightSum;
          for (var k = 0u; k < 8u; k = k + 1u) {
            let wk = w[k] * g;
            m[k] = m[k] + vec4<f32>(c * wk, wk);
            s[k] = s[k] + c * c * wk;
          }
        }
      }
    }
  }

  var output = vec4<f32>(0.0);
  for (var k = 0u; k < 8u; k = k + 1u) {
    if (m[k].w > 0.0) {
      let mean = m[k].rgb / m[k].w;
      let variance = abs(s[k] / m[k].w - mean * mean);
      let sigma2 = variance.r + variance.g + variance.b;
      let weight = 1.0 / (1.0 + pow(max(0.0, params.hardness * 2500.0 * sigma2), 0.5 * params.q));
      output = output + vec4<f32>(mean * weight, weight);
    }
  }

  var filtered = source.rgb;
  if (output.w > 0.0) {
    filtered = clamp(output.rgb / output.w, vec3<f32>(0.0), vec3<f32>(1.0));
  }

  let color = mix(source.rgb, filtered, clamp(params.blend, 0.0, 1.0));
  textureStore(dstTex, coord, vec4<f32>(color, source.a));
}
`;

const BRUSHY_SHADER = `
${PARAMS}

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;

fn luminance(c: vec3<f32>) -> f32 {
  return dot(c, vec3<f32>(0.299, 0.587, 0.114));
}

fn samplePixel(coord: vec2<i32>) -> vec4<f32> {
  let maxCoord = vec2<i32>(i32(params.width) - 1, i32(params.height) - 1);
  return textureLoad(srcTex, clamp(coord, vec2<i32>(0, 0), maxCoord), 0);
}

fn gradientAt(coord: vec2<i32>) -> vec2<f32> {
  let tl = luminance(samplePixel(coord + vec2<i32>(-1, -1)).rgb);
  let tc = luminance(samplePixel(coord + vec2<i32>(0, -1)).rgb);
  let tr = luminance(samplePixel(coord + vec2<i32>(1, -1)).rgb);
  let ml = luminance(samplePixel(coord + vec2<i32>(-1, 0)).rgb);
  let mr = luminance(samplePixel(coord + vec2<i32>(1, 0)).rgb);
  let bl = luminance(samplePixel(coord + vec2<i32>(-1, 1)).rgb);
  let bc = luminance(samplePixel(coord + vec2<i32>(0, 1)).rgb);
  let br = luminance(samplePixel(coord + vec2<i32>(1, 1)).rgb);

  let gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  let gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
  return vec2<f32>(gx, gy);
}

fn sectorIndex(local: vec2<f32>) -> u32 {
  let angle = atan2(local.y, local.x) + 3.14159265359;
  return min(7u, u32(floor(angle * 1.27323954474)));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let coord = vec2<i32>(gid.xy);
  let source = samplePixel(coord);
  let radius = max(1, i32(round(params.radius)));

  let grad = gradientAt(coord);
  var tangent = vec2<f32>(1.0, 0.0);
  if (dot(grad, grad) > 0.000001) {
    let normal = normalize(grad);
    tangent = vec2<f32>(-normal.y, normal.x);
  }
  let normal = vec2<f32>(-tangent.y, tangent.x);

  let brushiness = clamp(params.zeta, 0.0, 1.0);
  let radiusF = f32(radius);
  let anisotropy = clamp(params.anisotropy + brushiness * 0.35, 0.0, 1.0);
  let major = radiusF * (1.0 + anisotropy);
  let minor = max(1.0, radiusF * (1.0 - 0.85 * anisotropy));
  let invMajor2 = 1.0 / (major * major);
  let invMinor2 = 1.0 / (minor * minor);

  var sums: array<vec3<f32>, 8>;
  var sumsSq: array<vec3<f32>, 8>;
  var counts: array<f32, 8>;
  for (var i = 0u; i < 8u; i = i + 1u) {
    sums[i] = vec3<f32>(0.0);
    sumsSq[i] = vec3<f32>(0.0);
    counts[i] = 0.0;
  }

  let maxX = i32(ceil(abs(major * tangent.x) + abs(minor * normal.x)));
  let maxY = i32(ceil(abs(major * tangent.y) + abs(minor * normal.y)));
  for (var y = -maxY; y <= maxY; y = y + 1) {
    for (var x = -maxX; x <= maxX; x = x + 1) {
      let offset = vec2<f32>(f32(x), f32(y));
      let local = vec2<f32>(dot(offset, tangent), dot(offset, normal));
      let ellipse = local.x * local.x * invMajor2 + local.y * local.y * invMinor2;
      if (ellipse <= 1.0) {
        var color = source.rgb;
        if (x != 0 || y != 0) {
          color = samplePixel(coord + vec2<i32>(x, y)).rgb;
        }
        let idx = sectorIndex(local);
        sums[idx] = sums[idx] + color;
        sumsSq[idx] = sumsSq[idx] + color * color;
        counts[idx] = counts[idx] + 1.0;
      }
    }
  }

  var bestColor = source.rgb;
  var bestVariance = 1000000.0;
  var weightedColor = vec3<f32>(0.0);
  var totalWeight = 0.0;
  let hardness = max(0.001, params.hardness) * (1.0 + brushiness * 4.0);

  for (var i = 0u; i < 8u; i = i + 1u) {
    if (counts[i] > 0.0) {
      let mean = sums[i] / counts[i];
      let meanSq = sumsSq[i] / counts[i];
      let variance = max(0.0, dot(meanSq - mean * mean, vec3<f32>(0.3333333)));
      if (variance < bestVariance) {
        bestVariance = variance;
        bestColor = mean;
      }
      let weightedVariance = variance * hardness * 255.0;
      let weight = 1.0 / (1.0 + weightedVariance * weightedVariance);
      weightedColor = weightedColor + mean * weight;
      totalWeight = totalWeight + weight;
    }
  }

  var filtered = bestColor;
  if (totalWeight > 0.0) {
    let soft = weightedColor / totalWeight;
    filtered = mix(soft, bestColor, brushiness);
  }

  let color = mix(source.rgb, filtered, clamp(params.blend, 0.0, 1.0));
  textureStore(dstTex, coord, vec4<f32>(color, source.a));
}
`;

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function createPipeline(device, label, shader, bindGroupLayouts) {
  const module = device.createShaderModule({
    label: `${label} shader`,
    code: shader,
  });
  return device.createComputePipeline({
    label: `${label} pipeline`,
    layout: device.createPipelineLayout({ bindGroupLayouts }),
    compute: { module, entryPoint: "main" },
  });
}

export default class WebGPUKuwaharaPass {
  static type = "KUWAHARA";

  constructor(device, opts = {}) {
    this.device = device;
    this.radius = clampNumber(opts.radius ?? 10, 1, 16);
    this.hardness = clampNumber(opts.sharpness ?? 8, 0.1, 30);
    this.q = 10;
    this.anisotropy = clampNumber(opts.anisotropy ?? 0.65, 0, 1);
    this.zeroCrossing = 0.58;
    this.zeta = 2;
    this.style = opts.style || "Brushy";
    this.brushiness = clampNumber(opts.brushiness ?? 0.65, 0, 1);
    this.blend = clampNumber(opts.blend ?? 1, 0, 1);

    this.internalTextures = [];
    this.internalViews = [];
    this.internalSizeKey = "";

    this.uniformBuffer = device.createBuffer({
      size: 48,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
    });
    this.uniformData = new Float32Array(12);

    this.tensorLayout = device.createBindGroupLayout({
      label: "Kuwahara tensor bind group layout",
      entries: [
        {
          binding: 0,
          visibility: SHADER_STAGE_COMPUTE,
          texture: { sampleType: "float" },
        },
        {
          binding: 1,
          visibility: SHADER_STAGE_COMPUTE,
          storageTexture: { access: "write-only", format: INTERNAL_FORMAT },
        },
        {
          binding: 2,
          visibility: SHADER_STAGE_COMPUTE,
          buffer: { type: "uniform" },
        },
      ],
    });

    this.internalLayout = device.createBindGroupLayout({
      label: "Kuwahara internal bind group layout",
      entries: [
        {
          binding: 0,
          visibility: SHADER_STAGE_COMPUTE,
          texture: { sampleType: "unfilterable-float" },
        },
        {
          binding: 1,
          visibility: SHADER_STAGE_COMPUTE,
          storageTexture: { access: "write-only", format: INTERNAL_FORMAT },
        },
        {
          binding: 2,
          visibility: SHADER_STAGE_COMPUTE,
          buffer: { type: "uniform" },
        },
      ],
    });

    this.applyLayout = device.createBindGroupLayout({
      label: "Kuwahara apply bind group layout",
      entries: [
        {
          binding: 0,
          visibility: SHADER_STAGE_COMPUTE,
          texture: { sampleType: "float" },
        },
        {
          binding: 1,
          visibility: SHADER_STAGE_COMPUTE,
          texture: { sampleType: "unfilterable-float" },
        },
        {
          binding: 2,
          visibility: SHADER_STAGE_COMPUTE,
          storageTexture: { access: "write-only", format: "rgba8unorm" },
        },
        {
          binding: 3,
          visibility: SHADER_STAGE_COMPUTE,
          buffer: { type: "uniform" },
        },
      ],
    });
    this.brushyLayout = device.createBindGroupLayout({
      label: "Kuwahara brushy bind group layout",
      entries: [
        {
          binding: 0,
          visibility: SHADER_STAGE_COMPUTE,
          texture: { sampleType: "float" },
        },
        {
          binding: 1,
          visibility: SHADER_STAGE_COMPUTE,
          storageTexture: { access: "write-only", format: "rgba8unorm" },
        },
        {
          binding: 2,
          visibility: SHADER_STAGE_COMPUTE,
          buffer: { type: "uniform" },
        },
      ],
    });

    this.tensorPipeline = createPipeline(
      device,
      "Kuwahara tensor",
      TENSOR_SHADER,
      [this.tensorLayout],
    );
    this.blurXPipeline = createPipeline(
      device,
      "Kuwahara tensor blur X",
      BLUR_X_SHADER,
      [this.internalLayout],
    );
    this.tfmPipeline = createPipeline(
      device,
      "Kuwahara tensor field",
      TFM_SHADER,
      [this.internalLayout],
    );
    this.applyPipeline = createPipeline(
      device,
      "Kuwahara apply",
      APPLY_SHADER,
      [this.applyLayout],
    );
    this.brushyPipeline = createPipeline(
      device,
      "Kuwahara brushy",
      BRUSHY_SHADER,
      [this.brushyLayout],
    );
  }

  setOption(name, value) {
    if (name === "radius") this.radius = clampNumber(value, 1, 16);
    else if (name === "sharpness")
      this.hardness = clampNumber(value, 0.1, 30);
    else if (name === "anisotropy")
      this.anisotropy = clampNumber(value, 0, 1);
    else if (name === "style") this.style = value;
    else if (name === "brushiness")
      this.brushiness = clampNumber(value, 0, 1);
    else if (name === "blend") this.blend = clampNumber(value, 0, 1);
  }

  _createInternalTexture(width, height, label) {
    return this.device.createTexture({
      label: `Kuwahara ${label} ${width}x${height}`,
      size: { width, height },
      format: INTERNAL_FORMAT,
      usage:
        GPU_TEXTURE_USAGE.TEXTURE_BINDING | GPU_TEXTURE_USAGE.STORAGE_BINDING,
    });
  }

  _destroyInternalTextures() {
    for (const texture of this.internalTextures) texture?.destroy();
    this.internalTextures = [];
    this.internalViews = [];
    this.internalSizeKey = "";
  }

  _ensureInternalTextures(width, height) {
    const key = `${width}:${height}`;
    if (this.internalSizeKey === key) return;

    this._destroyInternalTextures();
    const labels = ["tensor", "tensor blur", "tensor field"];
    for (let i = 0; i < labels.length; i += 1) {
      this.internalTextures[i] = this._createInternalTexture(
        width,
        height,
        labels[i],
      );
      this.internalViews[i] = this.internalTextures[i].createView();
    }
    this.internalSizeKey = key;
  }

  _writeUniforms(width, height) {
    this.uniformData[0] = width;
    this.uniformData[1] = height;
    this.uniformData[2] = this.radius;
    this.uniformData[3] = this.hardness;
    this.uniformData[4] = this.q;
    this.uniformData[5] = this.anisotropy;
    this.uniformData[6] = this.zeroCrossing;
    this.uniformData[7] = this.style === "Brushy" ? this.brushiness : this.zeta;
    this.uniformData[8] = this.blend;
    this.uniformData[9] = 0;
    this.uniformData[10] = 0;
    this.uniformData[11] = 0;
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData);
  }

  _dispatch(encoder, pipeline, bindGroup, width, height) {
    dispatchCompute(encoder, pipeline, bindGroup, width, height);
  }

  render(encoder, state, pool) {
    if (this.blend <= 0) return state;

    this._writeUniforms(state.width, state.height);

    const output = pool.getTemp(state.width, state.height, state.texture);
    const sourceView = state.texture.createView();
    const outputView = output.createView();

    if (this.style === "Brushy") {
      const brushyBindGroup = this.device.createBindGroup({
        layout: this.brushyLayout,
        entries: [
          { binding: 0, resource: sourceView },
          { binding: 1, resource: outputView },
          { binding: 2, resource: { buffer: this.uniformBuffer } },
        ],
      });
      this._dispatch(
        encoder,
        this.brushyPipeline,
        brushyBindGroup,
        state.width,
        state.height,
      );
      return { texture: output, width: state.width, height: state.height };
    }

    this._ensureInternalTextures(state.width, state.height);

    const tensorBindGroup = this.device.createBindGroup({
      layout: this.tensorLayout,
      entries: [
        { binding: 0, resource: sourceView },
        { binding: 1, resource: this.internalViews[0] },
        { binding: 2, resource: { buffer: this.uniformBuffer } },
      ],
    });
    this._dispatch(
      encoder,
      this.tensorPipeline,
      tensorBindGroup,
      state.width,
      state.height,
    );

    const blurBindGroup = this.device.createBindGroup({
      layout: this.internalLayout,
      entries: [
        { binding: 0, resource: this.internalViews[0] },
        { binding: 1, resource: this.internalViews[1] },
        { binding: 2, resource: { buffer: this.uniformBuffer } },
      ],
    });
    this._dispatch(
      encoder,
      this.blurXPipeline,
      blurBindGroup,
      state.width,
      state.height,
    );

    const tfmBindGroup = this.device.createBindGroup({
      layout: this.internalLayout,
      entries: [
        { binding: 0, resource: this.internalViews[1] },
        { binding: 1, resource: this.internalViews[2] },
        { binding: 2, resource: { buffer: this.uniformBuffer } },
      ],
    });
    this._dispatch(
      encoder,
      this.tfmPipeline,
      tfmBindGroup,
      state.width,
      state.height,
    );

    const applyBindGroup = this.device.createBindGroup({
      layout: this.applyLayout,
      entries: [
        { binding: 0, resource: sourceView },
        { binding: 1, resource: this.internalViews[2] },
        { binding: 2, resource: outputView },
        { binding: 3, resource: { buffer: this.uniformBuffer } },
      ],
    });
    this._dispatch(
      encoder,
      this.applyPipeline,
      applyBindGroup,
      state.width,
      state.height,
    );

    return { texture: output, width: state.width, height: state.height };
  }

  destroy() {
    this._destroyInternalTextures();
    this.uniformBuffer?.destroy();
    this.uniformBuffer = null;
  }
}
