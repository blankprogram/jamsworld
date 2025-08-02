import GLPass from "../GLPass.js";

export default class EmbossPass extends GLPass {
  static def = {
    type: "EMBOSS",
    title: "Emboss",
    options: [
      {
        label: "Strength",
        type: "range",
        name: "strength",
        props: { min: 0, max: 5, step: 0.1 },
        defaultValue: 1,
      },
    ],
    uniformKeys: ["u_strength", "u_texelSize"],
    structuralKeys: ["strength"],
  };

  constructor(gl, opts = {}) {
    super(gl, EmbossPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_strength", type: "1f", value: () => this.strength },
      {
        name: "u_texelSize",
        type: "2f",
        value: ({ width, height }) => [1 / width, 1 / height],
      },
    ]);
    this.strength = opts.strength ?? 1;
  }

  setOption(name, value) {
    if (name === "strength")
      this.strength = Math.max(0, parseFloat(value) || 0);
  }
}

EmbossPass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_strength;
uniform vec2 u_texelSize;
out vec4 outColor;

void main() {
  vec2 uv = v_uv;
  float s = u_strength;
  vec3 c00 = texture(u_texture, uv + vec2(-1,-1) * u_texelSize).rgb * -2.0;
  vec3 c10 = texture(u_texture, uv + vec2( 0,-1) * u_texelSize).rgb * -1.0;
  vec3 c20 = texture(u_texture, uv + vec2( 1,-1) * u_texelSize).rgb *  0.0;
  vec3 c01 = texture(u_texture, uv + vec2(-1, 0) * u_texelSize).rgb * -1.0;
  vec3 c11 = texture(u_texture, uv                ).rgb *  1.0;
  vec3 c21 = texture(u_texture, uv + vec2( 1, 0) * u_texelSize).rgb *  1.0;
  vec3 c02 = texture(u_texture, uv + vec2(-1, 1) * u_texelSize).rgb *  0.0;
  vec3 c12 = texture(u_texture, uv + vec2( 0, 1) * u_texelSize).rgb *  1.0;
  vec3 c22 = texture(u_texture, uv + vec2( 1, 1) * u_texelSize).rgb *  2.0;
  vec3 sum = c00 + c10 + c20 + c01 + c11 + c21 + c02 + c12 + c22;
  vec3 embossed = 0.5 + (sum * (s / 8.0));
  outColor = vec4(clamp(embossed, 0.0, 1.0), texture(u_texture, v_uv).a);
}`;
