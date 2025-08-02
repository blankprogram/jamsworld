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
        props: { min: 1, max: 64, step: 1 },
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
        label: "Fill",
        type: "color",
        name: "fill",
        defaultValue: "#000000",
      },
    ],
    uniformKeys: ["fill"],
    structuralKeys: ["blockSize", "density", "chars", "font"],
  };

  constructor(gl, opts) {
    super(gl, AsciiPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_fontAtlas", type: "1i", value: 1 },
      {
        name: "u_blockSize",
        type: "2f",
        value: [opts.blockSize, opts.blockSize],
      },
      { name: "u_charCount", type: "1f", value: opts.chars.length },
      { name: "u_fill", type: "3f", value: hexToRgbArray(opts.fill) },
      {
        name: "u_alphaThreshold",
        type: "1f",
        value: opts.alphaThreshold || 0.5,
      },
    ]);

    this.gl = gl;
    this.blockSize = opts.blockSize;
    this.chars = opts.chars;
    this.fontFamily = opts.fontFamily || opts.font;
    this.density = opts.density;
    this.alphaThreshold = opts.alphaThreshold || 0.5;
    this.fill = Array.isArray(opts.fill) ? opts.fill : hexToRgbArray(opts.fill);

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
    if (name === "fill") {
      this.fill = hexToRgbArray(value);
      const uniform = this.prog.uniformDefs.find((u) => u.name === "u_fill");
      if (uniform) uniform.value = this.fill;
    }
    if (
      name === "blockSize" ||
      name === "density" ||
      name === "chars" ||
      name === "font"
    ) {
      this[name] = value;
    }
  }

  render(gl, state, pool, vao) {
    const cols = Math.max(
      1,
      Math.floor((state.width / this.blockSize) * this.density),
    );
    const rows = Math.max(
      1,
      Math.floor((state.height / this.blockSize) * this.density),
    );

    const downState = this.downPass.render(
      gl,
      { texture: state.texture, width: cols, height: rows },
      pool,
      vao,
    );

    const outW = cols * this.blockSize;
    const outH = rows * this.blockSize;
    const out = pool.getTemp(outW, outH);

    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo);
    gl.viewport(0, 0, outW, outH);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.prog.use();
    bindTexture(gl, 0, downState.texture, this.prog.locs.u_texture);
    bindTexture(gl, 1, this.atlas, this.prog.locs.u_fontAtlas);

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
uniform sampler2D u_texture, u_fontAtlas;
uniform vec2      u_blockSize;
uniform float     u_charCount, u_alphaThreshold;
uniform vec3      u_fill;
out vec4 outColor;

float luminance(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }

void main() {
  ivec2 frag  = ivec2(gl_FragCoord.xy);
  ivec2 block = frag / ivec2(u_blockSize);
  vec4 src   = texelFetch(u_texture, block, 0);
  float mask = step(u_alphaThreshold, src.a);
  float b    = luminance(src.rgb);
  float idx  = clamp(floor(b*(u_charCount-1.)), 0., u_charCount-1.);
  vec2 local = (gl_FragCoord.xy - vec2(block)*u_blockSize) / u_blockSize;
  vec2 uv    = (vec2(idx,0.) + local) / vec2(u_charCount, 1.);
  float glyph= texture(u_fontAtlas, uv).a;
  vec3  col  = mix(u_fill, src.rgb, glyph);
  outColor = vec4(col, mask);
}
`;
