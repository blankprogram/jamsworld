import { GPU_BUFFER_USAGE } from "../constants";
import WebGPUDownsampleStage from "./DownsampleStage";
import {
  generateFontAtlasCanvas,
  hexToRgb,
  uploadImageTexture,
} from "./assetHelpers";

const ASCII_SHADER = `
struct Params {
  width: f32,
  height: f32,
  cols: f32,
  rows: f32,
  cellSizeX: f32,
  cellSizeY: f32,
  charCount: f32,
  alphaThreshold: f32,
  fillMode: f32,
  textColorMode: f32,
  overlay: f32,
  mode: f32,
  low: f32,
  high: f32,
  pad0: f32,
  pad1: f32,
  fill: vec4<f32>,
  textColor: vec4<f32>,
};

@group(0) @binding(0) var downTex: texture_2d<f32>;
@group(0) @binding(1) var atlasTex: texture_2d<f32>;
@group(0) @binding(2) var backgroundTex: texture_2d<f32>;
@group(0) @binding(3) var srcSampler: sampler;
@group(0) @binding(4) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(5) var<uniform> params: Params;

fn luminance(c: vec3<f32>) -> f32 {
  return dot(c, vec3<f32>(0.299, 0.587, 0.114));
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let frag = vec2<f32>(gid.xy) + vec2<f32>(0.5);
  let uvBg = frag / vec2<f32>(params.width, params.height);
  let block = vec2<i32>(floor(frag / vec2<f32>(params.cellSizeX, params.cellSizeY)));
  let src = textureLoad(downTex, block, 0);
  let bg = textureSampleLevel(backgroundTex, srcSampler, uvBg, 0.0);

  let b = luminance(src.rgb);
  let alphaMask = select(0.0, 1.0, src.a >= params.alphaThreshold);
  var rangeMask = 1.0;
  if (params.mode > 0.5 && (b < params.low || b > params.high)) {
    rangeMask = 0.0;
  }

  if (alphaMask * rangeMask < 0.5) {
    textureStore(dstTex, vec2<i32>(gid.xy), select(vec4<f32>(0.0), bg, params.overlay > 0.5));
    return;
  }

  let idx = clamp(floor(b * (params.charCount - 1.0)), 0.0, params.charCount - 1.0);
  let local = fract(frag / vec2<f32>(params.cellSizeX, params.cellSizeY));
  let atlasUv = (vec2<f32>(idx, 0.0) + local) / vec2<f32>(params.charCount, 1.0);
  let glyph = textureSampleLevel(atlasTex, srcSampler, atlasUv, 0.0).a;
  let glyphColor = select(src.rgb, params.textColor.rgb, params.textColorMode > 0.5);

  if (params.fillMode > 0.5) {
    if (params.overlay > 0.5) {
      textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(mix(bg.rgb, glyphColor, glyph), bg.a));
    } else {
      textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(glyphColor, glyph));
    }
  } else {
    let asciiCell = mix(params.fill.rgb, glyphColor, glyph);
    textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(asciiCell, select(1.0, bg.a, params.overlay > 0.5)));
  }
}
`;

export default class WebGPUAsciiPass {
  static type = "ASCII";

