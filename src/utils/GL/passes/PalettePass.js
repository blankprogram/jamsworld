import GLPass from "../GLPass.js";
import { hexToRgbArray } from "../helpers";

export default class PalettePass extends GLPass {
  static presets = {
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
    Kanagawa: [
      "#7f745b",
      "#bfa95b",
      "#d4c787",
      "#82c0af",
      "#29526e",
      "#171f40",
    ],
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
  };

  static def = {
    type: "PALETTE",
    title: "Palette",
    options: [
      {
        label: "Preset",
        type: "select",
        name: "preset",
        options: [...Object.keys(PalettePass.presets), "Custom"],
        defaultValue: Object.keys(PalettePass.presets)[0],
      },
      {
        label: "Custom Colors",
        type: "customColors",
        name: "customColors",
        defaultValue: [],
      },
    ],
    uniformKeys: ["u_paletteCount", "u_palette[0]"],
    structuralKeys: ["preset", "customColors"],
  };

  constructor(gl, opts = {}) {
    super(gl, PalettePass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_paletteCount", type: "1i", value: () => this.colors.length },
      { name: "u_palette[0]", type: "3fv", value: () => this.flatColors },
    ]);

    this.preset = opts.preset || Object.keys(PalettePass.presets)[0];
    this.customColors = Array.isArray(opts.customColors)
      ? opts.customColors.slice()
      : ["#000000"];
    this.updateColors();
  }

  setOption(name, value) {
    if (name === "customColors") {
      this.customColors = value.slice();
    } else {
      this.preset = value;
    }
    this.updateColors();
  }

  updateColors() {
    let arr;
    if (this.preset === "Custom") {
      arr = this.customColors.filter((h) => /^#([0-9A-F]{6})$/i.test(h));
    } else {
      arr = PalettePass.presets[this.preset] || [];
    }

    this.colors = arr.map(hexToRgbArray);

    while (this.colors.length < 16) {
      this.colors.push(this.colors[this.colors.length - 1] || [0, 0, 0]);
    }
    this.flatColors = new Float32Array(this.colors.flat());
  }
}

PalettePass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform int u_paletteCount;
uniform vec3 u_palette[16];
out vec4 outColor;
void main() {
  vec4 src = texture(u_texture, v_uv);
  vec3 c = src.rgb;
  float best = 1e6;
  vec3 pick = vec3(0.0);
  for(int i=0;i<u_paletteCount;i++){
    float d = distance(c, u_palette[i]);
    if(d<best){ best=d; pick=u_palette[i]; }
  }
  outColor = vec4(pick, src.a);
}`;
