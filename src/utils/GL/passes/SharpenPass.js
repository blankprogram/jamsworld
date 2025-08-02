import GLPass from "../GLPass.js";

export default class SharpenPass extends GLPass {
  static def = {
    type: "SHARPEN",
    title: "Sharpen",
    options: [
      {
        label: "Amount",
        type: "range",
        name: "amount",
        props: { min: 0, max: 10, step: 0.1 },
        defaultValue: 1,
      },
      {
        label: "Radius",
        type: "range",
        name: "radius",
        props: { min: 1, max: 10, step: 0.5 },
        defaultValue: 1,
      },
    ],
    uniformKeys: ["amount", "radius"],
    structuralKeys: [],
  };

  constructor(gl, opts = {}) {
    super(gl, SharpenPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      {
        name: "u_texelSize",
        type: "2f",
        value: ({ width, height }) => [
          1 / Math.max(1, width),
          1 / Math.max(1, height),
        ],
      },
      { name: "u_radius", type: "1f", value: () => this.radius },
      { name: "u_amount", type: "1f", value: () => this.amount },
    ]);
    this.amount = opts.amount ?? 1.0;
    this.radius = opts.radius ?? 1.0;
  }

  setOption(name, value) {
    if (name === "amount") this.amount = Math.max(0, parseFloat(value) || 0);
    if (name === "radius") this.radius = Math.max(1, parseFloat(value) || 1);
  }
}

SharpenPass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_texelSize;
uniform float u_radius;
uniform float u_amount;
out vec4 outColor;
vec3 blur(vec2 uv) {
  vec3 sum = vec3(0.0);
  int r = int(u_radius);
  int d = 2*r + 1;
  for (int i = -r; i <= r; ++i) {
    for (int j = -r; j <= r; ++j) {
      sum += texture(u_texture, uv + vec2(i,j)*u_texelSize).rgb;
    }
  }
  return sum / float(d * d);
}
void main() {
  vec4 src = texture(u_texture, v_uv);
  vec3 orig = src.rgb;
  vec3 b = blur(v_uv);
  vec3 mask = orig - b;
  vec3 result = orig + u_amount * mask;
  outColor = vec4(clamp(result, 0.0, 1.0), src.a);
}
`;
