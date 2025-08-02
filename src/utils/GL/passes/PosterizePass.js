import GLPass from "../GLPass.js";

export default class PosterizePass extends GLPass {
  static def = {
    type: "POSTERIZE",
    title: "Posterize",
    options: [
      {
        label: "Levels",
        type: "range",
        name: "levels",
        props: { min: 2, max: 20, step: 1 },
        defaultValue: 5,
      },
    ],
    uniformKeys: ["levels"],
    structuralKeys: [],
  };

  constructor(gl, opts = {}) {
    super(gl, PosterizePass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_levels", type: "1f", value: () => this.levels },
    ]);
    this.levels = Math.max(2, opts.levels ?? 5);
  }

  setOption(name, value) {
    if (name === "levels") this.levels = Math.max(2, parseInt(value) || 2);
  }
}

PosterizePass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_levels;
out vec4 outColor;
void main() {
  vec4 c = texture(u_texture, v_uv);
  float lv = max(2.0, u_levels);
  vec3 p = floor(c.rgb * lv) / lv;
  outColor = vec4(p, c.a);
}
`;
