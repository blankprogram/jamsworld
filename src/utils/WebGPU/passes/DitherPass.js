import WebGPUComputePass from "../WebGPUComputePass";
import { GPU_BUFFER_USAGE } from "../constants";
import {
  DIZZY_LAYER_MASK,
  DIZZY_LAYER_MASK_LAYERS,
  DIZZY_LAYER_MASK_SIZE,
} from "../../dither/dizzyLayerMask";
import { createBindGroup, dispatchCompute } from "./shared";

const DIZZY_UNIFORM_SIZE = 32;
const BYTES_PER_FLOAT_PIXEL = 16;
const DEFAULT_MAX_WORK_BUFFER_SIZE = 128 * 1024 * 1024;

const DITHER_SHADER = `
struct Params {
  width: f32,
  height: f32,
  algo: f32,
  levels: f32,
};

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;

fn rand(co: vec2<f32>) -> f32 {
  return fract(sin(dot(co, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}

fn rot(a: f32) -> mat2x2<f32> {
  let c = cos(a);
  let s = sin(a);
  return mat2x2<f32>(c, s, -s, c);
}

fn bayer4(index: u32) -> f32 {
  let values = array<f32, 16>(
    0.0, 8.0, 2.0, 10.0,
    12.0, 4.0, 14.0, 6.0,
    3.0, 11.0, 1.0, 9.0,
    15.0, 7.0, 13.0, 5.0
  );
  return values[index];
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
  let src = textureLoad(srcTex, coord, 0);
  let algo = u32(params.algo);
  let levels = max(2.0, params.levels);

  if (algo == 2u) {
    let isGray = abs(src.r - src.g) < 0.001 && abs(src.r - src.b) < 0.001;
    let a0 = select(0.2617994, 0.7853982, isGray);
    let a1 = 0.7853982;
    let a2 = select(1.3089969, 0.7853982, isGray);
    let p = pixel / levels;
    let c0 = fract(rot(a0) * p) - vec2<f32>(0.5);
    let c1 = fract(rot(a1) * p) - vec2<f32>(0.5);
    let c2 = fract(rot(a2) * p) - vec2<f32>(0.5);
    let r0 = (1.0 - src.r) * 0.5;
    let r1 = (1.0 - src.g) * 0.5;
    let r2 = (1.0 - src.b) * 0.5;
    let v0 = select(1.0, 0.0, length(c0) < r0);
    let v1 = select(1.0, 0.0, length(c1) < r1);
    let v2 = select(1.0, 0.0, length(c2) < r2);
    textureStore(dstTex, coord, vec4<f32>(v0, v1, v2, src.a));
    return;
  }

  let threshold = select(
    rand(pixel),
    (bayer4(((gid.y & 3u) * 4u) + (gid.x & 3u)) + 0.5) / 16.0,
    algo == 0u
  );
  let q = floor(src.rgb * levels + vec3<f32>(threshold)) / levels;
  textureStore(dstTex, coord, vec4<f32>(q, src.a));
}
`;

const DITHER_ALGOS = {
  Ordered: 0,
  Stochastic: 1,
  Halftone: 2,
  Dizzy: 3,
};

const DIZZY_STYLES = {
  Standard: 0,
  "2x2 Bayer": 1,
  "4x4 Bayer": 2,
};

function normalizeDitherAlgo(algo) {
  if (algo === "Error Diffusion") return "Dizzy";
  return DITHER_ALGOS[algo] === undefined ? "Ordered" : algo;
}

function normalizeDizzyStyle(style) {
  return DIZZY_STYLES[style] === undefined ? "Standard" : style;
}

function clampLevels(levels) {
  return Math.max(2, parseInt(levels, 10) || 2);
}

const DIZZY_INIT_SHADER = `
struct Params {
  width: f32,
  height: f32,
  layer: f32,
  levels: f32,
  maskSize: f32,
  style: f32,
};

struct Pixels {
  values: array<vec4<f32>>,
};

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var<storage, read_write> pixels: Pixels;
@group(0) @binding(2) var<uniform> params: Params;

fn idx(x: u32, y: u32, width: u32) -> u32 {
  return y * width + x;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let coord = vec2<i32>(i32(gid.x), i32(gid.y));
  pixels.values[idx(gid.x, gid.y, width)] = textureLoad(srcTex, coord, 0);
}
`;

