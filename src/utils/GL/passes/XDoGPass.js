import GLPass from "../GLPass.js";
import GaussianBlurPass from "./GaussianBlurPass.js";
import { bindTexture } from "../helpers.js";

export class LabConvertPass extends GLPass {
  static def = {
    type: "LAB_CONVERT",
    title: "RGB→Lab",
    options: [],
    structuralKeys: [],
    uniformKeys: ["u_texture"],
  };

  constructor(gl) {
    super(gl, LabConvertPass.FS, [{ name: "u_texture", type: "1i", value: 0 }]);
  }
}

LabConvertPass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
out vec4 outColor;

// Unity’s RGB→XYZ (D65)
const mat3 rgb2xyz = mat3(
  0.4124, 0.3576, 0.1805,
  0.2126, 0.7152, 0.0722,
  0.0193, 0.1192, 0.9505
);

float pivotXYZ(float n) {
  return (n > 0.008856)
    ? pow(n, 1.0/3.0)
    : (7.787 * n) + (16.0/116.0);
}

vec3 xyz2lab(vec3 v) {
  // normalize by D65 white reference
  v.x /= 95.047;
  v.y /= 100.0;
  v.z /= 108.883;
  float fx = pivotXYZ(v.x);
  float fy = pivotXYZ(v.y);
  float fz = pivotXYZ(v.z);
  return vec3(
    116.0 * fy - 16.0,
    500.0 * (fx - fy),
    200.0 * (fy - fz)
  );
}

void main() {
  vec3 rgb = texture(u_texture, v_uv).rgb; // assume linear input
  vec3 xyz = rgb2xyz * rgb * 100.0;
  vec3 lab = xyz2lab(xyz);
  outColor = vec4(lab, 1.0);
}`;
export class XDoGThresholdPass extends GLPass {
  static def = {
    type: "XDOG_THRESHOLD",
    title: "XDoG Threshold",
    options: [
      {
        label: "p",
        type: "range",
        name: "p",
        props: { min: 0, max: 100, step: 1 },
        defaultValue: 20,
      },
      {
        label: "phi",
        type: "range",
        name: "phi",
        props: { min: 0.01, max: 50, step: 0.01 },
        defaultValue: 10,
      },
      {
        label: "epsilon",
        type: "range",
        name: "epsilon",
        props: { min: 0, max: 1, step: 0.01 },
        defaultValue: 0.5,
      },
    ],
    structuralKeys: ["p", "phi", "epsilon"],
    uniformKeys: ["u_texture", "u_texture2", "u_p", "u_phi", "u_epsilon"],
  };

  constructor(gl, opts = {}) {
    super(gl, XDoGThresholdPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_texture2", type: "1i", value: 1 },
      { name: "u_p", type: "1f", value: () => this.p },
      { name: "u_phi", type: "1f", value: () => this.phi },
      { name: "u_epsilon", type: "1f", value: () => this.epsilon },
    ]);
    this.p = opts.p ?? 20;
    this.phi = opts.phi ?? 10;
    this.epsilon = opts.epsilon ?? 0.5;
  }

  setOption(name, value) {
    this[name] = parseFloat(value);
  }

  render(gl, state, pool, vao) {
    const { texture, texture2, width, height } = state;
    const out = pool.getTemp(width, height);

    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.prog.use();
    bindTexture(gl, 0, texture, this.prog.locs.u_texture);
    bindTexture(gl, 1, texture2, this.prog.locs.u_texture2);
    this.prog.setUniforms(state);

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return {
      texture: out.tex,
      width,
      height,
      temp: out,
    };
  }
}

XDoGThresholdPass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform sampler2D u_texture2;
uniform float u_p;
uniform float u_phi;
uniform float u_epsilon;
out vec4 outColor;

void main() {
  float g1 = texture(u_texture,  v_uv).r;
  float g2 = texture(u_texture2, v_uv).r;
  float S  = g1 + u_p * (g1 - g2);
  float m  = (S >= u_epsilon)
           ? 1.0
           : 1.0 + tanh(u_phi * (S - u_epsilon));
  outColor = vec4(vec3(m), 1.0);
}`;

