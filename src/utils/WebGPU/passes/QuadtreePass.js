import { GPU_BUFFER_USAGE, GPU_TEXTURE_USAGE } from "../constants";
import { createBindGroup, dispatchCompute } from "./shared";

const MAX_LEVEL = 9;
const MOMENT_FORMAT = "rgba32float";
const SHADER_STAGE_COMPUTE = 4;

const INIT_SHADER = `
@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var momentTex: texture_storage_2d<rgba32float, write>;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dims = textureDimensions(srcTex);
  if (gid.x >= dims.x || gid.y >= dims.y) {
    return;
  }

  let color = textureLoad(srcTex, vec2<i32>(gid.xy), 0).rgb;

  // rgb = mean colour, a = scalar variance.
  // Level 0 represents one real image pixel per texel, so variance is zero.
  textureStore(momentTex, vec2<i32>(gid.xy), vec4<f32>(color, 0.0));
}
`;

const REDUCE_SHADER = `
struct Params {
  width: f32,
  height: f32,
  srcBlockSize: f32,
  pad0: f32,
};

@group(0) @binding(0) var srcMomentTex: texture_2d<f32>;
@group(0) @binding(1) var dstMomentTex: texture_storage_2d<rgba32float, write>;
@group(0) @binding(2) var<uniform> params: Params;

fn loadMoment(coord: vec2<u32>) -> vec4<f32> {
  let dims = textureDimensions(srcMomentTex);
  if (coord.x >= dims.x || coord.y >= dims.y) {
    return vec4<f32>(0.0);
  }
  return textureLoad(srcMomentTex, vec2<i32>(coord), 0);
}

fn cheapReduce(a: vec4<f32>, b: vec4<f32>, c: vec4<f32>, d: vec4<f32>) -> vec4<f32> {
  let mean = (a.rgb + b.rgb + c.rgb + d.rgb) * 0.25;

  let va = a.a + dot(a.rgb - mean, a.rgb - mean) / 3.0;
  let vb = b.a + dot(b.rgb - mean, b.rgb - mean) / 3.0;
  let vc = c.a + dot(c.rgb - mean, c.rgb - mean) / 3.0;
  let vd = d.a + dot(d.rgb - mean, d.rgb - mean) / 3.0;

  let variance = (va + vb + vc + vd) * 0.25;
  return vec4<f32>(mean, variance);
}

fn countForSrcCell(coord: vec2<u32>) -> f32 {
  let width = u32(params.width);
  let height = u32(params.height);
  let blockSize = u32(params.srcBlockSize);
  let block = vec2<u32>(blockSize, blockSize);
  let start = coord * block;

  if (start.x >= width || start.y >= height) {
    return 0.0;
  }

  let end = min(start + block, vec2<u32>(width, height));
  let extent = end - start;
  return f32(extent.x) * f32(extent.y);
}

fn varianceContribution(moment: vec4<f32>, count: f32, parentMean: vec3<f32>) -> f32 {
  if (count <= 0.0) {
    return 0.0;
  }

  let delta = moment.rgb - parentMean;
  let betweenMeanVariance = dot(delta, delta) / 3.0;
  return count * (moment.a + betweenMeanVariance);
}

fn weightedReduce(
  a: vec4<f32>,
  b: vec4<f32>,
  c: vec4<f32>,
  d: vec4<f32>,
  aCoord: vec2<u32>,
  bCoord: vec2<u32>,
  cCoord: vec2<u32>,
  dCoord: vec2<u32>
) -> vec4<f32> {
  let ca = countForSrcCell(aCoord);
  let cb = countForSrcCell(bCoord);
  let cc = countForSrcCell(cCoord);
  let cd = countForSrcCell(dCoord);

  let total = ca + cb + cc + cd;
  if (total <= 0.0) {
    return vec4<f32>(0.0);
  }

  let mean = (a.rgb * ca + b.rgb * cb + c.rgb * cc + d.rgb * cd) / total;

  let variance = (
    varianceContribution(a, ca, mean) +
    varianceContribution(b, cb, mean) +
    varianceContribution(c, cc, mean) +
    varianceContribution(d, cd, mean)
  ) / total;

  return vec4<f32>(mean, variance);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let dstDims = textureDimensions(dstMomentTex);
  if (gid.x >= dstDims.x || gid.y >= dstDims.y) {
    return;
  }

  let base = gid.xy * 2u;

  let aCoord = base;
  let bCoord = base + vec2<u32>(1u, 0u);
  let cCoord = base + vec2<u32>(0u, 1u);
  let dCoord = base + vec2<u32>(1u, 1u);

  let a = loadMoment(aCoord);
  let b = loadMoment(bCoord);
  let c = loadMoment(cCoord);
  let d = loadMoment(dCoord);

  let width = u32(params.width);
  let height = u32(params.height);
  let blockSize = u32(params.srcBlockSize);

  // Fast path: the whole 2x2 source-cell group is inside the real image.
  // Therefore each child has the same real-pixel count, so the cheap 25% reduce
  // is mathematically equivalent to the weighted reduce.
  let fullParentFits =
    (base.x + 2u) * blockSize <= width &&
    (base.y + 2u) * blockSize <= height;

  if (fullParentFits) {
    textureStore(dstMomentTex, vec2<i32>(gid.xy), cheapReduce(a, b, c, d));
    return;
  }

  textureStore(
    dstMomentTex,
    vec2<i32>(gid.xy),
    weightedReduce(a, b, c, d, aCoord, bCoord, cCoord, dCoord)
  );
}
`;

