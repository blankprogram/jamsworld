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
  vec4 center = texture(u_texture, v_uv);
  float a = center.a;

  if (a <= 0.0001) {
    outColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  float s = u_strength;

  vec4 t00 = texture(u_texture, v_uv + vec2(-1.0,-1.0) * u_texelSize);
  vec4 t10 = texture(u_texture, v_uv + vec2( 0.0,-1.0) * u_texelSize);
  vec4 t20 = texture(u_texture, v_uv + vec2( 1.0,-1.0) * u_texelSize);
  vec4 t01 = texture(u_texture, v_uv + vec2(-1.0, 0.0) * u_texelSize);
  vec4 t11 = center;
  vec4 t21 = texture(u_texture, v_uv + vec2( 1.0, 0.0) * u_texelSize);
  vec4 t02 = texture(u_texture, v_uv + vec2(-1.0, 1.0) * u_texelSize);
  vec4 t12 = texture(u_texture, v_uv + vec2( 0.0, 1.0) * u_texelSize);
  vec4 t22 = texture(u_texture, v_uv + vec2( 1.0, 1.0) * u_texelSize);

  vec3 sum =
      t00.rgb * -2.0 +
      t10.rgb * -1.0 +
      t20.rgb *  0.0 +
      t01.rgb * -1.0 +
      t11.rgb *  1.0 +
      t21.rgb *  1.0 +
      t02.rgb *  0.0 +
      t12.rgb *  1.0 +
      t22.rgb *  2.0;

  vec3 embossed = 0.5 + (sum * (s / 8.0));
  outColor = vec4(clamp(embossed, 0.0, 1.0), a);
}
`;