const DIZZY_LAYER_SHADER = `
struct Params {
  width: f32,
  height: f32,
  layer: f32,
  levels: f32,
  maskSize: f32,
  style: f32,
};

struct Pixels {
  values: array<vec4<f32>>,
};

struct LayerMask {
  values: array<u32>,
};

@group(0) @binding(0) var<storage, read_write> pixels: Pixels;
@group(0) @binding(1) var<uniform> params: Params;
@group(0) @binding(2) var<storage, read> layerMask: LayerMask;

fn idx(x: u32, y: u32, width: u32) -> u32 {
  return y * width + x;
}

fn layerFor(x: u32, y: u32) -> u32 {
  let maskSize = u32(params.maskSize);
  let maskX = x % maskSize;
  let maskY = y % maskSize;
  return layerMask.values[maskY * maskSize + maskX];
}

fn quantize3(rgb: vec3<f32>, quantLevel: f32) -> vec3<f32> {
  return round(clamp(rgb, vec3<f32>(0.0), vec3<f32>(1.0)) * quantLevel) / quantLevel;
}

fn bayer2(index: u32) -> u32 {
  let values = array<u32, 4>(0u, 2u, 3u, 1u);
  return values[index];
}

fn bayer4(index: u32) -> u32 {
  let values = array<u32, 16>(
    0u, 8u, 2u, 10u,
    12u, 4u, 14u, 6u,
    3u, 11u, 1u, 9u,
    15u, 7u, 13u, 5u
  );
  return values[index];
}

fn bayerTarget(channel: f32, x: u32, y: u32, style: u32) -> f32 {
  let value = clamp(channel, 0.0, 1.0);
  if (style == 1u) {
    let level = u32(round(value * 4.0));
    let threshold = bayer2(((y & 1u) * 2u) + (x & 1u));
    return select(0.0, 1.0, threshold < level);
  }

  let level = u32(round(value * 16.0));
  let threshold = bayer4(((y & 3u) * 4u) + (x & 3u));
  return select(0.0, 1.0, threshold < level);
}

fn targetRgb(rgb: vec3<f32>, x: u32, y: u32, quantLevel: f32, style: u32) -> vec3<f32> {
  if (style == 1u || style == 2u) {
    return vec3<f32>(
      bayerTarget(rgb.r, x, y, style),
      bayerTarget(rgb.g, x, y, style),
      bayerTarget(rgb.b, x, y, style)
    );
  }

  return quantize3(rgb, quantLevel);
}

fn isFutureNeighbor(x: u32, y: u32, currentLayer: u32) -> bool {
  return layerFor(x, y) > currentLayer;
}

fn addError(pixelIndex: u32, err: vec3<f32>, weight: f32) {
  let current = pixels.values[pixelIndex];
  pixels.values[pixelIndex] = vec4<f32>(current.rgb + err * weight, current.a);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let currentLayer = u32(params.layer);
  if (layerFor(gid.x, gid.y) != currentLayer) {
    return;
  }

  let pixelIndex = idx(gid.x, gid.y, width);
  let oldPixel = pixels.values[pixelIndex];
  let quantLevel = max(1.0, params.levels - 1.0);
  let newRgb = targetRgb(oldPixel.rgb, gid.x, gid.y, quantLevel, u32(params.style));
  let err = oldPixel.rgb - newRgb;

  pixels.values[pixelIndex] = vec4<f32>(newRgb, oldPixel.a);

  var n = 0u;
  if (gid.x > 0u && isFutureNeighbor(gid.x - 1u, gid.y, currentLayer)) {
    n = n + 1u;
  }
  if (gid.x + 1u < width && isFutureNeighbor(gid.x + 1u, gid.y, currentLayer)) {
    n = n + 1u;
  }
  if (gid.y > 0u && isFutureNeighbor(gid.x, gid.y - 1u, currentLayer)) {
    n = n + 1u;
  }
  if (gid.y + 1u < height && isFutureNeighbor(gid.x, gid.y + 1u, currentLayer)) {
    n = n + 1u;
  }

  if (n == 0u) {
    return;
  }

  let weight = 1.0 / f32(n);
  if (gid.x > 0u && isFutureNeighbor(gid.x - 1u, gid.y, currentLayer)) {
    addError(idx(gid.x - 1u, gid.y, width), err, weight);
  }
  if (gid.x + 1u < width && isFutureNeighbor(gid.x + 1u, gid.y, currentLayer)) {
    addError(idx(gid.x + 1u, gid.y, width), err, weight);
  }
  if (gid.y > 0u && isFutureNeighbor(gid.x, gid.y - 1u, currentLayer)) {
    addError(idx(gid.x, gid.y - 1u, width), err, weight);
  }
  if (gid.y + 1u < height && isFutureNeighbor(gid.x, gid.y + 1u, currentLayer)) {
    addError(idx(gid.x, gid.y + 1u, width), err, weight);
  }
}
`;

