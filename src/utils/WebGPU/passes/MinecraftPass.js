import { GPU_BUFFER_USAGE } from "../constants";
import atlasUrl from "../../../assets/atlas/minecraft_atlas.png";
import atlasMeta from "../../../assets/atlas/minecraft_atlas.json";
import { loadImage, uploadImageTexture } from "./assetHelpers";
import WebGPUDownsampleStage from "./DownsampleStage";

const LUT_LEVELS = 24;

const TILEMAP_SHADER = `
struct Params {
  cols: f32,
  rows: f32,
  alphaThreshold: f32,
  mode: f32,
  low: f32,
  high: f32,
  q: f32,
  pad0: f32,
};

@group(0) @binding(0) var downTex: texture_2d<f32>;
@group(0) @binding(1) var tileMapTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
@group(0) @binding(3) var<storage, read> lut: array<u32>;
@group(0) @binding(4) var<storage, read> tileData: array<vec4<u32>>;

fn luminance(c: vec3<f32>) -> f32 {
  return dot(c, vec3<f32>(0.299, 0.587, 0.114));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let cols = u32(params.cols);
  let rows = u32(params.rows);
  if (gid.x >= cols || gid.y >= rows) {
    return;
  }

  let coord = vec2<i32>(gid.xy);
  let src = textureLoad(downTex, coord, 0);
  if (src.a < params.alphaThreshold) {
    textureStore(tileMapTex, coord, vec4<f32>(0.0));
    return;
  }

  let luma = luminance(src.rgb);
  if (params.mode > 0.5 && (luma < params.low || luma > params.high)) {
    textureStore(tileMapTex, coord, vec4<f32>(0.0));
    return;
  }

  let q = u32(params.q);
  let rb = min(q - 1u, u32(src.r * f32(q)));
  let gb = min(q - 1u, u32(src.g * f32(q)));
  let bb = min(q - 1u, u32(src.b * f32(q)));
  let lutIndex = (rb * q + gb) * q + bb;
  let entryIndex = lut[lutIndex];
  let entry = tileData[entryIndex];
  textureStore(
    tileMapTex,
    coord,
    vec4<f32>(f32(entry.x) / 255.0, f32(entry.y) / 255.0, 0.0, 1.0)
  );
}
`;

const MINECRAFT_SHADER = `
struct Params {
  width: f32,
  height: f32,
  cols: f32,
  rows: f32,
  cellSize: f32,
  tileSize: f32,
  overlay: f32,
  ready: f32,
};

@group(0) @binding(0) var tileMapTex: texture_2d<f32>;
@group(0) @binding(1) var atlasTex: texture_2d<f32>;
@group(0) @binding(2) var backgroundTex: texture_2d<f32>;
@group(0) @binding(3) var srcSampler: sampler;
@group(0) @binding(4) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(5) var<uniform> params: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let frag = vec2<f32>(gid.xy) + vec2<f32>(0.5);
  let bgUv = frag / vec2<f32>(params.width, params.height);
  let bg = textureSampleLevel(backgroundTex, srcSampler, bgUv, 0.0);
  if (params.ready < 0.5) {
    textureStore(dstTex, vec2<i32>(gid.xy), bg);
    return;
  }

  let block = vec2<i32>(floor(frag / params.cellSize));
  let local = fract(frag / params.cellSize);
  let mapInfo = textureLoad(tileMapTex, block, 0);
  if (mapInfo.a < 0.5) {
    textureStore(dstTex, vec2<i32>(gid.xy), select(vec4<f32>(0.0), bg, params.overlay > 0.5));
    return;
  }

  let tileCol = i32(floor(mapInfo.r * 255.0 + 0.5));
  let tileRow = i32(floor(mapInfo.g * 255.0 + 0.5));
  let tile = i32(floor(params.tileSize));
  let tx = clamp(i32(floor(local.x * f32(tile))), 0, tile - 1);
  let ty = clamp(i32(floor(local.y * f32(tile))), 0, tile - 1);
  let atlasCoord = vec2<i32>(tileCol * tile + tx, tileRow * tile + ty);
  let tileColor = textureLoad(atlasTex, atlasCoord, 0);

  if (params.overlay > 0.5) {
    textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(tileColor.rgb, bg.a));
  } else {
    textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(tileColor.rgb, 1.0));
  }
}
`;

function srgbToLinear(value) {
  if (value <= 0.04045) return value / 12.92;
  return ((value + 0.055) / 1.055) ** 2.4;
}

