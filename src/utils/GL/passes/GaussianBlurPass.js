import GLPass from "../GLPass.js";

import { bindTexture } from "../helpers.js";

export default class GaussianBlurPass extends GLPass {
  static def = {
    type: "GAUSSIAN_BLUR",
    title: "Gaussian Blur",
    options: [
      {
        label: "Sigma",
        type: "range",
        name: "sigma",
        props: { min: 0.1, max: 10, step: 0.1 },
        defaultValue: 1.0,
      },
    ],
    structuralKeys: ["sigma"],
    uniformKeys: [
      "u_texture",
      "u_texelSize",
      "u_sigma",
      "u_radius",
      "u_direction",
    ],
  };

  constructor(gl, opts = {}) {
    super(gl, GaussianBlurPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      {
        name: "u_texelSize",
        type: "2f",
        value: ({ width, height }) => [1 / width, 1 / height],
      },
      { name: "u_sigma", type: "1f", value: () => this.sigma },
      { name: "u_radius", type: "1i", value: () => this.radius },
      {
        name: "u_direction",
        type: "2f",
        value: (inState, outState) => outState.u_direction,
      },
    ]);
    this.sigma = opts.sigma ?? 1.0;
    this._updateRadius();
  }

  setOption(name, value) {
    if (name === "sigma") {
      this.sigma = parseFloat(value);
      this._updateRadius();
    }
  }

  _updateRadius() {
    this.radius = Math.ceil(2 * this.sigma);
  }

  render(gl, state, pool, vao) {
    const { texture: srcTex, width, height } = state;

    const passH = pool.getTemp(width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, passH.fbo);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.prog.use();
    bindTexture(gl, 0, srcTex, this.prog.locs.u_texture);
    this.prog.setUniforms(state, { u_direction: [1, 0] });
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const passV = pool.getTemp(width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, passV.fbo);
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    bindTexture(gl, 0, passH.tex, this.prog.locs.u_texture);
    this.prog.setUniforms(state, { u_direction: [0, 1] });
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return { texture: passV.tex, width, height, temp: passV };
  }
}

GaussianBlurPass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_texelSize;
uniform float u_sigma;
uniform int u_radius;
uniform vec2 u_direction;
out vec4 outColor;
void main() {
  float twoSigma2 = 2.0 * u_sigma * u_sigma;
  vec3 sumC = vec3(0.0);
  float sumA = 0.0;
  float sumW = 0.0;
  for (int i = -30; i <= 30; ++i) {
    if (i < -u_radius || i > u_radius) continue;
    float x = float(i);
    float w = exp(-(x*x) / twoSigma2);
    vec2 off = u_direction * (x * u_texelSize);
    vec4 s = texture(u_texture, v_uv + off);
    sumC += s.rgb * w;
    sumA += s.a   * w;
    sumW += w;
  }
  outColor = vec4(sumC / sumW, sumA / sumW);
}`;
