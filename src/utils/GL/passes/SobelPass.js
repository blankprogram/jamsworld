import GLPass from "../GLPass.js";

export default class SobelPass extends GLPass {
  static def = {
    type: "SOBEL",
    title: "Sobel Edge Detection",
    options: [],
    structuralKeys: [],
    uniformKeys: ["u_texelSize"],
  };

  constructor(gl, opts = {}) {
    super(gl, SobelPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      {
        name: "u_texelSize",
        type: "2f",
        value: ({ width, height }) => [1 / width, 1 / height],
      },
    ]);
  }
}

SobelPass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_texelSize;
out vec4 outColor;

void main() {
  float gx = 0.0;
  float gy = 0.0;
  gx += -1.0 * texture(u_texture, v_uv + vec2(-u_texelSize.x, -u_texelSize.y)).r;
  gx += -2.0 * texture(u_texture, v_uv + vec2(-u_texelSize.x,  0.0)).r;
  gx += -1.0 * texture(u_texture, v_uv + vec2(-u_texelSize.x,  u_texelSize.y)).r;
  gx +=  1.0 * texture(u_texture, v_uv + vec2( u_texelSize.x, -u_texelSize.y)).r;
  gx +=  2.0 * texture(u_texture, v_uv + vec2( u_texelSize.x,  0.0)).r;
  gx +=  1.0 * texture(u_texture, v_uv + vec2( u_texelSize.x,  u_texelSize.y)).r;

  gy += -1.0 * texture(u_texture, v_uv + vec2(-u_texelSize.x, -u_texelSize.y)).r;
  gy += -2.0 * texture(u_texture, v_uv + vec2( 0.0,           -u_texelSize.y)).r;
  gy += -1.0 * texture(u_texture, v_uv + vec2( u_texelSize.x, -u_texelSize.y)).r;
  gy +=  1.0 * texture(u_texture, v_uv + vec2(-u_texelSize.x,  u_texelSize.y)).r;
  gy +=  2.0 * texture(u_texture, v_uv + vec2( 0.0,            u_texelSize.y)).r;
  gy +=  1.0 * texture(u_texture, v_uv + vec2( u_texelSize.x,  u_texelSize.y)).r;

  float g = length(vec2(gx, gy));
  outColor = vec4(vec3(g), 1.0);
}
`;
