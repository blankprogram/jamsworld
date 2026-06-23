import { GPU_BUFFER_USAGE } from "../constants";
import atlasUrl from "../../../assets/atlas/minesweeper.png";
import { loadImage, uploadImageTexture } from "./assetHelpers";
import WebGPUDownsampleStage from "./DownsampleStage";

const MINESWEEPER_SHADER = `
struct Params {
  width: f32,
  height: f32,
  cols: f32,
  rows: f32,
  cellSize: f32,
  alphaThreshold: f32,
  mode: f32,
  overlay: f32,
  low: f32,
  high: f32,
  ready: f32,
  pad0: f32,
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
  let bgUv = frag / vec2<f32>(params.width, params.height);
  let bg = textureSampleLevel(backgroundTex, srcSampler, bgUv, 0.0);
  if (params.ready < 0.5) {
    textureStore(dstTex, vec2<i32>(gid.xy), bg);
    return;
  }

  let block = vec2<i32>(floor(frag / params.cellSize));
  let local = fract(frag / params.cellSize);
  let src = textureLoad(downTex, block, 0);
  let b = luminance(src.rgb);
  let activeAlpha = src.a >= params.alphaThreshold;
  var activeRange = true;
  if (params.mode > 0.5) {
    activeRange = b >= params.low && b <= params.high;
  }

  if (!activeAlpha || !activeRange) {
    textureStore(dstTex, vec2<i32>(gid.xy), select(vec4<f32>(0.0), bg, params.overlay > 0.5));
    return;
  }

  let tile = 17;
  let count = 14;
  let idx = i32(clamp(floor(b * f32(count - 1) + 0.0001), 0.0, f32(count - 1)));
  let tx = clamp(i32(floor(local.x * f32(tile))), 0, tile - 1);
  let ty = clamp(i32(floor(local.y * f32(tile))), 0, tile - 1);
  let atlasCoord = vec2<i32>(idx * tile + tx, ty);
  let tileColor = textureLoad(atlasTex, atlasCoord, 0);

  if (params.overlay > 0.5) {
    textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(tileColor.rgb, bg.a));
  } else {
    textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(tileColor.rgb, 1.0));
  }
}
`;

export default class WebGPUMinesweeperPass {
  static type = "MINESWEEPER";

  constructor(device, opts = {}) {
    this.device = device;
    this.blockSize = Number(opts.blockSize ?? 17);
    this.mode = opts.mode || "All";
    this.low = Number(opts.low ?? 0);
    this.high = Number(opts.high ?? 1);
    this.alphaThreshold = Number(opts.alphaThreshold ?? 0.5);
    this.overlay = opts.overlay || "No";
    this.invalidate =
      typeof opts.invalidate === "function" ? opts.invalidate : () => {};

    this.downsample = new WebGPUDownsampleStage(device);
    this.module = device.createShaderModule({ code: MINESWEEPER_SHADER });
    this.pipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module: this.module, entryPoint: "main" },
    });
    this.uniformBuffer = device.createBuffer({
      size: 48,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
    });
    this.uniformData = new Float32Array(12);
    this.sampler = device.createSampler({
      addressModeU: "clamp-to-edge",
      addressModeV: "clamp-to-edge",
      magFilter: "nearest",
      minFilter: "nearest",
    });
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
      .catch((err) => console.error("Minesweeper atlas failed to load:", atlasUrl, err));
  }

  setOption(name, value) {
    if (name === "blockSize") this.blockSize = Number(value);
    else if (name === "mode") this.mode = value;
    else if (name === "low") this.low = Number(value);
    else if (name === "high") this.high = Number(value);
    else if (name === "alphaThreshold") this.alphaThreshold = Number(value);
    else if (name === "overlay") this.overlay = value;
  }

  _uniformData(width, height, cols, rows, cellSize) {
    this.uniformData[0] = width;
    this.uniformData[1] = height;
    this.uniformData[2] = cols;
    this.uniformData[3] = rows;
    this.uniformData[4] = cellSize;
    this.uniformData[5] = this.alphaThreshold;
    this.uniformData[6] = this.mode === "Threshold" ? 1 : 0;
    this.uniformData[7] = this.overlay === "Yes" ? 1 : 0;
    this.uniformData[8] = this.low;
    this.uniformData[9] = this.high;
    this.uniformData[10] = this.ready ? 1 : 0;
    this.uniformData[11] = 0;
    return this.uniformData;
  }

  render(encoder, state, pool) {
    const cellSize = Math.max(1, this.blockSize);
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
        { binding: 1, resource: (this.atlas?.texture || state.texture).createView() },
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
    this._destroyed = true;
    this.downsample?.destroy();
    this.uniformBuffer?.destroy();
    this.atlas?.texture?.destroy();
  }
}