export class StructureTensorPass extends GLPass {
  static def = {
    type: "STRUCTURE_TENSOR",
    title: "Structure Tensor",
    options: [
      {
        label: "σc",
        type: "range",
        name: "sigmaC",
        props: { min: 0.1, max: 10, step: 0.1 },
        defaultValue: 1.0,
      },
    ],
    structuralKeys: ["sigmaC"],
    uniformKeys: ["u_texture", "u_texelSize", "u_sigmaC"],
  };

  constructor(gl, opts = {}) {
    super(gl, StructureTensorPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      {
        name: "u_texelSize",
        type: "2f",
        value: ({ width, height }) => [1 / width, 1 / height],
      },
      { name: "u_sigmaC", type: "1f", value: () => this.sigmaC },
    ]);
    this.sigmaC = opts.sigmaC ?? 1.0;
    this._blur = new GaussianBlurPass(gl, { sigma: this.sigmaC });
  }

  setOption(name, value) {
    if (name === "sigmaC") {
      this.sigmaC = parseFloat(value);
      this._blur.setOption("sigma", this.sigmaC);
    }
  }

  render(gl, state, pool, vao) {
    const { width, height, texture } = state;

    const raw = pool.getTemp(width, height);
    gl.bindFramebuffer(gl.FRAMEBUFFER, raw.fbo);
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.prog.use();
    bindTexture(gl, 0, texture, this.prog.locs.u_texture);
    this.prog.setUniforms(state);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const blurred = this._blur.render(
      gl,
      { texture: raw.tex, width, height },
      pool,
      vao,
    );

    return blurred;
  }
}

StructureTensorPass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_texelSize;
uniform float u_sigmaC;
out vec4 outColor;

void main(){
  float L = texture(u_texture, v_uv).r;
  float Lx = (texture(u_texture, v_uv + vec2(u_texelSize.x,0)).r -
               texture(u_texture, v_uv - vec2(u_texelSize.x,0)).r) * 0.5;
  float Ly = (texture(u_texture, v_uv + vec2(0,u_texelSize.y)).r -
               texture(u_texture, v_uv - vec2(0,u_texelSize.y)).r) * 0.5;
  float A = Lx * Lx;
  float B = Lx * Ly;
  float C = Ly * Ly;
  outColor = vec4(A, B, B, C);
}`;

export class OrientationPass extends GLPass {
  static def = {
    type: "ORIENTATION",
    title: "Orientation Field",
    options: [],
    structuralKeys: [],
    uniformKeys: ["u_tensor"],
  };

  constructor(gl) {
    super(gl, OrientationPass.FS, [{ name: "u_tensor", type: "1i", value: 0 }]);
  }
}

OrientationPass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_tensor;
out vec2 outColor;

void main(){
  vec4 T = texture(u_tensor, v_uv);
  float A = T.r;
  float B = T.g;
  float C = T.a;
  float theta = 0.5 * atan(2.0 * B, A - C);
  vec2 tangent = vec2(cos(theta + 1.57079632679), sin(theta + 1.57079632679));
  outColor = normalize(tangent);
}`;