const SELECTION_FORMAT = MOMENT_FORMAT;

const SELECTION_SHADER = `
struct Params {
  width: f32,
  height: f32,
  threshold: f32,
  maxLevel: f32,
  minLevel: f32,
  showOutlines: f32,
  outlineR: f32,
  outlineG: f32,
  outlineB: f32,
  shape: f32,
  shapeBounds: f32,
  mode: f32,
  low: f32,
  high: f32,
  maskedArea: f32,
  maskFill: f32,
  maskFillR: f32,
  maskFillG: f32,
  maskFillB: f32,
  shapeBackgroundR: f32,
  shapeBackgroundG: f32,
  shapeBackgroundB: f32,
  pad0: f32,
};

@group(0) @binding(0) var moment0: texture_2d<f32>;
@group(0) @binding(1) var moment1: texture_2d<f32>;
@group(0) @binding(2) var moment2: texture_2d<f32>;
@group(0) @binding(3) var moment3: texture_2d<f32>;
@group(0) @binding(4) var moment4: texture_2d<f32>;
@group(0) @binding(5) var moment5: texture_2d<f32>;
@group(0) @binding(6) var moment6: texture_2d<f32>;
@group(0) @binding(7) var moment7: texture_2d<f32>;
@group(0) @binding(8) var moment8: texture_2d<f32>;
@group(0) @binding(9) var moment9: texture_2d<f32>;
@group(0) @binding(10) var<uniform> params: Params;
@group(0) @binding(11) var selectionInfoTex: texture_storage_2d<rgba32float, write>;
@group(0) @binding(12) var selectionColorTex: texture_storage_2d<rgba32float, write>;

struct Selection {
  level: u32,
  coord: vec2<u32>,
  moment: vec4<f32>,
};

fn luminance(c: vec3<f32>) -> f32 {
  return dot(c, vec3<f32>(0.299, 0.587, 0.114));
}

fn loadMoment(level: u32, coord: vec2<u32>) -> vec4<f32> {
  switch level {
    case 0u: { return textureLoad(moment0, vec2<i32>(coord), 0); }
    case 1u: { return textureLoad(moment1, vec2<i32>(coord), 0); }
    case 2u: { return textureLoad(moment2, vec2<i32>(coord), 0); }
    case 3u: { return textureLoad(moment3, vec2<i32>(coord), 0); }
    case 4u: { return textureLoad(moment4, vec2<i32>(coord), 0); }
    case 5u: { return textureLoad(moment5, vec2<i32>(coord), 0); }
    case 6u: { return textureLoad(moment6, vec2<i32>(coord), 0); }
    case 7u: { return textureLoad(moment7, vec2<i32>(coord), 0); }
    case 8u: { return textureLoad(moment8, vec2<i32>(coord), 0); }
    default: { return textureLoad(moment9, vec2<i32>(coord), 0); }
  }
}

fn blockSizeForLevel(level: u32) -> u32 {
  return 1u << level;
}

fn blockCoordForLevel(pixel: vec2<u32>, level: u32) -> vec2<u32> {
  let blockSize = blockSizeForLevel(level);
  return pixel / vec2<u32>(blockSize, blockSize);
}

fn selectBlock(pixel: vec2<u32>, minLevel: u32, maxLevel: u32) -> Selection {
  var selectedLevel = minLevel;
  var selectedCoord = blockCoordForLevel(pixel, minLevel);
  var selectedMoment = loadMoment(minLevel, selectedCoord);

  var level = maxLevel;
  loop {
    let coord = blockCoordForLevel(pixel, level);
    let moment = loadMoment(level, coord);

    if (moment.a <= params.threshold || level == minLevel) {
      selectedLevel = level;
      selectedCoord = coord;
      selectedMoment = moment;
      break;
    }

    if (level == 0u) {
      break;
    }
    level = level - 1u;
  }

  return Selection(selectedLevel, selectedCoord, selectedMoment);
}

fn sameSelection(a: Selection, b: Selection) -> bool {
  return a.level == b.level && all(a.coord == b.coord);
}

fn blockPassesThreshold(selected: Selection) -> bool {
  if (params.mode <= 0.5) {
    return true;
  }

  let blockLuma = luminance(selected.moment.rgb);
  return blockLuma >= params.low && blockLuma <= params.high;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let pixel = gid.xy;
  let minLevel = u32(params.minLevel);
  let maxLevel = u32(params.maxLevel);
  let selected = selectBlock(pixel, minLevel, maxLevel);
  let visible = select(0.0, 1.0, blockPassesThreshold(selected));

  textureStore(
    selectionInfoTex,
    vec2<i32>(pixel),
    vec4<f32>(f32(selected.level), vec2<f32>(selected.coord), visible)
  );
  textureStore(
    selectionColorTex,
    vec2<i32>(pixel),
    vec4<f32>(selected.moment.rgb, selected.moment.a)
  );
}
`;

