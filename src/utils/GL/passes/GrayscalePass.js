import GLPass from "../GLPass.js";

export default class GrayscalePass extends GLPass {
  static def = {
    type: "GRAYSCALE",
    title: "Grayscale",
    options: [],
    uniformKeys: [],
    structuralKeys: [],
  };

  constructor(gl) {
    super(gl, GrayscalePass.FS, [{ name: "u_texture", type: "1i", value: 0 }]);
  }
}

GrayscalePass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
out vec4 outColor;
void main() {
  vec4 c = texture(u_texture, v_uv);
  float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
  outColor = vec4(vec3(l), c.a);
}
`;
