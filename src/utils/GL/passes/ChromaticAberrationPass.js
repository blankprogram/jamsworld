import GLPass from "../GLPass.js";

export default class ChromaticAberrationPass extends GLPass {
  static def = {
    type: "CHROMA",
    title: "Chromatic Aberration",
    options: [
      {
        label: "Strength",
        type: "range",
        name: "strength",
        props: { min: 0, max: 50, step: 1 },
        defaultValue: 10,
      },
    ],
    uniformKeys: ["u_strength", "u_texelSize"],
    structuralKeys: ["strength"],
  };

  constructor(gl, opts = {}) {
    super(gl, ChromaticAberrationPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_strength", type: "1f", value: () => this.strength },
      {
        name: "u_texelSize",
        type: "2f",
        value: ({ width, height }) => [1 / width, 1 / height],
      },
    ]);
    this.strength = opts.strength ?? 10;
  }

  setOption(name, value) {
    if (name === "strength")
      this.strength = Math.max(0, parseFloat(value) || 0);
  }
}

ChromaticAberrationPass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_strength;
uniform vec2 u_texelSize;
out vec4 outColor;

void main() {
  vec2 dir = v_uv - 0.5;
  vec2 disp = dir * u_strength;
  vec2 off = disp * u_texelSize;
  float r = texture(u_texture, v_uv + off).r;
  float g = texture(u_texture, v_uv).g;
  float b = texture(u_texture, v_uv - off).b;
  float a = texture(u_texture, v_uv).a;
  outColor = vec4(r, g, b, a);
}`;