const RENDER_SHADER = `
struct Params {
  width: f32,
  height: f32,
  threshold: f32,
  maxLevel: f32,
  minLevel: f32,
  showOutlines: f32,
  outlineR: f32,
  outlineG: f32,
  outlineB: f32,
  shape: f32,
  shapeBounds: f32,
  mode: f32,
  low: f32,
  high: f32,
  maskedArea: f32,
  maskFill: f32,
  maskFillR: f32,
  maskFillG: f32,
  maskFillB: f32,
  shapeBackgroundR: f32,
  shapeBackgroundG: f32,
  shapeBackgroundB: f32,
  pad0: f32,
};

@group(0) @binding(0) var selectionInfoTex: texture_2d<f32>;
@group(0) @binding(1) var selectionColorTex: texture_2d<f32>;
@group(0) @binding(2) var srcTex: texture_2d<f32>;
@group(0) @binding(3) var<uniform> params: Params;
@group(0) @binding(4) var dstTex: texture_storage_2d<rgba8unorm, write>;

struct Selection {
  level: u32,
  coord: vec2<u32>,
  color: vec3<f32>,
  visible: bool,
};

fn loadSelection(pixel: vec2<u32>) -> Selection {
  let info = textureLoad(selectionInfoTex, vec2<i32>(pixel), 0);
  let color = textureLoad(selectionColorTex, vec2<i32>(pixel), 0).rgb;
  return Selection(u32(info.x), vec2<u32>(info.yz), color, info.w > 0.5);
}

fn blockSizeForLevel(level: u32) -> u32 {
  return 1u << level;
}

fn sameSelection(a: Selection, b: Selection) -> bool {
  return a.level == b.level && all(a.coord == b.coord);
}

fn pixelInBounds(pixel: vec2<i32>) -> bool {
  return pixel.x >= 0 &&
    pixel.y >= 0 &&
    pixel.x < i32(params.width) &&
    pixel.y < i32(params.height);
}

fn visibleNeighbourNeedsSharedBorder(
  neighbourPixel: vec2<i32>,
  selected: Selection
) -> bool {
  if (!pixelInBounds(neighbourPixel)) {
    return true;
  }

  let neighbour = loadSelection(vec2<u32>(neighbourPixel));
  if (!neighbour.visible) {
    return true;
  }

  return !sameSelection(selected, neighbour);
}

fn visibleNeighbourOwnsMaskedBoundary(
  neighbourPixel: vec2<i32>,
  selected: Selection
) -> bool {
  if (!pixelInBounds(neighbourPixel)) {
    return false;
  }

  let neighbour = loadSelection(vec2<u32>(neighbourPixel));
  if (!neighbour.visible) {
    return false;
  }

  return !sameSelection(selected, neighbour);
}

fn isVisibleLeafBoundary(
  pixel: vec2<u32>,
  selected: Selection
) -> bool {
  let p = vec2<i32>(pixel);
  let width = i32(params.width);
  let height = i32(params.height);
  let outerBorder = p.x == 0 || p.y == 0 || p.x + 1 >= width || p.y + 1 >= height;

  if (blockSizeForLevel(selected.level) <= 1u) {
    return outerBorder;
  }

  // Visible cells own their left/top shared borders.
  if (visibleNeighbourNeedsSharedBorder(p + vec2<i32>(-1, 0), selected)) {
    return true;
  }

  if (visibleNeighbourNeedsSharedBorder(p + vec2<i32>(0, -1), selected)) {
    return true;
  }

  // Right/bottom image edges have no outside pixel to own them.
  if (outerBorder) {
    return true;
  }

  return false;
}

fn maskedPixelDrawsBoundary(
  pixel: vec2<u32>,
  selected: Selection
) -> bool {
  let p = vec2<i32>(pixel);

  if (visibleNeighbourOwnsMaskedBoundary(p + vec2<i32>(-1, 0), selected)) {
    return true;
  }

  if (visibleNeighbourOwnsMaskedBoundary(p + vec2<i32>(0, -1), selected)) {
    return true;
  }

  return false;
}

fn shapeLocal(pixel: vec2<u32>, selected: Selection) -> vec2<f32> {
  let blockSize = blockSizeForLevel(selected.level);
  let blockOrigin = selected.coord * vec2<u32>(blockSize, blockSize);

  let pixelInBlock = vec2<f32>(pixel - blockOrigin) + vec2<f32>(0.5, 0.5);

  var shapeSize = vec2<f32>(f32(blockSize), f32(blockSize));

  if (u32(params.shapeBounds) == 0u) {
    let imageSize = vec2<u32>(u32(params.width), u32(params.height));
    let blockEnd = min(blockOrigin + vec2<u32>(blockSize, blockSize), imageSize);
    let clippedSize = max(blockEnd - blockOrigin, vec2<u32>(1u, 1u));
    shapeSize = vec2<f32>(clippedSize);
  }

  // Keep non-square shapes from colliding with the cell outline.
  if (params.showOutlines > 0.5 && u32(params.shape) != 0u && shapeSize.x > 2.0 && shapeSize.y > 2.0) {
    return (pixelInBlock - vec2<f32>(1.0, 1.0)) / max(shapeSize - vec2<f32>(2.0, 2.0), vec2<f32>(1.0, 1.0));
  }

  return pixelInBlock / shapeSize;
}
fn isInsideShape(pixel: vec2<u32>, selected: Selection) -> bool {
  let shape = u32(params.shape);
  if (shape == 0u) {
    return true;
  }

  let local = shapeLocal(pixel, selected);

  if (shape == 1u) {
    let centered = local - vec2<f32>(0.5, 0.5);
    return dot(centered, centered) <= 0.25;
  }

  if (shape == 2u) {
    return local.y >= abs(local.x - 0.5) * 2.0;
  }

  if (shape == 3u) {
    let blockSize = f32(blockSizeForLevel(selected.level));
    let pixelTolerance = 0.75 / max(blockSize, 1.0);
    return abs(local.x - 0.5) + abs(local.y - 0.5) <= 0.5 + pixelTolerance;
  }
  return true;
}

fn maskedOutColor(src: vec4<f32>) -> vec4<f32> {
  if (params.maskedArea < 0.5) {
    return src;
  }

  let fill = u32(params.maskFill);

  if (fill == 0u) {
    return vec4<f32>(0.0);
  }

  return vec4<f32>(params.maskFillR, params.maskFillG, params.maskFillB, src.a);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let pixel = gid.xy;
  let src = textureLoad(srcTex, vec2<i32>(pixel), 0);
  let outlineColor = vec3<f32>(params.outlineR, params.outlineG, params.outlineB);
  let shapeBackgroundColor = vec3<f32>(
    params.shapeBackgroundR,
    params.shapeBackgroundG,
    params.shapeBackgroundB
  );

  let selected = loadSelection(pixel);
  let selectedVisible = selected.visible;

  if (!selectedVisible) {
    if (
      params.showOutlines > 0.5 &&
      params.mode > 0.5 &&
      maskedPixelDrawsBoundary(pixel, selected)
    ) {
      textureStore(dstTex, vec2<i32>(pixel), vec4<f32>(outlineColor, src.a));
      return;
    }

    textureStore(dstTex, vec2<i32>(pixel), maskedOutColor(src));
    return;
  }

  var color = shapeBackgroundColor;
  if (isInsideShape(pixel, selected)) {
    color = selected.color;
  }

  if (params.showOutlines > 0.5) {
    if (isVisibleLeafBoundary(pixel, selected)) {
      color = outlineColor;
    }
  }

  textureStore(dstTex, vec2<i32>(pixel), vec4<f32>(color, src.a));
}
`;