function rgbToLab(r, g, b) {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  const z = rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041;
  const epsilon = 216 / 24389;
  const kappa = 24389 / 27;
  const f = (t) => (t > epsilon ? Math.cbrt(t) : (kappa * t + 16) / 116);
  const fx = f(x / 0.95047);
  const fy = f(y / 1.0);
  const fz = f(z / 1.08883);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function nearestEntryIndex(lab, entries) {
  let bestIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < entries.length; i += 1) {
    const target = entries[i].lab;
    const dl = lab[0] - target[0];
    const da = lab[1] - target[1];
    const db = lab[2] - target[2];
    const dist = dl * dl + da * da + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function buildRuntime() {
  const tileSize = Math.max(1, Number(atlasMeta?.tile_size ?? 16) || 16);
  const textures = atlasMeta?.textures || {};
  const entries = Object.entries(textures)
    .map(([name, record]) => {
      const avgLab = Array.isArray(record?.avg_lab) ? record.avg_lab : null;
      if (!avgLab || avgLab.length < 3) return null;
      return {
        name,
        tileCol: Math.max(0, Math.floor(Number(record?.atlas_x ?? 0) / tileSize)),
        tileRow: Math.max(0, Math.floor(Number(record?.atlas_y ?? 0) / tileSize)),
        lab: [Number(avgLab[0]), Number(avgLab[1]), Number(avgLab[2])],
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.tileRow !== b.tileRow) return a.tileRow - b.tileRow;
      if (a.tileCol !== b.tileCol) return a.tileCol - b.tileCol;
      return a.name.localeCompare(b.name);
    });

  const lut = new Uint32Array(LUT_LEVELS * LUT_LEVELS * LUT_LEVELS);
  for (let r = 0; r < LUT_LEVELS; r += 1) {
    for (let g = 0; g < LUT_LEVELS; g += 1) {
      for (let b = 0; b < LUT_LEVELS; b += 1) {
        const lab = rgbToLab(
          (r + 0.5) / LUT_LEVELS,
          (g + 0.5) / LUT_LEVELS,
          (b + 0.5) / LUT_LEVELS,
        );
        lut[(r * LUT_LEVELS + g) * LUT_LEVELS + b] = nearestEntryIndex(lab, entries);
      }
    }
  }

  const tileData = new Uint32Array(Math.max(1, entries.length) * 4);
  for (let i = 0; i < entries.length; i += 1) {
    tileData[i * 4 + 0] = entries[i].tileCol;
    tileData[i * 4 + 1] = entries[i].tileRow;
  }

  return { tileSize, entries, lut, tileData };
}

export default class WebGPUMinecraftPass {
  static type = "MINECRAFT";

  constructor(device, opts = {}) {
    this.device = device;
    this.blockSize = Number(opts.blockSize ?? 16);
    this.mode = opts.mode || "All";
    this.low = Number(opts.low ?? 0);
    this.high = Number(opts.high ?? 1);
    this.alphaThreshold = Number(opts.alphaThreshold ?? 0.5);
    this.overlay = opts.overlay || "No";
    this.invalidate =
      typeof opts.invalidate === "function" ? opts.invalidate : () => {};

    this.runtime = buildRuntime();
    this.tileSize = this.runtime.tileSize;
    this.downsample = new WebGPUDownsampleStage(device);
    this.sampler = device.createSampler({
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      magFilter: "nearest",
      minFilter: "nearest",
    });

    this.tileMapModule = device.createShaderModule({ code: TILEMAP_SHADER });
    this.tileMapPipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module: this.tileMapModule, entryPoint: "main" },
    });
    this.renderModule = device.createShaderModule({ code: MINECRAFT_SHADER });
    this.renderPipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module: this.renderModule, entryPoint: "main" },
    });

    this.tileMapUniform = device.createBuffer({
      size: 32,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
    });
    this.renderUniform = device.createBuffer({
      size: 32,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
    });
    this.tileMapUniformData = new Float32Array(8);
    this.renderUniformData = new Float32Array(8);
    this.lutBuffer = device.createBuffer({
      size: this.runtime.lut.byteLength,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST,
    });
    this.tileDataBuffer = device.createBuffer({
      size: this.runtime.tileData.byteLength,
      usage: GPU_BUFFER_USAGE.STORAGE | GPU_BUFFER_USAGE.COPY_DST,
    });
    device.queue.writeBuffer(this.lutBuffer, 0, this.runtime.lut);
    device.queue.writeBuffer(this.tileDataBuffer, 0, this.runtime.tileData);

    this.ready = false;
    this._destroyed = false;
    this._loadAtlas();
  }

  _loadAtlas() {
    loadImage(atlasUrl)
      .then((img) => {
        if (this._destroyed) return;
        this.atlas?.texture?.destroy();
        this.atlas = uploadImageTexture(this.device, img);
        this.ready = true;
        this.invalidate();
      })
      .catch((err) => console.error("Minecraft atlas failed to load:", atlasUrl, err));
  }

  setOption(name, value) {
    if (name === "blockSize") this.blockSize = Number(value);
    else if (name === "mode") this.mode = value;
    else if (name === "low") this.low = Number(value);
    else if (name === "high") this.high = Number(value);
    else if (name === "alphaThreshold") this.alphaThreshold = Number(value);
    else if (name === "overlay") this.overlay = value;
  }

  _writeTileMapUniform(cols, rows) {
    this.tileMapUniformData[0] = cols;
    this.tileMapUniformData[1] = rows;
    this.tileMapUniformData[2] = this.alphaThreshold;
    this.tileMapUniformData[3] = this.mode === "Threshold" ? 1 : 0;
    this.tileMapUniformData[4] = this.low;
    this.tileMapUniformData[5] = this.high;
    this.tileMapUniformData[6] = LUT_LEVELS;
    this.tileMapUniformData[7] = 0;
    this.device.queue.writeBuffer(
      this.tileMapUniform,
      0,
      this.tileMapUniformData,
    );
  }

  _writeRenderUniform(width, height, cols, rows, cellSize) {
    this.renderUniformData[0] = width;
    this.renderUniformData[1] = height;
    this.renderUniformData[2] = cols;
    this.renderUniformData[3] = rows;
    this.renderUniformData[4] = cellSize;
    this.renderUniformData[5] = this.tileSize;
    this.renderUniformData[6] = this.overlay === "Yes" ? 1 : 0;
    this.renderUniformData[7] = this.ready ? 1 : 0;
    this.device.queue.writeBuffer(
      this.renderUniform,
      0,
      this.renderUniformData,
    );
  }

  render(encoder, state, pool) {
    const cellSize = Math.max(1, Number(this.blockSize) || 1);
    const cols = Math.max(1, Math.ceil(state.width / cellSize));
    const rows = Math.max(1, Math.ceil(state.height / cellSize));
    const down = this.downsample.render(
      encoder,
      state.texture,
      state.width,
      state.height,
      cols,
      rows,
      this.sampler,
      pool,
    );
    const tileMap = pool.getTemp(cols, rows, down);
    const output = pool.getTemp(state.width, state.height, [
      state.texture,
      down,
      tileMap,
    ]);

    this._writeTileMapUniform(cols, rows);
    const tileMapBindGroup = this.device.createBindGroup({
      layout: this.tileMapPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: down.createView() },
        { binding: 1, resource: tileMap.createView() },
        { binding: 2, resource: { buffer: this.tileMapUniform } },
        { binding: 3, resource: { buffer: this.lutBuffer } },
        { binding: 4, resource: { buffer: this.tileDataBuffer } },
      ],
    });
    const tileMapPass = encoder.beginComputePass();
    tileMapPass.setPipeline(this.tileMapPipeline);
    tileMapPass.setBindGroup(0, tileMapBindGroup);
    tileMapPass.dispatchWorkgroups(Math.ceil(cols / 8), Math.ceil(rows / 8));
    tileMapPass.end();

    this._writeRenderUniform(state.width, state.height, cols, rows, cellSize);
    const renderBindGroup = this.device.createBindGroup({
      layout: this.renderPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: tileMap.createView() },
        { binding: 1, resource: (this.atlas?.texture || state.texture).createView() },
        { binding: 2, resource: state.texture.createView() },
        { binding: 3, resource: this.sampler },
        { binding: 4, resource: output.createView() },
        { binding: 5, resource: { buffer: this.renderUniform } },
      ],
    });
    const renderPass = encoder.beginComputePass();
    renderPass.setPipeline(this.renderPipeline);
    renderPass.setBindGroup(0, renderBindGroup);
    renderPass.dispatchWorkgroups(
      Math.ceil(state.width / 8),
      Math.ceil(state.height / 8),
    );
    renderPass.end();

    pool.returnTemp(down, cols, rows);
    pool.returnTemp(tileMap, cols, rows);
    return { texture: output, width: state.width, height: state.height };
  }

  destroy() {
    this._destroyed = true;
    this.downsample?.destroy();
    this.tileMapUniform?.destroy();
    this.renderUniform?.destroy();
    this.lutBuffer?.destroy();
    this.tileDataBuffer?.destroy();
    this.atlas?.texture?.destroy();
  }
}
