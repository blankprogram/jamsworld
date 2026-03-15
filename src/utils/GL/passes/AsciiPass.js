import GLPass from "../GLPass.js";
import { bindTexture, hexToRgbArray } from "../helpers.js";
import { generateFontAtlasTexture } from "../../fontUtils.js";

export default class AsciiPass extends GLPass {
  static def = {
    type: "ASCII",
    title: "ASCII Filter",
    options: [
      {
        label: "Block Size",
        type: "range",
        name: "blockSize",
        props: { min: 1, max: 32, step: 1 },
        defaultValue: 16,
      },
      {
        label: "Density",
        type: "range",
        name: "density",
        props: { min: 0.25, max: 5, step: 0.25 },
        defaultValue: 1,
      },
      {
        label: "Mode",
        type: "select",
        name: "mode",
        options: ["All", "Threshold"],
        defaultValue: "All",
      },
      {
        label: "Low Threshold",
        type: "range",
        name: "low",
        props: { min: 0, max: 1, step: 0.01 },
        defaultValue: 0,
      },
      {
        label: "High Threshold",
        type: "range",
        name: "high",
        props: { min: 0, max: 1, step: 0.01 },
        defaultValue: 1,
      },
      {
        label: "Chars",
        type: "text",
        name: "chars",
        defaultValue: ".:-=+*#%@",
      },
      {
        label: "Font",
        type: "text",
        name: "font",
        defaultValue: "Arial",
      },
      {
        label: "Fill Mode",
        type: "select",
        name: "fillMode",
        options: ["Color", "Transparent"],
        defaultValue: "Color",
      },
      {
        label: "Fill",
        type: "color",
        name: "fill",
        defaultValue: "#000000",
      },
      {
        label: "Text Color Mode",
        type: "select",
        name: "textColorMode",
        options: ["Sampled", "Custom"],
        defaultValue: "Sampled",
      },
      {
        label: "Text Color",
        type: "color",
        name: "textColor",
        defaultValue: "#ffffff",
      },
      {
        label: "Overlay",
        type: "select",
        name: "overlay",
        options: ["No", "Yes"],
        defaultValue: "No",
      },
    ],
    uniformKeys: [
      "fillMode",
      "fill",
      "overlay",
      "mode",
      "low",
      "high",
      "textColorMode",
      "textColor",
    ],
    structuralKeys: ["blockSize", "density", "chars", "font"],
  };

  constructor(gl, opts) {
    super(gl, AsciiPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_fontAtlas", type: "1i", value: 1 },
      { name: "u_background", type: "1i", value: 2 },
      {
        name: "u_cellSize",
        type: "2f",
        value: () => [this.cellSize, this.cellSize],
      },
      { name: "u_charCount", type: "1f", value: () => this.chars.length },
      { name: "u_fill", type: "3f", value: () => this.fill },
      {
        name: "u_fillMode",
        type: "1i",
        value: () => (this.fillMode === "Transparent" ? 1 : 0),
      },
      { name: "u_textColor", type: "3f", value: () => this.textColor },
      {
        name: "u_textColorMode",
        type: "1i",
        value: () => (this.textColorMode === "Custom" ? 1 : 0),
      },
      {
        name: "u_alphaThreshold",
        type: "1f",
        value: () => this.alphaThreshold,
      },
      {
        name: "u_overlay",
        type: "1i",
        value: () => (this.overlay === "Yes" ? 1 : 0),
      },
      {
        name: "u_mode",
        type: "1i",
        value: () => (this.mode === "Threshold" ? 1 : 0),
      },
      {
        name: "u_low",
        type: "1f",
        value: () => this.low,
      },
      {
        name: "u_high",
        type: "1f",
        value: () => this.high,
      },
    ]);

    this.gl = gl;
    this.blockSize = Number(opts.blockSize);
    this.density = Number(opts.density);
    this.cellSize = Math.max(1, this.blockSize / this.density);

    this.chars = opts.chars;
    this.fontFamily = opts.fontFamily || opts.font;
    this.mode = opts.mode || "All";
    this.low = Number(opts.low ?? 0);
    this.high = Number(opts.high ?? 1);
    this.alphaThreshold = Number(opts.alphaThreshold ?? 0.5);

    // fill = cell background colour
    this.fillMode = opts.fillMode || "Color";
    this.fill = Array.isArray(opts.fill) ? opts.fill : hexToRgbArray(opts.fill);

    // glyph/text colour
    this.textColorMode = opts.textColorMode || "Sampled";
    this.textColor = Array.isArray(opts.textColor)
      ? opts.textColor
      : hexToRgbArray(opts.textColor || "#ffffff");

    this.overlay = opts.overlay || "No";

    this.atlas = generateFontAtlasTexture(
      gl,
      this.chars,
      this.blockSize,
      this.fontFamily,
    );