function clampInt(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  if (max < min) return min;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function hexToRgb(hex, fallback = [0.13, 0.13, 0.13]) {
  if (typeof hex !== "string") return fallback;
  const match = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  if (!match) return fallback;
  const value = parseInt(match[1], 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}

function shapeToIndex(shape) {
  if (shape === "Circle") return 1;
  if (shape === "Triangle") return 2;
  if (shape === "Diamond") return 3;
  return 0;
}

function shapeBoundsToIndex(shapeBounds) {
  if (shapeBounds === "Clip to square cell") return 1;
  if (shapeBounds === "Full Square Cell") return 1;
  if (shapeBounds === "Clip") return 1;
  return 0;
}

function maskFillToIndex(maskFill) {
  if (maskFill === "Color" || maskFill === "Line Color") return 1;
  return 0;
}

function normalizeMaskFill(maskFill) {
  if (maskFill === "Color" || maskFill === "Line Color") return "Color";
  return "Transparent";
}

function normalizeMaskedArea(opts = {}) {
  if (opts.maskedArea === "Fill") return "Fill";
  if (opts.maskedArea === "Original") return "Original";
  if (opts.maskOverlay === "No") return "Fill";
  return "Original";
}

function maskedAreaToIndex(maskedArea) {
  return maskedArea === "Fill" ? 1 : 0;
}

function normalizeQuadtreeOptions(opts = {}) {
  const outlineColor = hexToRgb(opts.outlineColor || opts.lineColor || "#222222");
  const shapeBackgroundColor = hexToRgb(
    opts.shapeBackgroundColor || opts.lineColor || "#222222",
  );
  const maskFillColor = hexToRgb(
    opts.maskFillColor || opts.lineColor || "#222222",
  );
  const maskFill = normalizeMaskFill(opts.maskFill);
  const maskedArea = normalizeMaskedArea(opts);

  return {
    threshold: clampNumber(opts.threshold ?? 0.015, 0.001, 1),
    maxLevels: clampInt(opts.maxLevels ?? 7, 1, MAX_LEVEL),
    minBlockSize: clampInt(opts.minBlockSize ?? 2, 1, 512),
    showOutlines: opts.showOutlines ?? "Yes",
    outlineColor,
    shape: opts.shape || "Square",
    shapeBounds: opts.shapeBounds || "Stretch to clipped cell",
    shapeBackgroundColor,
    mode: opts.mode || "All",
    low: clampNumber(opts.low ?? 0, 0, 1),
    high: clampNumber(opts.high ?? 1, 0, 1),
    maskedArea,
    maskedAreaIndex: maskedAreaToIndex(maskedArea),
    maskFill,
    maskFillIndex: maskFillToIndex(maskFill),
    maskFillColor,
  };
}

function levelForMinBlockSize(value, maxLevel) {
  const size = Math.max(1, Number(value) || 1);
  return Math.min(maxLevel, Math.max(0, Math.ceil(Math.log2(size))));
}

function sizeAtLevel(size, level) {
  return Math.max(1, Math.ceil(size / 2 ** level));
}

function maxLevelForSize(width, height) {
  const longestSide = Math.max(1, width, height);
  return Math.min(MAX_LEVEL, Math.ceil(Math.log2(longestSide)));
}

export default class WebGPUQuadtreePass {
  static type = "QUADTREE";

  constructor(device, opts = {}) {
    this.device = device;
    const normalized = normalizeQuadtreeOptions(opts);

    this.threshold = normalized.threshold;
    this.maxLevels = normalized.maxLevels;
    this.minBlockSize = normalized.minBlockSize;
    this.showOutlines = normalized.showOutlines;
    this.outlineColor = normalized.outlineColor;
    this.shape = normalized.shape;
    this.shapeIndex = shapeToIndex(this.shape);
    this.shapeBounds = normalized.shapeBounds;
    this.shapeBoundsIndex = shapeBoundsToIndex(this.shapeBounds);
    this.shapeBackgroundColor = normalized.shapeBackgroundColor;
    this.mode = normalized.mode;
    this.low = normalized.low;
    this.high = normalized.high;
    this.maskedArea = normalized.maskedArea;
    this.maskedAreaIndex = normalized.maskedAreaIndex;
    this.maskFill = normalized.maskFill;
    this.maskFillIndex = normalized.maskFillIndex;
    this.maskFillColor = normalized.maskFillColor;

    this.momentTextures = [];
    this.momentViews = [];
    this.reduceBindGroups = [];
    this.momentSizeKey = "";
    this.selectionInfoTexture = null;
    this.selectionColorTexture = null;
    this.selectionInfoView = null;
    this.selectionColorView = null;
    this.selectionSizeKey = "";

    this.reduceUniformBuffers = Array.from({ length: MAX_LEVEL + 1 }, () =>
      device.createBuffer({
        size: 16,
        usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
      }),
    );
    this.reduceUniformData = new Float32Array(4);

    // 24 floats * 4 bytes = 96 bytes.
    this.renderUniformBuffer = device.createBuffer({
      size: 96,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
    });
    this.renderUniformData = new Float32Array(24);

    this.initModule = device.createShaderModule({
      label: "Quadtree init shader",
      code: INIT_SHADER,
    });
    this.initPipeline = device.createComputePipeline({
      label: "Quadtree init pipeline",
      layout: "auto",
      compute: { module: this.initModule, entryPoint: "main" },
    });

    this.reduceBindGroupLayout = device.createBindGroupLayout({
      label: "Quadtree reduce bind group layout",
      entries: [
        {
          binding: 0,
          visibility: SHADER_STAGE_COMPUTE,
          texture: { sampleType: "unfilterable-float" },
        },
        {
          binding: 1,
          visibility: SHADER_STAGE_COMPUTE,
          storageTexture: { access: "write-only", format: MOMENT_FORMAT },
        },
        {
          binding: 2,
          visibility: SHADER_STAGE_COMPUTE,
          buffer: { type: "uniform" },
        },
      ],
    });
    this.reduceModule = device.createShaderModule({
      label: "Quadtree reduce shader",
      code: REDUCE_SHADER,
    });
    this.reducePipeline = device.createComputePipeline({
      label: "Quadtree reduce pipeline",
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.reduceBindGroupLayout],
      }),
      compute: { module: this.reduceModule, entryPoint: "main" },
    });

    this.selectionBindGroupLayout = device.createBindGroupLayout({
      label: "Quadtree selection bind group layout",
      entries: [
        ...Array.from({ length: MAX_LEVEL + 1 }, (_, binding) => ({
          binding,
          visibility: SHADER_STAGE_COMPUTE,
          texture: { sampleType: "unfilterable-float" },
        })),
        {
          binding: 10,
          visibility: SHADER_STAGE_COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          binding: 11,
          visibility: SHADER_STAGE_COMPUTE,
          storageTexture: { access: "write-only", format: SELECTION_FORMAT },
        },
        {
          binding: 12,
          visibility: SHADER_STAGE_COMPUTE,
          storageTexture: { access: "write-only", format: SELECTION_FORMAT },
        },
      ],
    });
    this.selectionModule = device.createShaderModule({
      label: "Quadtree selection shader",
      code: SELECTION_SHADER,
    });
    this.selectionPipeline = device.createComputePipeline({
      label: "Quadtree selection pipeline",
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.selectionBindGroupLayout],
      }),
      compute: { module: this.selectionModule, entryPoint: "main" },
    });

    this.renderBindGroupLayout = device.createBindGroupLayout({
      label: "Quadtree render bind group layout",
      entries: [
        {
          binding: 0,
          visibility: SHADER_STAGE_COMPUTE,
          texture: { sampleType: "unfilterable-float" },
        },
        {
          binding: 1,
          visibility: SHADER_STAGE_COMPUTE,
          texture: { sampleType: "unfilterable-float" },
        },
        {
          binding: 2,
          visibility: SHADER_STAGE_COMPUTE,
          texture: { sampleType: "unfilterable-float" },
        },
        {
          binding: 3,
          visibility: SHADER_STAGE_COMPUTE,
          buffer: { type: "uniform" },
        },
        {
          binding: 4,
          visibility: SHADER_STAGE_COMPUTE,
          storageTexture: { access: "write-only", format: "rgba8unorm" },
        },
      ],
    });
    this.renderModule = device.createShaderModule({
      label: "Quadtree render shader",
      code: RENDER_SHADER,
    });
    this.renderPipeline = device.createComputePipeline({
      label: "Quadtree render pipeline",
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.renderBindGroupLayout],
      }),
      compute: { module: this.renderModule, entryPoint: "main" },
    });
  }

  setOption(name, value) {
    if (name === "threshold") this.threshold = clampNumber(value, 0.001, 1);
    else if (name === "maxLevels")
      this.maxLevels = clampInt(value, 1, MAX_LEVEL);
    else if (name === "minBlockSize")
      this.minBlockSize = clampInt(value, 1, 512);
    else if (name === "showOutlines") this.showOutlines = value;
    else if (name === "lineColor" || name === "outlineColor")
      this.outlineColor = hexToRgb(value, this.outlineColor);
    else if (name === "shapeBackgroundColor")
      this.shapeBackgroundColor = hexToRgb(value, this.shapeBackgroundColor);
    else if (name === "shape") {
      this.shape = value;
      this.shapeIndex = shapeToIndex(value);
    } else if (name === "shapeBounds") {
      this.shapeBounds = value;
      this.shapeBoundsIndex = shapeBoundsToIndex(value);
    }
    else if (name === "mode") this.mode = value;
    else if (name === "low") this.low = clampNumber(value, 0, 1);
    else if (name === "high") this.high = clampNumber(value, 0, 1);
    else if (name === "maskedArea") {
      this.maskedArea = value;
      this.maskedAreaIndex = maskedAreaToIndex(value);
    } else if (name === "maskOverlay") {
      this.maskedArea = value === "No" ? "Fill" : "Original";
      this.maskedAreaIndex = maskedAreaToIndex(this.maskedArea);
    }
    else if (name === "maskFill") {
      this.maskFill = normalizeMaskFill(value);
      this.maskFillIndex = maskFillToIndex(this.maskFill);
    } else if (name === "maskFillColor") {
      this.maskFillColor = hexToRgb(value, this.maskFillColor);
    }
  }

  _createMomentTexture(width, height, level) {
    return this.device.createTexture({
      label: `Quadtree moments L${level} ${width}x${height}`,
      size: { width, height },
      format: MOMENT_FORMAT,
      usage:
        GPU_TEXTURE_USAGE.TEXTURE_BINDING | GPU_TEXTURE_USAGE.STORAGE_BINDING,
    });
  }

  _createSelectionTexture(width, height, label) {
    return this.device.createTexture({
      label: `Quadtree ${label} ${width}x${height}`,
      size: { width, height },
      format: SELECTION_FORMAT,
      usage:
        GPU_TEXTURE_USAGE.TEXTURE_BINDING | GPU_TEXTURE_USAGE.STORAGE_BINDING,
    });
  }

  _destroyMoments() {
    for (const texture of this.momentTextures) texture?.destroy();
    this.momentTextures = [];
    this.momentViews = [];
    this.reduceBindGroups = [];
    this.momentSizeKey = "";
  }

  _destroySelectionMaps() {
    this.selectionInfoTexture?.destroy();
    this.selectionColorTexture?.destroy();
    this.selectionInfoTexture = null;
    this.selectionColorTexture = null;
    this.selectionInfoView = null;
    this.selectionColorView = null;
    this.selectionSizeKey = "";
  }

  _ensureSelectionMaps(width, height) {
    const key = `${width}:${height}`;
    if (this.selectionSizeKey === key) return;

    this._destroySelectionMaps();
    this.selectionInfoTexture = this._createSelectionTexture(
      width,
      height,
      "selection info",
    );
    this.selectionColorTexture = this._createSelectionTexture(
      width,
      height,
      "selection color",
    );
    this.selectionInfoView = this.selectionInfoTexture.createView();
    this.selectionColorView = this.selectionColorTexture.createView();
    this.selectionSizeKey = key;
  }

  _ensureMoments(width, height, maxLevel) {
    const key = `${width}:${height}:${maxLevel}`;
    if (this.momentSizeKey === key) return;

    this._destroyMoments();
    for (let level = 0; level <= maxLevel; level += 1) {
      const levelWidth = sizeAtLevel(width, level);
      const levelHeight = sizeAtLevel(height, level);
      this.momentTextures[level] = this._createMomentTexture(
        levelWidth,
        levelHeight,
        level,
      );
      this.momentViews[level] = this.momentTextures[level].createView();
    }

    for (let level = 1; level <= maxLevel; level += 1) {
      const uniformBuffer = this.reduceUniformBuffers[level];
      this._writeReduceUniform(uniformBuffer, width, height, 2 ** (level - 1));
      this.reduceBindGroups[level] = this.device.createBindGroup({
        layout: this.reduceBindGroupLayout,
        entries: [
          { binding: 0, resource: this.momentViews[level - 1] },
          { binding: 1, resource: this.momentViews[level] },
          { binding: 2, resource: { buffer: uniformBuffer } },
        ],
      });
    }

    this.momentSizeKey = key;
  }

  _writeReduceUniform(buffer, width, height, srcBlockSize) {
    this.reduceUniformData[0] = width;
    this.reduceUniformData[1] = height;
    this.reduceUniformData[2] = srcBlockSize;
    this.reduceUniformData[3] = 0;
    this.device.queue.writeBuffer(buffer, 0, this.reduceUniformData);
  }

  _writeRenderUniform(width, height, maxLevel, minLevel) {
    this.renderUniformData[0] = width;
    this.renderUniformData[1] = height;
    this.renderUniformData[2] = this.threshold;
    this.renderUniformData[3] = maxLevel;
    this.renderUniformData[4] = minLevel;
    this.renderUniformData[5] = this.showOutlines === "No" ? 0 : 1;
    this.renderUniformData[6] = this.outlineColor[0];
    this.renderUniformData[7] = this.outlineColor[1];
    this.renderUniformData[8] = this.outlineColor[2];
    this.renderUniformData[9] = this.shapeIndex;
    this.renderUniformData[10] = this.shapeBoundsIndex;
    this.renderUniformData[11] = this.mode === "Threshold" ? 1 : 0;
    this.renderUniformData[12] = this.low;
    this.renderUniformData[13] = this.high;
    this.renderUniformData[14] = this.maskedAreaIndex;
    this.renderUniformData[15] = this.maskFillIndex;
    this.renderUniformData[16] = this.maskFillColor[0];
    this.renderUniformData[17] = this.maskFillColor[1];
    this.renderUniformData[18] = this.maskFillColor[2];
    this.renderUniformData[19] = this.shapeBackgroundColor[0];
    this.renderUniformData[20] = this.shapeBackgroundColor[1];
    this.renderUniformData[21] = this.shapeBackgroundColor[2];
    this.renderUniformData[22] = 0;
    this.renderUniformData[23] = 0;

    this.device.queue.writeBuffer(
      this.renderUniformBuffer,
      0,
      this.renderUniformData,
    );
  }

  render(encoder, state, pool) {
    const domainMaxLevel = maxLevelForSize(state.width, state.height);
    const maxLevel = clampInt(this.maxLevels, 0, domainMaxLevel);
    const minLevel = levelForMinBlockSize(this.minBlockSize, maxLevel);
    this._ensureMoments(state.width, state.height, maxLevel);
    this._ensureSelectionMaps(state.width, state.height);

    const output = pool.getTemp(state.width, state.height, state.texture);

    const initBindGroup = createBindGroup(this.device, this.initPipeline, [
      { binding: 0, resource: state.texture.createView() },
      { binding: 1, resource: this.momentViews[0] },
    ]);
    dispatchCompute(
      encoder,
      this.initPipeline,
      initBindGroup,
      state.width,
      state.height,
    );

    for (let level = 1; level <= maxLevel; level += 1) {
      const nextWidth = sizeAtLevel(state.width, level);
      const nextHeight = sizeAtLevel(state.height, level);
      dispatchCompute(
        encoder,
        this.reducePipeline,
        this.reduceBindGroups[level],
        nextWidth,
        nextHeight,
      );
    }

    this._writeRenderUniform(state.width, state.height, maxLevel, minLevel);

    const selectionBindGroup = this.device.createBindGroup({
      layout: this.selectionBindGroupLayout,
      entries: [
        ...Array.from({ length: MAX_LEVEL + 1 }, (_, level) => ({
          binding: level,
          resource: this.momentViews[Math.min(level, maxLevel)],
        })),
        { binding: 10, resource: { buffer: this.renderUniformBuffer } },
        { binding: 11, resource: this.selectionInfoView },
        { binding: 12, resource: this.selectionColorView },
      ],
    });
    dispatchCompute(
      encoder,
      this.selectionPipeline,
      selectionBindGroup,
      state.width,
      state.height,
    );

    const renderBindGroup = this.device.createBindGroup({
      layout: this.renderBindGroupLayout,
      entries: [
        { binding: 0, resource: this.selectionInfoView },
        { binding: 1, resource: this.selectionColorView },
        { binding: 2, resource: state.texture.createView() },
        { binding: 3, resource: { buffer: this.renderUniformBuffer } },
        { binding: 4, resource: output.createView() },
      ],
    });

    dispatchCompute(
      encoder,
      this.renderPipeline,
      renderBindGroup,
      state.width,
      state.height,
    );

    return { texture: output, width: state.width, height: state.height };
  }

  destroy() {
    this._destroyMoments();
    this._destroySelectionMaps();
    for (const buffer of this.reduceUniformBuffers) buffer?.destroy();
    this.reduceUniformBuffers = [];
    this.renderUniformBuffer?.destroy();
    this.renderUniformBuffer = null;
  }
}
