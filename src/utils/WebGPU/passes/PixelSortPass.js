import { GPU_BUFFER_USAGE } from "../constants";

const SHADER_STAGE_COMPUTE = 4;
const UNIFORM_BYTE_SIZE = 48;
const UNIFORM_STRIDE = 256;
const UNIFORM_STRIDE_FLOATS = UNIFORM_STRIDE / 4;
const BITONIC_MAX_REQUESTED_LINE_LENGTH = 8192;
const BITONIC_SORT_ITEM_BYTES = 8;

const PIXEL_SORT_SHADER = `
struct Params {
  width: f32,
  height: f32,
  passIndex: f32,
  reverse: f32,
  vertical: f32,
  mode: f32,
  sortBy: f32,
  low: f32,
  high: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;

fn keyLuminance(c: vec3<f32>) -> f32 {
  let maxC = max(c.r, max(c.g, c.b));
  let minC = min(c.r, min(c.g, c.b));
  return 0.5 * (maxC + minC);
}

fn keyHue(c: vec3<f32>) -> f32 {
  let maxC = max(c.r, max(c.g, c.b));
  let minC = min(c.r, min(c.g, c.b));
  let delta = maxC - minC;
  var h: f32 = 0.0;

  if (delta > 0.0) {
    if (maxC == c.r) {
      let raw = (c.g - c.b) / delta;
      h = raw - 6.0 * floor(raw / 6.0);
    } else if (maxC == c.g) {
      h = (c.b - c.r) / delta + 2.0;
    } else {
      h = (c.r - c.g) / delta + 4.0;
    }
    h = h / 6.0;
    if (h < 0.0) {
      h = h + 1.0;
    }
  }

  return h;
}

fn keySaturation(c: vec3<f32>) -> f32 {
  let maxC = max(c.r, max(c.g, c.b));
  let minC = min(c.r, min(c.g, c.b));
  let delta = maxC - minC;
  let l = 0.5 * (maxC + minC);
  if (delta == 0.0) {
    return 0.0;
  }
  return delta / (1.0 - abs(2.0 * l - 1.0));
}

fn getKey(c: vec3<f32>) -> f32 {
  let sortBy = u32(params.sortBy);
  if (sortBy == 1u) {
    return keyHue(c);
  }
  if (sortBy == 2u) {
    return keySaturation(c);
  }
  if (sortBy == 3u) {
    return (c.r + c.g + c.b) / 3.0;
  }
  if (sortBy == 4u) {
    return c.r;
  }
  if (sortBy == 5u) {
    return c.g;
  }
  if (sortBy == 6u) {
    return c.b;
  }
  return keyLuminance(c);
}

fn inSpan(key: f32) -> bool {
  if (u32(params.mode) != 1u) {
    return true;
  }
  if (key < params.low) {
    return false;
  }
  if (key > params.high) {
    return false;
  }
  return true;
}

fn coordFromAxes(axis: i32, perp: i32, vertical: bool) -> vec2<i32> {
  if (vertical) {
    return vec2<i32>(perp, axis);
  }
  return vec2<i32>(axis, perp);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);

  let vertical = u32(params.vertical) == 1u;
  var spanLength: i32 = i32(width);
  var pairIndex: i32 = i32(gid.x);
  var perp: i32 = i32(gid.y);
  if (vertical) {
    spanLength = i32(height);
    perp = i32(gid.x);
    pairIndex = i32(gid.y);
    if (gid.x >= width) {
      return;
    }
  } else if (gid.y >= height) {
    return;
  }

  let parity = i32(params.passIndex) % 2;
  let axisA = parity + pairIndex * 2;
  let axisB = axisA + 1;

  if (parity == 1 && pairIndex == 0) {
    let edgeCoord = coordFromAxes(0, perp, vertical);
    let edgeColor = textureLoad(srcTex, edgeCoord, 0);
    textureStore(dstTex, edgeCoord, edgeColor);
  }

  if (axisA >= spanLength) {
    return;
  }

  let coordA = coordFromAxes(axisA, perp, vertical);

  if (axisB >= spanLength) {
    let edgeColor = textureLoad(srcTex, coordA, 0);
    textureStore(dstTex, coordA, edgeColor);
    return;
  }

  let coordB = coordFromAxes(axisB, perp, vertical);
  let colorA = textureLoad(srcTex, coordA, 0);
  let colorB = textureLoad(srcTex, coordB, 0);
  let keyA = getKey(colorA.rgb);
  let keyB = getKey(colorB.rgb);
  let inSpanA = inSpan(keyA);
  let inSpanB = inSpan(keyB);

  let doSwap = inSpanA && inSpanB;
  let gt = keyA > keyB;
  let lt = keyA < keyB;
  let reverse = i32(params.reverse) == 1;
  var shouldSwap = false;
  if (doSwap) {
    if (reverse) {
      if (lt) {
        shouldSwap = true;
      }
    } else {
      if (gt) {
        shouldSwap = true;
      }
    }
  }

  if (shouldSwap) {
    textureStore(dstTex, coordA, colorB);
    textureStore(dstTex, coordB, colorA);
  } else {
    textureStore(dstTex, coordA, colorA);
    textureStore(dstTex, coordB, colorB);
  }
}
`;

