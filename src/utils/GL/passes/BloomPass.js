import GLPass from "../GLPass.js";

export default class BloomPass extends GLPass {
  static def = {
    type: "BLOOM",
    title: "Bloom",
    options: [
      {
        label: "Strength",
        type: "range",
        name: "strength",
        props: { min: 0, max: 3, step: 0.01 },
        defaultValue: 1,
      },
      {
        label: "Threshold",
        type: "range",
        name: "threshold",
        props: { min: 0, max: 1, step: 0.01 },
        defaultValue: 0.8,
      },
      {
        label: "Blur Radius",
        type: "range",
        name: "radius",
        props: { min: 1, max: 10, step: 1 },
        defaultValue: 5,
      },
    ],
    uniformKeys: ["u_strength", "u_threshold", "u_texelSize", "u_radius"],
    structuralKeys: ["strength", "threshold", "radius"],
  };

  constructor(gl, opts = {}) {
    super(gl, BloomPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      {
        name: "u_strength",
        type: "1f",
        value: () => this.strength,
      },
      {
        name: "u_threshold",
        type: "1f",
        value: () => this.threshold,
      },
      {
        name: "u_texelSize",
        type: "2f",
        value: ({ width, height }) => [1 / width, 1 / height],
      },
      {
        name: "u_radius",
        type: "1i",
        value: () => this.radius,
      },
    ]);
    this.strength = opts.strength ?? 1;
    this.threshold = opts.threshold ?? 0.8;
    this.radius = opts.radius ?? 5;
  }

  setOption(name, value) {
    if (name === "strength")
      this.strength = Math.max(0, parseFloat(value) || 0);
    if (name === "threshold")
      this.threshold = Math.min(1, Math.max(0, parseFloat(value) || 0));
    if (name === "radius")
      this.radius = Math.min(10, Math.max(1, parseInt(value) || 1));
  }
}

BloomPass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_strength;
uniform float u_threshold;
uniform vec2 u_texelSize;
uniform int u_radius;
out vec4 outColor;

float lum(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

void main() {
  vec4 color = texture(u_texture, v_uv);
  float brightness = lum(color.rgb);
  if (brightness < u_threshold) {
    outColor = color;
    return;
  }

  vec3 bloom = vec3(0.0);
  int radius = u_radius;
  float count = 0.0;
  for (int y = -radius; y <= radius; y++) {
    for (int x = -radius; x <= radius; x++) {
      vec2 offset = vec2(float(x), float(y)) * u_texelSize;
      vec3 colSample = texture(u_texture, v_uv + offset).rgb;
      bloom += colSample;
      count += 1.0;
    }
  }
  bloom /= count;
  bloom *= u_strength;
  vec3 result = color.rgb + bloom;
  outColor = vec4(result, color.a);
}
`;
