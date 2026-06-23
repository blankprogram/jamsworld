import { GPU_BUFFER_USAGE } from "../constants";

const SHADER_STAGE_COMPUTE = 4;
const UNIFORM_BYTE_SIZE = 48;
const UNIFORM_STRIDE = 256;
const UNIFORM_STRIDE_FLOATS = UNIFORM_STRIDE / 4;

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
    this.pipeline = device.createComputePipeline({
      label: "PixelSortPass pipeline",
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout],
      }),
      compute: { module: this.module, entryPoint: "main" },
    });
    this.uniformBuffer = null;
    this.uniformCapacity = 0;
    this.uniformUpload = new Float32Array(0);
    this.uniformSignature = "";
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
    }
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

  render(encoder, state, pool) {
    const dir = DIRECTIONS[this.direction] || DIRECTIONS.Down;
    const spanLength = dir.vertical ? state.height : state.width;
    if (spanLength <= 1) return state;
    if (this.mode === "Threshold" && this.low >= this.high) return state;

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

  destroy() {
    this.uniformBuffer?.destroy();
    this.uniformBuffer = null;
    this.uniformCapacity = 0;
    this.uniformUpload = new Float32Array(0);
  }
}
