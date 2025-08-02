import GLPass from "../GLPass.js";

export default class DownsamplePass extends GLPass {
  static def = {
    type: "DOWNSAMPLE",
    title: "Downsample",
    options: [
      {
        label: "Scale",
        type: "range",
        name: "scale",
        props: { min: 0.1, max: 1, step: 0.01 },
        defaultValue: 0.5,
      },
    ],
    uniformKeys: ["scale"],
    structuralKeys: ["scale"],
  };

  constructor(gl, { scale }) {
    super(gl, DownsamplePass.FS, [{ name: "u_texture", type: "1i", value: 0 }]);
    this.scale = scale;
  }

  setOption(name, value) {
    if (name === "scale") this.scale = parseFloat(value);
  }

  render(gl, { texture, width, height }, pool, vao) {
    const w2 = Math.max(1, Math.floor(width * this.scale));
    const h2 = Math.max(1, Math.floor(height * this.scale));
    return super.render(gl, { texture, width: w2, height: h2 }, pool, vao);
  }
}

DownsamplePass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
out vec4 outColor;
void main() {
  outColor = texture(u_texture, v_uv);
}
`;
