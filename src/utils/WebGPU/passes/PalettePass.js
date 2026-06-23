import { GPU_BUFFER_USAGE } from "../constants";
import { createBindGroup, dispatchCompute } from "./shared";

const PALETTE_SHADER = `
struct Params {
  width: f32,
  height: f32,
  paletteCount: f32,
  pad0: f32,
  colors: array<vec4<f32>, 16>,
};

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  if (gid.x >= width || gid.y >= height) {
    return;
  }

  let src = textureLoad(srcTex, vec2<i32>(gid.xy), 0);
  let count = max(1, min(16, i32(params.paletteCount)));
  var best = 1000000.0;
  var pick = vec3<f32>(0.0);

  for (var i = 0; i < 16; i = i + 1) {
    if (i < count) {
      let color = params.colors[i].rgb;
      let d = distance(src.rgb, color);
      if (d < best) {
        best = d;
        pick = color;
      }
    }
  }

  textureStore(dstTex, vec2<i32>(gid.xy), vec4<f32>(pick, src.a));
}
`;

const PALETTES = {
  BlackAndWhite: ["#000000", "#FFFFFF"],
  Gruvbox: [
    "#282828",
    "#fb4934",
    "#b8bb26",
    "#fabd2f",
    "#83a598",
    "#d3869b",
    "#8ec07c",
    "#ebdbb2",
  ],
  Dracula: [
    "#282a36",
    "#ff5555",
    "#50fa7b",
    "#f1fa8c",
    "#bd93f9",
    "#ff79c6",
    "#8be9fd",
    "#f8f8f2",
  ],
  SolarizedDark: [
    "#002b36",
    "#dc322f",
    "#859900",
    "#b58900",
    "#268bd2",
    "#d33682",
    "#2aa198",
    "#eee8d5",
  ],
  Monokai: [
    "#272822",
    "#f92672",
    "#a6e22e",
    "#fd971f",
    "#66d9ef",
    "#9e6ffe",
    "#e6db74",
    "#f8f8f2",
  ],
  Nord: [
    "#2e3440",
    "#bf616a",
    "#a3be8c",
    "#ebcb8b",
    "#81a1c1",
    "#b48ead",
    "#88c0d0",
    "#eceff4",
  ],
  Material: [
    "#F44336",
    "#E91E63",
    "#9C27B0",
    "#673AB7",
    "#3F51B5",
    "#2196F3",
    "#03A9F4",
    "#00BCD4",
  ],
  Kanagawa: ["#7f745b", "#bfa95b", "#d4c787", "#82c0af", "#29526e", "#171f40"],
  Pastel: [
    "#AEC6CF",
    "#FFB347",
    "#77DD77",
    "#FF6961",
    "#FDFD96",
    "#CB99C9",
    "#C23B22",
    "#779ECB",
  ],
  Vaporwave: [
    "#FF77FF",
    "#77FFFF",
    "#FFDD77",
    "#44FF44",
    "#7744FF",
    "#FF4444",
    "#44DDFF",
    "#DD44FF",
  ],
  WebSafe: [
    "#000000",
    "#003300",
    "#006600",
    "#009900",
    "#00CC00",
    "#00FF00",
    "#33FF33",
    "#66FF66",
  ],
  ObraDinn: ["#333319", "#e5ffff"],
};

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const value = parseInt(clean, 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}

export default class WebGPUPalettePass {
  static type = "PALETTE";

  constructor(device, opts = {}) {
    this.device = device;
    this.preset = opts.preset || Object.keys(PALETTES)[0];
    this.customColors = Array.isArray(opts.customColors)
      ? opts.customColors.slice()
      : ["#000000"];
    this.module = device.createShaderModule({ code: PALETTE_SHADER });
    this.pipeline = device.createComputePipeline({
      layout: "auto",
      compute: { module: this.module, entryPoint: "main" },
    });
    this.uniformBuffer = device.createBuffer({
      size: 272,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
    });
    this.uniformData = new Float32Array(68);
    this._updateColors();
  }

  setOption(name, value) {
    if (name === "customColors") this.customColors = value.slice();
    else this.preset = value;
    this._updateColors();
  }

  _updateColors() {
    const source =
      this.preset === "Custom"
        ? this.customColors.filter((hex) => /^#([0-9A-F]{6})$/i.test(hex))
        : PALETTES[this.preset] || [];
    this.paletteCount = Math.max(1, Math.min(16, source.length));
    const colors = source.length ? source : ["#000000"];
    this.colors = new Float32Array(16 * 4);
    for (let i = 0; i < 16; i += 1) {
      const rgb = hexToRgb(colors[Math.min(i, colors.length - 1)]);
      this.colors[i * 4 + 0] = rgb[0];
      this.colors[i * 4 + 1] = rgb[1];
      this.colors[i * 4 + 2] = rgb[2];
      this.colors[i * 4 + 3] = 1;
    }
  }

  render(encoder, state, pool) {
    const output = pool.getTemp(state.width, state.height, state.texture);
    this.uniformData[0] = state.width;
    this.uniformData[1] = state.height;
    this.uniformData[2] = this.paletteCount;
    this.uniformData[3] = 0;
    this.uniformData.set(this.colors, 4);
    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData);

    const bindGroup = createBindGroup(this.device, this.pipeline, [
      { binding: 0, resource: state.texture.createView() },
      { binding: 1, resource: output.createView() },
      { binding: 2, resource: { buffer: this.uniformBuffer } },
    ]);

    dispatchCompute(
      encoder,
      this.pipeline,
      bindGroup,
      state.width,
      state.height,
    );

    return { texture: output, width: state.width, height: state.height };
  }

  destroy() {
    this.uniformBuffer?.destroy();
    this.uniformBuffer = null;
  }
}