export class FlowAlignedBlurPass extends GLPass {
  static def = {
    type: "FLOW_BLUR",
    title: "Flow-Aligned Blur",
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
      "u_directionTex",
      "u_texelSize",
      "u_sigma",
      "u_radius",
      "u_orthogonal",
    ],
  };

  constructor(gl, opts = {}) {
    super(gl, FlowAlignedBlurPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_directionTex", type: "1i", value: 1 },
      {
        name: "u_texelSize",
        type: "2f",
        value: ({ width, height }) => [1 / width, 1 / height],
      },
      { name: "u_sigma", type: "1f", value: () => this.sigma },
      { name: "u_radius", type: "1i", value: () => this.radius },
      {
        name: "u_orthogonal",
        type: "1i",
        value: () => (this.orthogonal ? 1 : 0),
      },
    ]);
    this.sigma = opts.sigma ?? 1.0;
    this.radius = Math.ceil(2 * this.sigma);
    this.orthogonal = opts.orthogonal ?? false;
  }

  setOption(name, value) {
    if (name === "sigma") {
      this.sigma = parseFloat(value);
      this.radius = Math.ceil(2 * this.sigma);
    }
  }

  render(gl, state, pool, vao) {
    const { texture: srcTex, directionTex, width, height } = state;
    const pass = pool.getTemp(width, height);

    gl.bindFramebuffer(gl.FRAMEBUFFER, pass.fbo);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.prog.use();
    bindTexture(gl, 0, srcTex, this.prog.locs.u_texture);
    bindTexture(gl, 1, directionTex, this.prog.locs.u_directionTex);
    this.prog.setUniforms(state);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return { texture: pass.tex, width, height, temp: pass };
  }
}

FlowAlignedBlurPass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform sampler2D u_directionTex;
uniform vec2 u_texelSize;
uniform float u_sigma;
uniform int u_radius;
uniform bool u_orthogonal;
out vec4 outColor;