const DIZZY_OUTPUT_SHADER = `
struct Params {
  width: f32,
  height: f32,
  layer: f32,
  levels: f32,
  maskSize: f32,
  style: f32,
};

struct Pixels {
  values: array<vec4<f32>>,
};

@group(0) @binding(0) var<storage, read_write> pixels: Pixels;
@group(0) @binding(1) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;

fn idx(x: u32, y: u32, width: u32) -> u32 {
  return y * width + x;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let value = pixels.values[idx(gid.x, gid.y, width)];
  textureStore(
    dstTex,
    vec2<i32>(i32(gid.x), i32(gid.y)),
    vec4<f32>(clamp(value.rgb, vec3<f32>(0.0), vec3<f32>(1.0)), value.a)
  );
}
`;

export default class WebGPUDitherPass extends WebGPUComputePass {
  static type = "DITHER";

  constructor(device, opts = {}) {
    super(device, DITHER_SHADER, opts);
    this.algo = normalizeDitherAlgo(opts.algo || "Ordered");
    this.dizzyStyle = normalizeDizzyStyle(opts.dizzyStyle || "Standard");
    this.levels = clampLevels(opts.levels);
    this.workBuffer = null;
    this.workBufferSize = 0;
    this.layerMaskBuffer = null;
    this.maxWorkBufferSize =
      Number(device.limits?.maxStorageBufferBindingSize) ||
      DEFAULT_MAX_WORK_BUFFER_SIZE;
    this.dizzyUniformBuffers = [];
    this.retiredDizzyUniformBuffers = [];
    this.dizzyInitPipeline = this._createDizzyPipeline(
      DIZZY_INIT_SHADER,
      "Dizzy init",
    );
    this.dizzyLayerPipeline = this._createDizzyPipeline(
      DIZZY_LAYER_SHADER,
      "Dizzy layer",
    );
    this.dizzyOutputPipeline = this._createDizzyPipeline(
      DIZZY_OUTPUT_SHADER,
      "Dizzy output",
    );
  }

  setOption(name, value) {
    if (name === "algo") {
      this.algo = normalizeDitherAlgo(value);
      this._clearDizzyUniformBuffers();
    } else if (name === "dizzyStyle") {
      this.dizzyStyle = normalizeDizzyStyle(value);
      this._clearDizzyUniformBuffers();
    } else if (name === "levels") {
      this.levels = clampLevels(value);
      this._clearDizzyUniformBuffers();
    }
  }

  getUniformData(width, height) {
    this.uniformData[0] = width;
    this.uniformData[1] = height;
    this.uniformData[2] = DITHER_ALGOS[this.algo] ?? 0;
    this.uniformData[3] = this.levels;
    return this.uniformData;
  }

  _createDizzyPipeline(shader, label) {
    const module = this.device.createShaderModule({
      label: `${label} shader`,
      code: shader,
    });
    return this.device.createComputePipeline({
      label: `${label} pipeline`,
      layout: "auto",
      compute: { module, entryPoint: "main" },
    });
  }

  _ensureWorkBuffer(width, height) {
    const needed = width * height * BYTES_PER_FLOAT_PIXEL;
    if (needed > this.maxWorkBufferSize) return null;
    if (this.workBuffer && this.workBufferSize === needed) {
      return this.workBuffer;
    }

    this.workBuffer?.destroy();
    this.workBuffer = this.device.createBuffer({
      label: `Dizzy pixels ${width}x${height}`,
      size: needed,
      usage: GPU_BUFFER_USAGE.STORAGE,
    });
    this.workBufferSize = needed;
    return this.workBuffer;
  }

