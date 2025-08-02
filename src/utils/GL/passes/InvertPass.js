import GLPass from "../GLPass.js";

export default class InvertPass extends GLPass {
  static def = {
    type: "INVERT",
    title: "Invert",
    options: [],
    uniformKeys: [],
    structuralKeys: [],
  };

  constructor(gl) {
    super(gl, InvertPass.FS, [{ name: "u_texture", type: "1i", value: 0 }]);
  }
}

InvertPass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
out vec4 outColor;
void main() {
  vec4 c = texture(u_texture, v_uv);
  outColor = vec4(1.0 - c.rgb, c.a);
}
`;