const makePixelSortBitonicShader = (maxLineLength) => {
  const indexBits = Math.ceil(Math.log2(maxLineLength));
  const indexMask = maxLineLength - 1;
  const maxKeyPart = 2 ** (32 - indexBits) - 1;

  return `
struct Params {
  width: f32,
  height: f32,
  sortSize: f32,
  reverse: f32,
  vertical: f32,
  mode: f32,
  sortBy: f32,
  low: f32,
  high: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;

const MAX_LINE_LENGTH: u32 = ${maxLineLength}u;
const INDEX_BITS: u32 = ${indexBits}u;
const MAX_KEY_PART: u32 = ${maxKeyPart}u;
const INDEX_MASK: u32 = ${indexMask}u;

var<workgroup> sortItems: array<vec2u, ${maxLineLength}>;

fn maxU32() -> u32 {
  return (MAX_KEY_PART << INDEX_BITS) | INDEX_MASK;
}

fn keyLuminance(c: vec3<f32>) -> f32 {
  let maxC = max(c.r, max(c.g, c.b));
  let minC = min(c.r, min(c.g, c.b));
  return 0.5 * (maxC + minC);
}

fn keyHue(c: vec3<f32>) -> f32 {
  let maxC = max(c.r, max(c.g, c.b));
  let minC = min(c.r, min(c.g, c.b));
  let delta = maxC - minC;
  var h: f32 = 0.0;

  if (delta > 0.0) {
    if (maxC == c.r) {
      let raw = (c.g - c.b) / delta;
      h = raw - 6.0 * floor(raw / 6.0);
    } else if (maxC == c.g) {
      h = (c.b - c.r) / delta + 2.0;
    } else {
      h = (c.r - c.g) / delta + 4.0;
    }
    h = h / 6.0;
    if (h < 0.0) {
      h = h + 1.0;
    }
  }

  return h;
}

fn keySaturation(c: vec3<f32>) -> f32 {
  let maxC = max(c.r, max(c.g, c.b));
  let minC = min(c.r, min(c.g, c.b));
  let delta = maxC - minC;
  let l = 0.5 * (maxC + minC);
  if (delta == 0.0) {
    return 0.0;
  }
  return delta / (1.0 - abs(2.0 * l - 1.0));
}

fn getKey(c: vec3<f32>) -> f32 {
  let sortBy = u32(params.sortBy);
  if (sortBy == 1u) {
    return keyHue(c);
  }
  if (sortBy == 2u) {
    return keySaturation(c);
  }
  if (sortBy == 3u) {
    return (c.r + c.g + c.b) / 3.0;
  }
  if (sortBy == 4u) {
    return c.r;
  }
  if (sortBy == 5u) {
    return c.g;
  }
  if (sortBy == 6u) {
    return c.b;
  }
  return keyLuminance(c);
}

fn coordFromAxes(axis: u32, perp: u32, vertical: bool) -> vec2<i32> {
  if (vertical) {
    return vec2<i32>(i32(perp), i32(axis));
  }
  return vec2<i32>(i32(axis), i32(perp));
}

fn thresholdContains(key: f32) -> bool {
  if (key < params.low) {
    return false;
  }
  if (key > params.high) {
    return false;
  }
  return true;
}

fn pixelInSpan(axis: u32, lineIndex: u32, vertical: bool, lineLength: u32) -> bool {
  if (axis >= lineLength) {
    return false;
  }
  let color = textureLoad(srcTex, coordFromAxes(axis, lineIndex, vertical), 0);
  return thresholdContains(getKey(color.rgb));
}

fn transformedKey(key: f32, reverse: bool) -> u32 {
  let keyBits = bitcast<u32>(clamp(key, 0.0, 1.0));
  if (reverse) {
    return maxU32() - keyBits;
  }
  return keyBits;
}

fn makeSortItem(key: f32, relativeIndex: u32, reverse: bool) -> vec2u {
  return vec2u(transformedKey(key, reverse), relativeIndex & INDEX_MASK);
}

fn sentinelSortItem() -> vec2u {
  return vec2u(maxU32(), maxU32());
}

fn itemLess(a: vec2u, b: vec2u) -> bool {
  if (a.x < b.x) {
    return true;
  }
  if (a.x > b.x) {
    return false;
  }
  return a.y < b.y;
}

fn itemGreater(a: vec2u, b: vec2u) -> bool {
  return itemLess(b, a);
}

fn nextPowerOfTwo(value: u32) -> u32 {
  var result = value - 1u;
  result = result | (result >> 1u);
  result = result | (result >> 2u);
  result = result | (result >> 4u);
  result = result | (result >> 8u);
  result = result | (result >> 16u);
  return result + 1u;
}

@compute @workgroup_size(256)
fn main(
  @builtin(workgroup_id) workgroupId: vec3<u32>,
  @builtin(local_invocation_id) localId: vec3<u32>
) {
  let width = u32(params.width);
  let height = u32(params.height);
  let vertical = u32(params.vertical) == 1u;
  let thresholdMode = u32(params.mode) == 1u;
  let lineLength = select(width, height, vertical);
  let lineCount = select(height, width, vertical);
  let lineIndex = workgroupId.x;

  if (lineIndex >= lineCount || lineLength == 0u || lineLength > MAX_LINE_LENGTH) {
    return;
  }

  let reverse = u32(params.reverse) == 1u;

  var searchStart = 0u;
  loop {
    var spanStart = 0u;
    var spanEnd = lineLength;

    if (thresholdMode) {
      spanStart = searchStart;
      loop {
        if (spanStart >= lineLength) {
          break;
        }
        if (pixelInSpan(spanStart, lineIndex, vertical, lineLength)) {
          break;
        }
        spanStart = spanStart + 1u;
      }

      spanEnd = spanStart;
      loop {
        if (spanEnd >= lineLength) {
          break;
        }
        if (!pixelInSpan(spanEnd, lineIndex, vertical, lineLength)) {
          break;
        }
        spanEnd = spanEnd + 1u;
      }
    }

    if (spanStart >= lineLength) {
      break;
    }

    let spanLength = spanEnd - spanStart;
    var sortSize = u32(params.sortSize);
    if (thresholdMode) {
      sortSize = nextPowerOfTwo(spanLength);
    }

    for (var axis = localId.x; axis < sortSize; axis = axis + 256u) {
      if (axis < spanLength) {
        let sourceAxis = spanStart + axis;
        let color = textureLoad(srcTex, coordFromAxes(sourceAxis, lineIndex, vertical), 0);
        sortItems[axis] = makeSortItem(getKey(color.rgb), axis, reverse);
      } else {
        sortItems[axis] = sentinelSortItem();
      }
    }
    workgroupBarrier();

    var blockSize = 2u;
    loop {
      if (blockSize > sortSize) {
        break;
      }

      var stride = blockSize >> 1u;
      loop {
        if (stride == 0u) {
          break;
        }

        for (var axis = localId.x; axis < sortSize; axis = axis + 256u) {
          let partner = axis ^ stride;
          if (partner > axis && partner < sortSize) {
            let ascending = (axis & blockSize) == 0u;
            let a = sortItems[axis];
            let b = sortItems[partner];
            var shouldSwap = false;
            if (ascending) {
              shouldSwap = itemGreater(a, b);
            } else {
              shouldSwap = itemLess(a, b);
            }
            if (shouldSwap) {
              sortItems[axis] = b;
              sortItems[partner] = a;
            }
          }
        }
        workgroupBarrier();

        stride = stride >> 1u;
      }

      blockSize = blockSize << 1u;
    }

    for (var axis = localId.x; axis < spanLength; axis = axis + 256u) {
      let sourceAxis = spanStart + (sortItems[axis].y & INDEX_MASK);
      let color = textureLoad(srcTex, coordFromAxes(sourceAxis, lineIndex, vertical), 0);
      textureStore(dstTex, coordFromAxes(spanStart + axis, lineIndex, vertical), color);
    }
    workgroupBarrier();

    searchStart = spanEnd;
    if (!thresholdMode) {
      break;
    }
  }
}
`;
};