  _ensureLayerMaskBuffer() {
    if (this.layerMaskBuffer) return this.layerMaskBuffer;

    const maskData = Uint32Array.from(DIZZY_LAYER_MASK);

    this.layerMaskBuffer = this.device.createBuffer({
      label: `Dizzy layer mask ${DIZZY_LAYER_MASK_SIZE}x${DIZZY_LAYER_MASK_SIZE}`,
      size: maskData.byteLength,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST,
    });
    this.device.queue.writeBuffer(this.layerMaskBuffer, 0, maskData);
    return this.layerMaskBuffer;
  }

  _getDizzyUniformBuffer(index, width, height, layer = 0) {
    if (!this.dizzyUniformBuffers[index]) {
      this.dizzyUniformBuffers[index] = this.device.createBuffer({
        label: `Dizzy uniforms ${index}`,
        size: DIZZY_UNIFORM_SIZE,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
      });
    }
    this.device.queue.writeBuffer(
      this.dizzyUniformBuffers[index],
      0,
      new Float32Array([
        width,
        height,
        layer,
        this.levels,
        DIZZY_LAYER_MASK_SIZE,
        DIZZY_STYLES[this.dizzyStyle] ?? 0,
        0,
        0,
      ]),
    );
    return this.dizzyUniformBuffers[index];
  }

  _clearDizzyUniformBuffers() {
    this.retiredDizzyUniformBuffers.push(...this.dizzyUniformBuffers);
    this.dizzyUniformBuffers = [];
  }

  _dispatch(encoder, pipeline, bindGroup, width, height) {
    dispatchCompute(encoder, pipeline, bindGroup, width, height);
  }

  render(encoder, state, pool) {
    if (this.algo !== "Dizzy") {
      return super.render(encoder, state, pool);
    }

    const workBuffer = this._ensureWorkBuffer(state.width, state.height);
    if (!workBuffer) {
      return super.render(encoder, state, pool);
    }
    const layerMaskBuffer = this._ensureLayerMaskBuffer();

    const output = pool.getTemp(state.width, state.height, state.texture);
    const workResource = { buffer: workBuffer };

    const initUniformBuffer = this._getDizzyUniformBuffer(
      0,
      state.width,
      state.height,
      0,
    );
    const initBindGroup = createBindGroup(this.device, this.dizzyInitPipeline, [
      { binding: 0, resource: state.texture.createView() },
      { binding: 1, resource: workResource },
      { binding: 2, resource: { buffer: initUniformBuffer } },
    ]);
    this._dispatch(
      encoder,
      this.dizzyInitPipeline,
      initBindGroup,
      state.width,
      state.height,
    );

    for (let layer = 0; layer < DIZZY_LAYER_MASK_LAYERS; layer += 1) {
      const layerUniformBuffer = this._getDizzyUniformBuffer(
        layer + 1,
        state.width,
        state.height,
        layer,
      );
      const layerBindGroup = createBindGroup(
        this.device,
        this.dizzyLayerPipeline,
        [
          { binding: 0, resource: workResource },
          { binding: 1, resource: { buffer: layerUniformBuffer } },
          { binding: 2, resource: { buffer: layerMaskBuffer } },
        ],
      );
      this._dispatch(
        encoder,
        this.dizzyLayerPipeline,
        layerBindGroup,
        state.width,
        state.height,
      );
    }

    const outputUniformBuffer = this._getDizzyUniformBuffer(
      DIZZY_LAYER_MASK_LAYERS + 1,
      state.width,
      state.height,
      0,
    );
    const outputBindGroup = createBindGroup(
      this.device,
      this.dizzyOutputPipeline,
      [
        { binding: 0, resource: workResource },
        { binding: 1, resource: output.createView() },
        { binding: 2, resource: { buffer: outputUniformBuffer } },
      ],
    );
    this._dispatch(
      encoder,
      this.dizzyOutputPipeline,
      outputBindGroup,
      state.width,
      state.height,
    );

    return { texture: output, width: state.width, height: state.height };
  }

  destroy() {
    super.destroy();
    this.workBuffer?.destroy();
    this.layerMaskBuffer?.destroy();
    this.workBuffer = null;
    this.workBufferSize = 0;
    this.layerMaskBuffer = null;
    this._clearDizzyUniformBuffers();
    for (const buffer of this.retiredDizzyUniformBuffers) {
      buffer?.destroy();
    }
    this.retiredDizzyUniformBuffers = [];
  }
}