    this.downPass = new GLPass(gl, AsciiPass.DownsampleFS, [
      { name: "u_texture", type: "1i", value: 0 },
    ]);
  }

  setOption(name, value) {
    if (name === "fillMode") {
      this.fillMode = value;
      return;
    }

    if (name === "fill") {
      this.fill = Array.isArray(value) ? value : hexToRgbArray(value);
      return;
    }

    if (name === "textColor") {
      this.textColor = Array.isArray(value) ? value : hexToRgbArray(value);
      return;
    }

    if (name === "textColorMode") {
      this.textColorMode = value;
      return;
    }

    if (name === "overlay") {
      this.overlay = value;
      return;
    }

    if (name === "mode") {
      this.mode = value;
      return;
    }

    if (name === "low") {
      this.low = Number(value);
      return;
    }

    if (name === "high") {
      this.high = Number(value);
      return;
    }

    if (name === "blockSize") {
      this.blockSize = Number(value);
      this.cellSize = Math.max(1, this.blockSize / this.density);
      return;
    }

    if (name === "density") {
      this.density = Number(value);
      this.cellSize = Math.max(1, this.blockSize / this.density);
      return;
    }

    if (name === "chars") {
      this.chars = value;
      return;
    }

    if (name === "font") {
      this.fontFamily = value;
    }
  }

  render(gl, state, pool, vao) {
    const cellSize = Math.max(1, this.blockSize / this.density);

    const cols = Math.max(1, Math.floor(state.width / cellSize));
    const rows = Math.max(1, Math.floor(state.height / cellSize));

    const downState = this.downPass.render(
      gl,
      { texture: state.texture, width: cols, height: rows },
      pool,
      vao,
    );

    const outW = state.width;
    const outH = state.height;
    const out = pool.getTemp(outW, outH);

    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo);
    gl.viewport(0, 0, outW, outH);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.prog.use();
    bindTexture(gl, 0, downState.texture, this.prog.locs.u_texture);
    bindTexture(gl, 1, this.atlas, this.prog.locs.u_fontAtlas);
    bindTexture(gl, 2, state.texture, this.prog.locs.u_background);

    this.prog.setUniforms(
      { texture: downState.texture, width: cols, height: rows },
      { texture: out.tex, width: outW, height: outH },
    );

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return {
      texture: out.tex,
      width: outW,
      height: outH,
      temp: out,
    };
  }

  destroy() {
    this.prog.destroy();
    this.downPass.destroy();
    this.gl.deleteTexture(this.atlas);
  }
}

AsciiPass.DownsampleFS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
out vec4 outColor;
void main() {
  outColor = texture(u_texture, v_uv);
}
`;

AsciiPass.FS = `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_texture;
uniform sampler2D u_fontAtlas;
uniform sampler2D u_background;

uniform vec2  u_cellSize;
uniform float u_charCount;
uniform float u_alphaThreshold;
uniform vec3  u_fill;          // cell background colour
uniform int   u_fillMode;      // 0 = colour, 1 = transparent
uniform vec3  u_textColor;     // custom glyph/text colour
uniform int   u_textColorMode; // 0 = sampled, 1 = custom
uniform int   u_overlay;
uniform int   u_mode;
uniform float u_low;
uniform float u_high;

out vec4 outColor;

float luminance(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

bool inRange(float v) {
  if (u_mode == 0) return true;
  return v >= u_low && v <= u_high;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  ivec2 block = ivec2(floor(frag / u_cellSize));

  vec4 src = texelFetch(u_texture, block, 0);
  vec4 bg = texture(u_background, v_uv);

  float alphaMask = step(u_alphaThreshold, src.a);
  float b = luminance(src.rgb);
  float rangeMask = inRange(b) ? 1.0 : 0.0;
  float activeMask = alphaMask * rangeMask;

  if (activeMask < 0.5) {
    if (u_overlay == 1) {
      outColor = bg;
    } else {
      outColor = vec4(0.0);
    }
    return;
  }

  float idx = clamp(floor(b * (u_charCount - 1.0)), 0.0, u_charCount - 1.0);

  vec2 local = fract(frag / u_cellSize);
  vec2 uv = (vec2(idx, 0.0) + local) / vec2(u_charCount, 1.0);
  float glyph = texture(u_fontAtlas, uv).a;

  vec3 glyphColor = (u_textColorMode == 1) ? u_textColor : src.rgb;

  if (u_fillMode == 1) {
    // transparent fill: only glyph pixels are visible
    if (u_overlay == 1) {
      vec3 col = mix(bg.rgb, glyphColor, glyph);
      outColor = vec4(col, bg.a);
    } else {
      outColor = vec4(glyphColor, glyph);
    }
  } else {
    // coloured fill: fill = cell background, glyphColor = ascii text colour
    vec3 asciiCell = mix(u_fill, glyphColor, glyph);

    if (u_overlay == 1) {
      outColor = vec4(asciiCell, bg.a);
    } else {
      outColor = vec4(asciiCell, 1.0);
    }
  }
}
`;