void main(){
  vec2 dir = texture(u_directionTex, v_uv).xy;
  if (u_orthogonal) {
    dir = vec2(-dir.y, dir.x);
  }
  float twoSigma2 = 2.0 * u_sigma * u_sigma;
  vec3 sumC = vec3(0.0);
  float sumA = 0.0;
  float sumW = 0.0;
  for(int i = -30; i <= 30; ++i) {
    if (abs(i) > u_radius) continue;
    float t = float(i);
    float w = exp(-(t*t) / twoSigma2);
    vec2 off = dir * (t * u_texelSize);
    vec4 s = texture(u_texture, v_uv + off);
    sumC += s.rgb * w;
    sumA += s.a  * w;
    sumW += w;
  }
  outColor = vec4(sumC / sumW, sumA / sumW);
}`;

export default class XDoGPass extends GLPass {
  static def = {
    type: "XDOG",
    title: "XDoG",
    options: [
      {
        label: "σc",
        type: "range",
        name: "sigmaC",
        props: { min: 0.1, max: 10, step: 0.1 },
        defaultValue: 1.0,
      },
      {
        label: "σe",
        type: "range",
        name: "sigmaE",
        props: { min: 0.1, max: 10, step: 0.1 },
        defaultValue: 1.6,
      },
      {
        label: "k",
        type: "range",
        name: "k",
        props: { min: 1.0, max: 10, step: 0.1 },
        defaultValue: 1.6,
      },
      {
        label: "σm",
        type: "range",
        name: "sigmaM",
        props: { min: 0.1, max: 10, step: 0.1 },
        defaultValue: 1.0,
      },
      {
        label: "p",
        type: "range",
        name: "p",
        props: { min: 0, max: 100, step: 1 },
        defaultValue: 20,
      },
      {
        label: "ϕ",
        type: "range",
        name: "phi",
        props: { min: 0.01, max: 50, step: 0.01 },
        defaultValue: 10,
      },
      {
        label: "ε",
        type: "range",
        name: "epsilon",
        props: { min: 0, max: 1, step: 0.01 },
        defaultValue: 0.5,
      },
      {
        label: "σa",
        type: "range",
        name: "sigmaA",
        props: { min: 0.1, max: 10, step: 0.1 },
        defaultValue: 1.0,
      },
    ],
    structuralKeys: [
      "sigmaC",
      "sigmaE",
      "k",
      "sigmaM",
      "p",
      "phi",
      "epsilon",
      "sigmaA",
    ],
    uniformKeys: [],
  };

  constructor(gl, opts = {}) {
    super(gl, XDoGPass.FS, []);

    this.gl = gl;

    this.sigmaC = opts.sigmaC ?? 1.0;
    this.sigmaE = opts.sigmaE ?? 1.6;
    this.k = opts.k ?? 1.6;
    this.sigmaM = opts.sigmaM ?? 1.0;
    this.p = opts.p ?? 20;
    this.phi = opts.phi ?? 10;
    this.epsilon = opts.epsilon ?? 0.5;
    this.sigmaA = opts.sigmaA ?? 1.0;

    this._initSubPasses();
  }

  _initSubPasses() {
    const gl = this.gl;
    this._blurC = new GaussianBlurPass(gl, { sigma: this.sigmaC });
    this._tensor = new StructureTensorPass(gl, { sigmaC: this.sigmaC });
    this._orientation = new OrientationPass(gl);
    this._blurE1 = new FlowAlignedBlurPass(gl, {
      sigma: this.sigmaE,
      orthogonal: true,
    });
    this._blurE2 = new FlowAlignedBlurPass(gl, {
      sigma: this.k * this.sigmaE,
      orthogonal: true,
    });
    this._thresh = new XDoGThresholdPass(gl, {
      p: this.p,
      phi: this.phi,
      epsilon: this.epsilon,
    });
    this._blurM = new FlowAlignedBlurPass(gl, { sigma: this.sigmaM });
    this._blurA = new GaussianBlurPass(gl, { sigma: this.sigmaA });
  }

  setOption(name, value) {
    const v = parseFloat(value);
    this[name] = v;

    switch (name) {
      case "sigmaC":
        this._blurC.setOption("sigma", v);
        this._tensor.setOption("sigmaC", v);
        break;
      case "sigmaE":
        this._blurE1.setOption("sigma", v);
        this._blurE2.setOption("sigma", this.k * v);
        break;
      case "k":
        this._blurE2.setOption("sigma", v * this.sigmaE);
        break;
      case "sigmaM":
        this._blurM.setOption("sigma", v);
        break;
      case "sigmaA":
        this._blurA.setOption("sigma", v);
        break;
      case "p":
      case "phi":
      case "epsilon":
        this._thresh.setOption(name, v);
        break;
      default:
        break;
    }
  }

  render(gl, state, pool, vao) {
    const { texture, width, height } = state;

    const blurC = this._blurC.render(gl, { texture, width, height }, pool, vao);

    const tensor = this._tensor.render(gl, blurC, pool, vao);

    const direction = this._orientation.render(
      gl,
      { texture: tensor.texture, width, height },
      pool,
      vao,
    );

    const flowInput = {
      texture: blurC.texture,
      directionTex: direction.texture,
      width,
      height,
    };
    const blurE1 = this._blurE1.render(gl, flowInput, pool, vao);
    const blurE2 = this._blurE2.render(gl, flowInput, pool, vao);

    const thresh = this._thresh.render(
      gl,
      { texture: blurE1.texture, texture2: blurE2.texture, width, height },
      pool,
      vao,
    );

    const blurM = this._blurM.render(
      gl,
      {
        texture: thresh.texture,
        directionTex: flowInput.directionTex,
        width,
        height,
      },
      pool,
      vao,
    );

    const blurA = this._blurA.render(
      gl,
      { texture: blurM.texture, width, height },
      pool,
      vao,
    );

    return { texture: blurA.texture, width, height, temp: blurA.temp };
  }

  destroy() {
    this._blurC?.destroy?.();
    this._tensor?.destroy?.();
    this._orientation?.destroy?.();
    this._blurE1?.destroy?.();
    this._blurE2?.destroy?.();
    this._thresh?.destroy?.();
    this._blurM?.destroy?.();
    this._blurA?.destroy?.();
  }
}

XDoGPass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
out vec4 outColor;
void main() {
  float m = texture(u_texture, v_uv).r;
  outColor = vec4(vec3(1.0 - m), 1.0);
}`;