const SORT_BY = {
  Luminance: 0,
  Hue: 1,
  Saturation: 2,
  "RGB Average": 3,
  Red: 4,
  Green: 5,
  Blue: 6,
};

const DIRECTIONS = {
  Up: { vertical: 1, reverse: 1 },
  Down: { vertical: 1, reverse: 0 },
  Left: { vertical: 0, reverse: 1 },
  Right: { vertical: 0, reverse: 0 },
};

export default class WebGPUPixelSortPass {
  static type = "PIXELSORT";

  constructor(device, opts = {}) {
    this.device = device;
    this.mode = opts.mode || "Fully Sorted";
    this.low = opts.low ?? 0.2;
    this.high = opts.high ?? 0.8;
    this.sortBy = opts.sortBy || "Luminance";
    this.direction = opts.direction || "Down";
    this.invalidate =
      typeof opts.invalidate === "function" ? opts.invalidate : () => {};
    this.module = device.createShaderModule({
      label: "PixelSortPass shader",
      code: PIXEL_SORT_SHADER,
    });
    this.bindGroupLayout = device.createBindGroupLayout({
      label: "PixelSortPass bind group layout",
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
          buffer: {
            type: "uniform",
            hasDynamicOffset: true,
            minBindingSize: UNIFORM_BYTE_SIZE,
          },
        },
      ],
    });
    this.bitonicBindGroupLayout = device.createBindGroupLayout({
      label: "PixelSortPass bitonic bind group layout",
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
          buffer: {
            type: "uniform",
            minBindingSize: UNIFORM_BYTE_SIZE,
          },
        },
      ],
    });
    this.pipeline = device.createComputePipeline({
      label: "PixelSortPass pipeline",
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout],
      }),
      compute: { module: this.module, entryPoint: "main" },
    });
    this.maxBitonicLineLength = this._resolveMaxBitonicLineLength();
    this.bitonicPipelines = new Map();
    this.uniformBuffer = null;
    this.uniformCapacity = 0;
    this.uniformUpload = new Float32Array(0);
    this.uniformSignature = "";
    this.bitonicUniformBuffer = this._createBitonicUniformBuffer();
    this.bitonicUniformUpload = new Float32Array(UNIFORM_BYTE_SIZE / 4);
    this.bitonicUniformSignature = "";
  }

  setOption(name, value) {
    const prev = this[name];
    if (name === "mode") this.mode = value;
    else if (name === "low") this.low = +value;
    else if (name === "high") this.high = +value;
    else if (name === "sortBy") this.sortBy = value;
    else if (name === "direction") this.direction = value;
    else if (name === "invalidate") {
      this.invalidate = typeof value === "function" ? value : () => {};
    }

    if (name !== "invalidate" && prev !== this[name]) {
      this.uniformSignature = "";
      this.bitonicUniformSignature = "";
    }
  }

  _createBitonicPipeline(maxLineLength) {
    const module = this.device.createShaderModule({
      label: `PixelSortPass bitonic ${maxLineLength} shader`,
      code: makePixelSortBitonicShader(maxLineLength),
    });

    return this.device.createComputePipeline({
      label: `PixelSortPass bitonic ${maxLineLength} pipeline`,
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.bitonicBindGroupLayout],
      }),
      compute: { module, entryPoint: "main" },
    });
  }

  _getBitonicPipeline(sortSize) {
    let pipeline = this.bitonicPipelines.get(sortSize);
    if (!pipeline) {
      pipeline = this._createBitonicPipeline(sortSize);
      this.bitonicPipelines.set(sortSize, pipeline);
    }
    return pipeline;
  }

  _resolveMaxBitonicLineLength() {
    // Each sort item is vec2u, so workgroup storage bytes / 8 gives capacity.
    const storageSize = Number(
      this.device.limits?.maxComputeWorkgroupStorageSize,
    ) || 16384;
    const maxLineLength = Math.floor(storageSize / BITONIC_SORT_ITEM_BYTES);
    const cappedLineLength = Math.min(
      maxLineLength,
      BITONIC_MAX_REQUESTED_LINE_LENGTH,
    );
    return this._previousPowerOfTwo(cappedLineLength);
  }

  _createBitonicUniformBuffer() {
    return this.device.createBuffer({
      size: UNIFORM_BYTE_SIZE,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
    });
  }

  _createUniformBuffer(spanLength) {
    return this.device.createBuffer({
      size: UNIFORM_STRIDE * spanLength,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
    });
  }

  _ensureUniformBuffer(spanLength) {
    if (this.uniformBuffer && this.uniformCapacity >= spanLength) return;

    this.uniformBuffer?.destroy();
    this.uniformBuffer = this._createUniformBuffer(spanLength);
    this.uniformCapacity = spanLength;
    this.uniformUpload = new Float32Array(spanLength * UNIFORM_STRIDE_FLOATS);
    this.uniformSignature = "";
  }

  _writeUniformRecord(width, height, passIndex) {
    const dir = DIRECTIONS[this.direction] || DIRECTIONS.Down;
    const offset = passIndex * UNIFORM_STRIDE_FLOATS;
    this.uniformUpload[offset + 0] = width;
    this.uniformUpload[offset + 1] = height;
    this.uniformUpload[offset + 2] = passIndex;
    this.uniformUpload[offset + 3] = dir.reverse;
    this.uniformUpload[offset + 4] = dir.vertical;
    this.uniformUpload[offset + 5] = this.mode === "Threshold" ? 1 : 0;
    this.uniformUpload[offset + 6] = SORT_BY[this.sortBy] ?? 0;
    this.uniformUpload[offset + 7] = this.low;
    this.uniformUpload[offset + 8] = this.high;
    for (let i = 9; i < 12; i += 1) {
      this.uniformUpload[offset + i] = 0;
    }
  }

  _uniformSignature(width, height, spanLength) {
    return [
      width,
      height,
      spanLength,
      this.mode,
      this.low,
      this.high,
      this.sortBy,
      this.direction,
    ].join(":");
  }

  _syncUniformBuffers(width, height, spanLength) {
    const signature = this._uniformSignature(width, height, spanLength);
    this._ensureUniformBuffer(spanLength);

    if (signature === this.uniformSignature) return;

    for (let i = 0; i < spanLength; i += 1) {
      this._writeUniformRecord(width, height, i);
    }
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      this.uniformUpload,
      0,
      spanLength * UNIFORM_STRIDE_FLOATS,
    );
    this.uniformSignature = signature;
  }

  _nextPowerOfTwo(value) {
    let result = 1;
    while (result < value) result *= 2;
    return result;
  }

  _previousPowerOfTwo(value) {
    let result = 1;
    while (result * 2 <= value) result *= 2;
    return result;
  }

  _bitonicUniformSignature(width, height, sortSize) {
    return [
      width,
      height,
      sortSize,
      this.mode,
      this.low,
      this.high,
      this.sortBy,
      this.direction,
    ].join(":");
  }

  _syncBitonicUniformBuffer(width, height, sortSize) {
    const signature = this._bitonicUniformSignature(width, height, sortSize);
    if (signature === this.bitonicUniformSignature) return;

    const dir = DIRECTIONS[this.direction] || DIRECTIONS.Down;
    this.bitonicUniformUpload[0] = width;
    this.bitonicUniformUpload[1] = height;
    this.bitonicUniformUpload[2] = sortSize;
    this.bitonicUniformUpload[3] = dir.reverse;
    this.bitonicUniformUpload[4] = dir.vertical;
    this.bitonicUniformUpload[5] = this.mode === "Threshold" ? 1 : 0;
    this.bitonicUniformUpload[6] = SORT_BY[this.sortBy] ?? 0;
    this.bitonicUniformUpload[7] = this.low;
    this.bitonicUniformUpload[8] = this.high;
    for (let i = 9; i < 12; i += 1) {
      this.bitonicUniformUpload[i] = 0;
    }

    this.device.queue.writeBuffer(
      this.bitonicUniformBuffer,
      0,
      this.bitonicUniformUpload,
      0,
      this.bitonicUniformUpload.length,
    );
    this.bitonicUniformSignature = signature;
  }

  _canUseBitonic(spanLength) {
    return spanLength <= this.maxBitonicLineLength;
  }

  _renderBitonic(encoder, state, pool, dir, spanLength) {
    const sortSize = this._nextPowerOfTwo(spanLength);
    this._syncBitonicUniformBuffer(state.width, state.height, sortSize);

    const dstTexture = pool.getTemp(state.width, state.height, state.texture);
    if (this.mode === "Threshold") {
      encoder.copyTextureToTexture(
        { texture: state.texture },
        { texture: dstTexture },
        {
          width: state.width,
          height: state.height,
          depthOrArrayLayers: 1,
        },
      );
    }

    const bindGroup = this.device.createBindGroup({
      layout: this.bitonicBindGroupLayout,
      entries: [
        { binding: 0, resource: state.texture.createView() },
        { binding: 1, resource: dstTexture.createView() },
        {
          binding: 2,
          resource: {
            buffer: this.bitonicUniformBuffer,
            offset: 0,
            size: UNIFORM_BYTE_SIZE,
          },
        },
      ],
    });

    const pass = encoder.beginComputePass();
    pass.setPipeline(this._getBitonicPipeline(sortSize));
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(dir.vertical ? state.width : state.height);
    pass.end();

    return {
      texture: dstTexture,
      width: state.width,
      height: state.height,
    };
  }

  _renderOddEven(encoder, state, pool, dir, spanLength) {
    this._syncUniformBuffers(state.width, state.height, spanLength);

    const texA = pool.getTemp(state.width, state.height, state.texture);
    const texB = pool.getTemp(state.width, state.height, [
      state.texture,
      texA,
    ]);
    const textureViews = new Map();
    const getView = (texture) => {
      let view = textureViews.get(texture);
      if (!view) {
        view = texture.createView();
        textureViews.set(texture, view);
      }
      return view;
    };
    let srcTexture = state.texture;
    let dstTexture = texA;
    const workgroupsX = dir.vertical
      ? Math.ceil(state.width / 8)
      : Math.ceil(Math.ceil(spanLength / 2) / 8);
    const workgroupsY = dir.vertical
      ? Math.ceil(Math.ceil(spanLength / 2) / 8)
      : Math.ceil(state.height / 8);
    const createSortBindGroup = (src, dst) =>
      this.device.createBindGroup({
        layout: this.bindGroupLayout,
        entries: [
          { binding: 0, resource: getView(src) },
          { binding: 1, resource: getView(dst) },
          {
            binding: 2,
            resource: {
              buffer: this.uniformBuffer,
              offset: 0,
              size: UNIFORM_BYTE_SIZE,
            },
          },
        ],
      });
    const firstBindGroup = createSortBindGroup(state.texture, texA);
    const aToB = createSortBindGroup(texA, texB);
    const bToA = createSortBindGroup(texB, texA);

    for (let i = 0; i < spanLength; i += 1) {
      const bindGroup =
        i === 0 ? firstBindGroup : srcTexture === texA ? aToB : bToA;
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, bindGroup, [i * UNIFORM_STRIDE]);
      pass.dispatchWorkgroups(workgroupsX, workgroupsY);
      pass.end();

      srcTexture = dstTexture;
      dstTexture = dstTexture === texA ? texB : texA;
    }

    const finalTexture = srcTexture;
    const spareTexture = finalTexture === texA ? texB : texA;
    pool.returnTemp(spareTexture, state.width, state.height);

    return {
      texture: finalTexture,
      width: state.width,
      height: state.height,
    };
  }

  render(encoder, state, pool) {
    const dir = DIRECTIONS[this.direction] || DIRECTIONS.Down;
    const spanLength = dir.vertical ? state.height : state.width;
    if (spanLength <= 1) return state;
    if (this.mode === "Threshold" && this.low >= this.high) return state;

    if (this._canUseBitonic(spanLength)) {
      return this._renderBitonic(encoder, state, pool, dir, spanLength);
    }

    return this._renderOddEven(encoder, state, pool, dir, spanLength);
  }

  destroy() {
    this.uniformBuffer?.destroy();
    this.bitonicUniformBuffer?.destroy();
    this.uniformBuffer = null;
    this.bitonicUniformBuffer = null;
    this.uniformCapacity = 0;
    this.uniformUpload = new Float32Array(0);
    this.bitonicUniformUpload = new Float32Array(0);
  }
}