  constructor(device, opts = {}) {
    this.device = device;
    this.blockSize = Number(opts.blockSize ?? 16);
    this.density = Number(opts.density ?? 1);
    this.chars = opts.chars || ".:-=+*#%@";
    this.fontFamily = opts.fontFamily || opts.font || "Arial";
    this.mode = opts.mode || "All";
    this.low = Number(opts.low ?? 0);
    this.high = Number(opts.high ?? 1);
    this.alphaThreshold = Number(opts.alphaThreshold ?? 0.5);
    this.fillMode = opts.fillMode || "Color";
    this.fill = hexToRgb(opts.fill || "#000000");
    this.textColorMode = opts.textColorMode || "Sampled";
    this.textColor = hexToRgb(opts.textColor || "#ffffff", [1, 1, 1]);
    this.overlay = opts.overlay || "No";

    this.downsample = new WebGPUDownsampleStage(device);
    this.module = device.createShaderModule({ code: ASCII_SHADER });
    this.pipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module: this.module, entryPoint: "main" },
    });
    this.uniformBuffer = device.createBuffer({
      size: 96,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
    });
    this.uniformData = new Float32Array(24);
    this.sampler = device.createSampler({
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      magFilter: "nearest",
      minFilter: "nearest",
    });
    this._rebuildAtlas();
  }

  setOption(name, value) {
    if (name === "fillMode") this.fillMode = value;
    else if (name === "fill") this.fill = hexToRgb(value);
    else if (name === "textColor") this.textColor = hexToRgb(value, [1, 1, 1]);
    else if (name === "textColorMode") this.textColorMode = value;
    else if (name === "overlay") this.overlay = value;
    else if (name === "mode") this.mode = value;
    else if (name === "low") this.low = Number(value);
    else if (name === "high") this.high = Number(value);
    else if (name === "blockSize") {
      this.blockSize = Number(value);
      this._rebuildAtlas();
    } else if (name === "density") this.density = Number(value);
    else if (name === "chars") {
      this.chars = value;
      this._rebuildAtlas();
    } else if (name === "font") {
      this.fontFamily = value;
      this._rebuildAtlas();
    }
  }

  _rebuildAtlas() {
    this.atlas?.texture?.destroy();
    const { canvas, charCount } = generateFontAtlasCanvas(
      this.chars,
      this.blockSize,
      this.fontFamily,
    );
    this.charCount = charCount;
    this.atlas = uploadImageTexture(this.device, canvas);
  }

  _uniformData(width, height, cols, rows, cellSize) {
    this.uniformData[0] = width;
    this.uniformData[1] = height;
    this.uniformData[2] = cols;
    this.uniformData[3] = rows;
    this.uniformData[4] = cellSize;
    this.uniformData[5] = cellSize;
    this.uniformData[6] = this.charCount;
    this.uniformData[7] = this.alphaThreshold;
    this.uniformData[8] = this.fillMode === "Transparent" ? 1 : 0;
    this.uniformData[9] = this.textColorMode === "Custom" ? 1 : 0;
    this.uniformData[10] = this.overlay === "Yes" ? 1 : 0;
    this.uniformData[11] = this.mode === "Threshold" ? 1 : 0;
    this.uniformData[12] = this.low;
    this.uniformData[13] = this.high;
    this.uniformData[14] = 0;
    this.uniformData[15] = 0;
    this.uniformData[16] = this.fill[0];
    this.uniformData[17] = this.fill[1];
    this.uniformData[18] = this.fill[2];
    this.uniformData[19] = 1;
    this.uniformData[20] = this.textColor[0];
    this.uniformData[21] = this.textColor[1];
    this.uniformData[22] = this.textColor[2];
    this.uniformData[23] = 1;
    return this.uniformData;
  }

  render(encoder, state, pool) {
    const cellSize = Math.max(1, this.blockSize / Math.max(0.001, this.density));
    const cols = Math.max(1, Math.floor(state.width / cellSize));
    const rows = Math.max(1, Math.floor(state.height / cellSize));
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
    const output = pool.getTemp(state.width, state.height, [
      state.texture,
      down,
    ]);
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      this._uniformData(state.width, state.height, cols, rows, cellSize),
    );
    const bindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: down.createView() },
        { binding: 1, resource: this.atlas.texture.createView() },
        { binding: 2, resource: state.texture.createView() },
        { binding: 3, resource: this.sampler },
        { binding: 4, resource: output.createView() },
        { binding: 5, resource: { buffer: this.uniformBuffer } },
      ],
    });
    const pass = encoder.beginComputePass();
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(
      Math.ceil(state.width / 8),
      Math.ceil(state.height / 8),
    );
    pass.end();
    pool.returnTemp(down, cols, rows);
    return { texture: output, width: state.width, height: state.height };
  }

  destroy() {
    this.downsample?.destroy();
    this.uniformBuffer?.destroy();
    this.atlas?.texture?.destroy();
  }
}
