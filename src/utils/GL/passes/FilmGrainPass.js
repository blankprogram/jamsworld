import GLPass from "../GLPass.js";

export default class FilmGrainPass extends GLPass {
  static def = {
    type: "FILMGRAIN",
    title: "Film Grain",
    options: [
      {
        label: "Intensity",
        type: "range",
        name: "intensity",
        props: { min: 0, max: 0.2, step: 0.001 },
        defaultValue: 0.05,
      },
      {
        label: "Speed",
        type: "range",
        name: "speed",
        props: { min: 0, max: 10, step: 0.1 },
        defaultValue: 1,
      },
    ],
    uniformKeys: ["u_texture", "u_intensity", "u_time"],
    structuralKeys: ["intensity", "speed"],
  };

  constructor(gl, opts = {}) {
    super(gl, FilmGrainPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      {
        name: "u_intensity",
        type: "1f",
        value: () => this.intensity,
      },
      {
        name: "u_time",
        type: "1f",
        value: () => performance.now() * 0.001 * this.speed,
      },
    ]);
    this.intensity = opts.intensity ?? 0.05;
    this.speed = opts.speed ?? 1;
  }

  setOption(name, value) {
    if (name === "intensity")
      this.intensity = Math.max(0, Math.min(1, parseFloat(value) || 0));
    if (name === "speed") this.speed = Math.max(0, parseFloat(value) || 1);
  }
}

FilmGrainPass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_intensity;
uniform float u_time;
out vec4 outColor;

float rand(vec2 co) {
  return fract(sin(dot(co.xy + u_time, vec2(12.9898,78.233))) * 43758.5453);
}

void main() {
  vec4 color = texture(u_texture, v_uv);
  float grain = (rand(gl_FragCoord.xy) - 0.5) * u_intensity;
  outColor = vec4(clamp(color.rgb + grain, 0.0, 1.0), color.a);
}
`;
