import { generateFontAtlasTexture } from "./fontUtils";

const SIMPLE_QUAD_VS = `#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
  vec2 pos = vec2(
    float((gl_VertexID << 1) & 2),
    float(gl_VertexID & 2)
  );
  v_uv = pos;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}
`;

const FINAL_COPY_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
out vec4 outColor;
void main() {
  outColor = texture(u_texture, vec2(v_uv.x, 1.0 - v_uv.y));
}
`;

export function hexToRgbArray(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function bindTexture(gl, unit, tex, uniformLocation) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(uniformLocation, unit);
}

class ShaderProgram {
  constructor(gl, vsSrc, fsSrc, uniforms = []) {
    this.gl = gl;
    this.prog = this._createProgram(vsSrc, fsSrc);
    this.uniformDefs = uniforms;
    this.locs = this._getUniformLocations();
  }

  use() {
    this.gl.useProgram(this.prog);
  }

  setUniforms(stateIn = {}, stateOut = {}) {
    const gl = this.gl;
    for (let u of this.uniformDefs) {
      const loc = this.locs[u.name];
      if (!loc) continue;
      let val =
        typeof u.value === "function" ? u.value(stateIn, stateOut) : u.value;

      switch (u.type) {
        case "1f":
          gl.uniform1f(loc, val);
          break;
        case "1i":
          gl.uniform1i(loc, val);
          break;
        case "2f":
          gl.uniform2f(loc, val[0], val[1]);
          break;
        case "3f":
          gl.uniform3f(loc, val[0], val[1], val[2]);
          break;
        case "3fv":
          gl.uniform3fv(loc, val);
          break;
        case "4f":
          gl.uniform4f(loc, val[0], val[1], val[2], val[3]);
          break;
        default:
          console.warn(`Unknown uniform type: ${u.type}`);
          break;
      }
    }
  }

  destroy() {
    this.gl.deleteProgram(this.prog);
  }

  _getUniformLocations() {
    const gl = this.gl;
    const count = gl.getProgramParameter(this.prog, gl.ACTIVE_UNIFORMS);
    const locs = {};
    for (let i = 0; i < count; i++) {
      const { name } = gl.getActiveUniform(this.prog, i);
      locs[name] = gl.getUniformLocation(this.prog, name);
    }
    return locs;
  }

  _createProgram(vsSrc, fsSrc) {
    const gl = this.gl;
    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    const vs = compile(gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
      throw new Error(gl.getProgramInfoLog(prog));
    return prog;
  }
}

class FBOPool {
  constructor(gl) {
    this.gl = gl;
    this.pool = new Map();
  }

  getPair(w, h) {
    const key = `${w}x${h}`;
    if (!this.pool.has(key)) {
      const make = () => {
        const tex = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
        this.gl.texImage2D(
          this.gl.TEXTURE_2D,
          0,
          this.gl.RGBA,
          w,
          h,
          0,
          this.gl.RGBA,
          this.gl.UNSIGNED_BYTE,
          null,
        );
        this.gl.texParameteri(
          this.gl.TEXTURE_2D,
          this.gl.TEXTURE_MIN_FILTER,
          this.gl.NEAREST,
        );
        this.gl.texParameteri(
          this.gl.TEXTURE_2D,
          this.gl.TEXTURE_MAG_FILTER,
          this.gl.NEAREST,
        );
        const fbo = this.gl.createFramebuffer();
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, fbo);
        this.gl.framebufferTexture2D(
          this.gl.FRAMEBUFFER,
          this.gl.COLOR_ATTACHMENT0,
          this.gl.TEXTURE_2D,
          tex,
          0,
        );
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        return { fbo, tex };
      };
      let ping = 0;
      this.pool.set(key, {
        fbos: [make(), make()],
        next: () => {
          ping = 1 - ping;
          return this.pool.get(key).fbos[ping];
        },
      });
    }
    return this.pool.get(key);
  }

  destroy() {
    for (let { fbos } of this.pool.values()) {
      for (let { fbo, tex } of fbos) {
        this.gl.deleteFramebuffer(fbo);
        this.gl.deleteTexture(tex);
      }
    }
    this.pool.clear();
  }
}

class GLPass {
  constructor(gl, fsSrc, uniforms = []) {
    this.gl = gl;
    this.prog = new ShaderProgram(gl, SIMPLE_QUAD_VS, fsSrc, uniforms);
  }

  setOption(name, value) {}

  render(gl, { texture, width, height }, pool, vao) {
    const { fbo, tex } = pool.getPair(width, height).next();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(0, 0, width, height);

    this.prog.use();
    bindTexture(gl, 0, texture, this.prog.locs.u_texture);
    this.prog.setUniforms({ texture, width, height });

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return { texture: tex, width, height };
  }

  destroy() {
    this.prog.destroy();
  }
}

export default class GLPipeline {
  static for(canvas) {
    return new GLPipeline(canvas);
  }

  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true });
    if (!this.gl) throw new Error("WebGL2 not supported");

    this.passes = [];
    this.pool = new FBOPool(this.gl);
    this.quadVAO = this.gl.createVertexArray();
    this.copyProg = new ShaderProgram(this.gl, SIMPLE_QUAD_VS, FINAL_COPY_FS, [
      { name: "u_texture", type: "1i", value: 0 },
    ]);

    this._inputTexture = null;
    this._imgSize = { width: 0, height: 0 };
  }

  use(pass) {
    this.passes.push(pass);
    return this;
  }

  prepareImage(img, preserve = false) {
    const gl = this.gl;
    if (!preserve && this._inputTexture) {
      gl.deleteTexture(this._inputTexture);
    }
    this._inputTexture = this._createTexture(img);
    this._imgSize = { width: img.width, height: img.height };
    this.canvas.width = img.width;
    this.canvas.height = img.height;
  }

  renderFrame() {
    const gl = this.gl;
    if (!this._inputTexture) return null;

    let state = {
      texture: this._inputTexture,
      width: this._imgSize.width,
      height: this._imgSize.height,
    };

    for (let p of this.passes) {
      state = p.render(gl, state, this.pool, this.quadVAO);
    }

    this.canvas.width = state.width;
    this.canvas.height = state.height;
    this._blitToScreen(state);

    return state;
  }

  _blitToScreen({ texture }) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    this.copyProg.use();
    bindTexture(gl, 0, texture, this.copyProg.locs.u_texture);

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  destroy() {
    if (this._inputTexture) {
      this.gl.deleteTexture(this._inputTexture);
      this._inputTexture = null;
    }
    this.copyProg.destroy();
    this.gl.deleteVertexArray(this.quadVAO);
    this.passes.forEach((p) => p.destroy && p.destroy());
    this.pool.destroy();
  }

  clearPasses() {
    this.passes.forEach((p) => p.destroy && p.destroy());
    this.passes = [];
  }

  _createTexture(img) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    return tex;
  }
}

export class InvertPass extends GLPass {
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

export class GrayscalePass extends GLPass {
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

export class GaussianBlurPass extends GLPass {
  static def = {
    type: "BLUR",
    title: "Gaussian Blur",
    options: [
      {
        label: "Strength",
        type: "range",
        name: "strength",
        props: { min: 0, max: 10, step: 0.1 },
        defaultValue: 1,
      },
    ],
    uniformKeys: ["strength"],
    structuralKeys: ["strength"],
  };

  constructor(gl, opts = {}) {
    super(gl, GaussianBlurPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      {
        name: "u_texelSize",
        type: "2f",
        value: ({ width, height }) => [
          1 / Math.max(1, width),
          1 / Math.max(1, height),
        ],
      },
      { name: "u_strength", type: "1f", value: () => this._currStrength },
    ]);
    this.strength = opts.strength ?? 1.0;
    this._currStrength = 1.0;
  }

  setOption(name, value) {
    if (name === "strength")
      this.strength = Math.max(0, parseFloat(value) || 0);
  }

  render(gl, state, pool, vao) {
    let remaining = this.strength;
    let currTexture = state.texture;

    while (remaining > 0) {
      this._currStrength = Math.min(1.0, remaining);
      remaining -= this._currStrength;
      state = super.render(gl, { ...state, texture: currTexture }, pool, vao);
      currTexture = state.texture;
    }

    return state;
  }
}

GaussianBlurPass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_texelSize;
uniform float u_strength;
out vec4 outColor;
void main() {
  vec4 sum = vec4(0.0);
  for (int i = -1; i <= 1; ++i) {
    for (int j = -1; j <= 1; ++j) {
      sum += texture(u_texture, v_uv + vec2(i, j) * u_texelSize);
    }
  }
  vec4 blur = sum / 9.0;
  vec4 orig = texture(u_texture, v_uv);
  outColor = mix(orig, blur, clamp(u_strength, 0.0, 1.0));
}
`;

export class SharpenPass extends GLPass {
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

export class EdgePass extends GLPass {
  static def = {
    type: "EDGE",
    title: "Edge Detection",
    options: [],
    uniformKeys: [],
    structuralKeys: [],
  };

  constructor(gl) {
    super(gl, EdgePass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      {
        name: "u_texelSize",
        type: "2f",
        value: ({ width, height }) => [1 / width, 1 / height],
      },
    ]);
  }
}

EdgePass.FS = `#version 300 es
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

export class PosterizePass extends GLPass {
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

export class DitherPass extends GLPass {
  static def = {
    type: "DITHER",
    title: "Dithering",
    options: [
      {
        label: "Algorithm",
        type: "select",
        name: "algo",
        options: ["Ordered", "Stochastic", "Halftone"],
        defaultValue: "Ordered",
      },
      {
        label: "Levels",
        type: "range",
        name: "levels",
        props: { min: 1, max: 32, step: 1 },
        defaultValue: 1,
      },
    ],
    uniformKeys: ["u_algo", "u_levels"],
    structuralKeys: ["algo", "levels"],
  };

  constructor(gl, opts = {}) {
    super(gl, DitherPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_algo", type: "1i", value: () => this.algoIndex },
      { name: "u_levels", type: "1f", value: () => this.levels },
    ]);
    this.algoIndex =
      opts.algo === "Stochastic" ? 1 : opts.algo === "Halftone" ? 2 : 0;
    this.levels = opts.levels ?? 2;
  }

  setOption(name, value) {
    if (name === "algo") {
      this.algoIndex =
        value === "Stochastic" ? 1 : value === "Halftone" ? 2 : 0;
    }
    if (name === "levels") {
      this.levels = Math.max(1, parseInt(value, 10) || 1);
    }
  }
}

DitherPass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform int   u_algo;
uniform float u_levels;
out vec4 outColor;

const int bayer4[16] = int[16](
     0,  8,  2, 10,
    12,  4, 14,  6,
     3, 11,  1,  9,
    15,  7, 13,  5
);

float rand(vec2 co){
  return fract(sin(dot(co,vec2(12.9898,78.233)))*43758.5453);
}

mat2 rot(float a){
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

void main(){
  vec4 src = texture(u_texture, v_uv);

  if(u_algo == 2){
    bool isGray = abs(src.r - src.g) < 0.001 && abs(src.r - src.b) < 0.001;
    float a0 = isGray ? radians(45.0) : radians(15.0);
    float a1 = isGray ? radians(45.0) : radians(45.0);
    float a2 = isGray ? radians(45.0) : radians(75.0);
    vec2 p = gl_FragCoord.xy / u_levels;
    vec2 c0 = fract(rot(a0) * p) - 0.5;
    vec2 c1 = fract(rot(a1) * p) - 0.5;
    vec2 c2 = fract(rot(a2) * p) - 0.5;
    float r0 = (1.0 - src.r) * 0.5;
    float r1 = (1.0 - src.g) * 0.5;
    float r2 = (1.0 - src.b) * 0.5;
    float v0 = length(c0) < r0 ? 0.0 : 1.0;
    float v1 = length(c1) < r1 ? 0.0 : 1.0;
    float v2 = length(c2) < r2 ? 0.0 : 1.0;
    outColor = vec4(vec3(v0, v1, v2), src.a);
    return;
  }

  ivec2 pix = ivec2(gl_FragCoord.xy);
  float threshold = (u_algo == 0)
    ? (float(bayer4[(pix.y & 3) * 4 + (pix.x & 3)]) + 0.5) / 16.0
    : rand(gl_FragCoord.xy);
  vec3 q = floor(src.rgb * u_levels + threshold) / u_levels;
  outColor = vec4(q, src.a);
}
`;
export class DownsamplePass extends GLPass {
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

export class AsciiPass extends GLPass {
  static def = {
    type: "ASCII",
    title: "ASCII Filter",
    options: [
      {
        label: "Block Size",
        type: "range",
        name: "blockSize",
        props: { min: 1, max: 64, step: 1 },
        defaultValue: 16,
      },
      {
        label: "Density",
        type: "range",
        name: "density",
        props: { min: 0.25, max: 5, step: 0.25 },
        defaultValue: 1,
      },
      {
        label: "Chars",
        type: "text",
        name: "chars",
        defaultValue: ".:-=+*#%@",
      },
      {
        label: "Font",
        type: "text",
        name: "font",
        defaultValue: "Arial",
      },
      {
        label: "Fill",
        type: "color",
        name: "fill",
        defaultValue: "#000000",
      },
    ],
    uniformKeys: ["fill"],
    structuralKeys: ["blockSize", "density", "chars", "font"],
  };

  constructor(gl, opts) {
    super(gl, AsciiPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_fontAtlas", type: "1i", value: 1 },
      {
        name: "u_blockSize",
        type: "2f",
        value: [opts.blockSize, opts.blockSize],
      },
      { name: "u_charCount", type: "1f", value: opts.chars.length },
      { name: "u_fill", type: "3f", value: hexToRgbArray(opts.fill) },
      {
        name: "u_alphaThreshold",
        type: "1f",
        value: opts.alphaThreshold || 0.5,
      },
    ]);

    this.gl = gl;
    this.blockSize = opts.blockSize;
    this.chars = opts.chars;
    this.fontFamily = opts.fontFamily || opts.font;
    this.density = opts.density;
    this.alphaThreshold = opts.alphaThreshold || 0.5;
    this.fill = Array.isArray(opts.fill) ? opts.fill : hexToRgbArray(opts.fill);

    this.atlas = generateFontAtlasTexture(
      gl,
      this.chars,
      this.blockSize,
      this.fontFamily,
    );

    this.downPass = new GLPass(gl, AsciiPass.DownsampleFS, [
      { name: "u_texture", type: "1i", value: 0 },
    ]);
  }

  setOption(name, value) {
    if (name === "fill") {
      this.fill = hexToRgbArray(value);
      const uniform = this.prog.uniformDefs.find((u) => u.name === "u_fill");
      if (uniform) uniform.value = this.fill;
    }
    if (
      name === "blockSize" ||
      name === "density" ||
      name === "chars" ||
      name === "font"
    ) {
      this[name] = value;
    }
  }

  render(gl, state, pool, vao) {
    const cols = Math.max(
      1,
      Math.floor((state.width / this.blockSize) * this.density),
    );
    const rows = Math.max(
      1,
      Math.floor((state.height / this.blockSize) * this.density),
    );

    const downState = this.downPass.render(
      gl,
      { texture: state.texture, width: cols, height: rows },
      pool,
      vao,
    );

    const outW = cols * this.blockSize;
    const outH = rows * this.blockSize;
    const { fbo, tex } = pool.getPair(outW, outH).next();

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, outW, outH);

    this.prog.use();
    bindTexture(gl, 0, downState.texture, this.prog.locs.u_texture);
    bindTexture(gl, 1, this.atlas, this.prog.locs.u_fontAtlas);
    this.prog.setUniforms(
      { texture: downState.texture, width: cols, height: rows },
      { texture: tex, width: outW, height: outH },
    );

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return { texture: tex, width: outW, height: outH };
  }

  destroy() {
    this.prog.destroy();
    this.downPass.destroy();
    this.gl.deleteTexture(this.atlas);
  }
}

AsciiPass.DownsampleFS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
out vec4 outColor;
void main() {
  outColor = texture(u_texture, v_uv);
}
`;

AsciiPass.FS = `#version 300 es
precision highp float;
uniform sampler2D u_texture, u_fontAtlas;
uniform vec2      u_blockSize;
uniform float     u_charCount, u_alphaThreshold;
uniform vec3      u_fill;
out vec4 outColor;

float luminance(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }

void main() {
  ivec2 frag  = ivec2(gl_FragCoord.xy);
  ivec2 block = frag / ivec2(u_blockSize);
  vec4 src   = texelFetch(u_texture, block, 0);
  float mask = step(u_alphaThreshold, src.a);
  float b    = luminance(src.rgb);
  float idx  = clamp(floor(b*(u_charCount-1.)), 0., u_charCount-1.);
  vec2 local = (gl_FragCoord.xy - vec2(block)*u_blockSize) / u_blockSize;
  vec2 uv    = (vec2(idx,0.) + local) / vec2(u_charCount, 1.);
  float glyph= texture(u_fontAtlas, uv).a;
  vec3  col  = mix(u_fill, src.rgb, glyph);
  outColor = vec4(col, mask);
}
`;

export class PalettePass extends GLPass {
  static presets = {
    BlackAndWhite: ["#000000", "#FFFFFF"],
    Gruvbox: [
      "#282828",
      "#fb4934",
      "#b8bb26",
      "#fabd2f",
      "#83a598",
      "#d3869b",
      "#8ec07c",
      "#ebdbb2",
    ],
    Dracula: [
      "#282a36",
      "#ff5555",
      "#50fa7b",
      "#f1fa8c",
      "#bd93f9",
      "#ff79c6",
      "#8be9fd",
      "#f8f8f2",
    ],
    SolarizedDark: [
      "#002b36",
      "#dc322f",
      "#859900",
      "#b58900",
      "#268bd2",
      "#d33682",
      "#2aa198",
      "#eee8d5",
    ],
    Monokai: [
      "#272822",
      "#f92672",
      "#a6e22e",
      "#fd971f",
      "#66d9ef",
      "#9e6ffe",
      "#e6db74",
      "#f8f8f2",
    ],
    Nord: [
      "#2e3440",
      "#bf616a",
      "#a3be8c",
      "#ebcb8b",
      "#81a1c1",
      "#b48ead",
      "#88c0d0",
      "#eceff4",
    ],

    Material: [
      "#F44336",
      "#E91E63",
      "#9C27B0",
      "#673AB7",
      "#3F51B5",
      "#2196F3",
      "#03A9F4",
      "#00BCD4",
    ],
    Kanagawa: [
      "#7f745b",
      "#bfa95b",
      "#d4c787",
      "#82c0af",
      "#29526e",
      "#171f40",
    ],
    Pastel: [
      "#AEC6CF",
      "#FFB347",
      "#77DD77",
      "#FF6961",
      "#FDFD96",
      "#CB99C9",
      "#C23B22",
      "#779ECB",
    ],
    Vaporwave: [
      "#FF77FF",
      "#77FFFF",
      "#FFDD77",
      "#44FF44",
      "#7744FF",
      "#FF4444",
      "#44DDFF",
      "#DD44FF",
    ],
    WebSafe: [
      "#000000",
      "#003300",
      "#006600",
      "#009900",
      "#00CC00",
      "#00FF00",
      "#33FF33",
      "#66FF66",
    ],
  };

  static def = {
    type: "PALETTE",
    title: "Palette",
    options: [
      {
        label: "Preset",
        type: "select",
        name: "preset",
        options: [...Object.keys(PalettePass.presets), "Custom"],
        defaultValue: Object.keys(PalettePass.presets)[0],
      },
      {
        label: "Custom Colors",
        type: "customColors",
        name: "customColors",
        defaultValue: [],
      },
    ],
    uniformKeys: ["u_paletteCount", "u_palette[0]"],
    structuralKeys: ["preset", "customColors"],
  };

  constructor(gl, opts = {}) {
    super(gl, PalettePass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_paletteCount", type: "1i", value: () => this.colors.length },
      { name: "u_palette[0]", type: "3fv", value: () => this.flatColors },
    ]);

    this.preset = opts.preset || Object.keys(PalettePass.presets)[0];
    this.customColors = Array.isArray(opts.customColors)
      ? opts.customColors.slice()
      : ["#000000"];
    this.updateColors();
  }

  setOption(name, value) {
    if (name === "customColors") {
      this.customColors = value.slice();
    } else {
      this.preset = value;
    }
    this.updateColors();
  }

  updateColors() {
    let arr;
    if (this.preset === "Custom") {
      arr = this.customColors.filter((h) => /^#([0-9A-F]{6})$/i.test(h));
    } else {
      arr = PalettePass.presets[this.preset] || [];
    }

    this.colors = arr.map(hexToRgbArray);

    while (this.colors.length < 16) {
      this.colors.push(this.colors[this.colors.length - 1] || [0, 0, 0]);
    }
    this.flatColors = new Float32Array(this.colors.flat());
  }
}

PalettePass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform int u_paletteCount;
uniform vec3 u_palette[16];
out vec4 outColor;
void main() {
  vec4 src = texture(u_texture, v_uv);
  vec3 c = src.rgb;
  float best = 1e6;
  vec3 pick = vec3(0.0);
  for(int i=0;i<u_paletteCount;i++){
    float d = distance(c, u_palette[i]);
    if(d<best){ best=d; pick=u_palette[i]; }
  }
  outColor = vec4(pick, src.a);
}`;

export class EmbossPass extends GLPass {
  static def = {
    type: "EMBOSS",
    title: "Emboss",
    options: [
      {
        label: "Strength",
        type: "range",
        name: "strength",
        props: { min: 0, max: 5, step: 0.1 },
        defaultValue: 1,
      },
    ],
    uniformKeys: ["u_strength", "u_texelSize"],
    structuralKeys: ["strength"],
  };

  constructor(gl, opts = {}) {
    super(gl, EmbossPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_strength", type: "1f", value: () => this.strength },
      {
        name: "u_texelSize",
        type: "2f",
        value: ({ width, height }) => [1 / width, 1 / height],
      },
    ]);
    this.strength = opts.strength ?? 1;
  }

  setOption(name, value) {
    if (name === "strength")
      this.strength = Math.max(0, parseFloat(value) || 0);
  }
}

EmbossPass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_strength;
uniform vec2 u_texelSize;
out vec4 outColor;

void main() {
  vec2 uv = v_uv;
  float s = u_strength;
  vec3 c00 = texture(u_texture, uv + vec2(-1,-1) * u_texelSize).rgb * -2.0;
  vec3 c10 = texture(u_texture, uv + vec2( 0,-1) * u_texelSize).rgb * -1.0;
  vec3 c20 = texture(u_texture, uv + vec2( 1,-1) * u_texelSize).rgb *  0.0;
  vec3 c01 = texture(u_texture, uv + vec2(-1, 0) * u_texelSize).rgb * -1.0;
  vec3 c11 = texture(u_texture, uv                ).rgb *  1.0;
  vec3 c21 = texture(u_texture, uv + vec2( 1, 0) * u_texelSize).rgb *  1.0;
  vec3 c02 = texture(u_texture, uv + vec2(-1, 1) * u_texelSize).rgb *  0.0;
  vec3 c12 = texture(u_texture, uv + vec2( 0, 1) * u_texelSize).rgb *  1.0;
  vec3 c22 = texture(u_texture, uv + vec2( 1, 1) * u_texelSize).rgb *  2.0;
  vec3 sum = c00 + c10 + c20 + c01 + c11 + c21 + c02 + c12 + c22;
  vec3 embossed = 0.5 + (sum * (s / 8.0));
  outColor = vec4(clamp(embossed, 0.0, 1.0), texture(u_texture, v_uv).a);
}`;

export class ChromaticAberrationPass extends GLPass {
  static def = {
    type: "CHROMA",
    title: "Chromatic Aberration",
    options: [
      {
        label: "Strength",
        type: "range",
        name: "strength",
        props: { min: 0, max: 50, step: 1 },
        defaultValue: 10,
      },
    ],
    uniformKeys: ["u_strength", "u_texelSize"],
    structuralKeys: ["strength"],
  };

  constructor(gl, opts = {}) {
    super(gl, ChromaticAberrationPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_strength", type: "1f", value: () => this.strength },
      {
        name: "u_texelSize",
        type: "2f",
        value: ({ width, height }) => [1 / width, 1 / height],
      },
    ]);
    this.strength = opts.strength ?? 10;
  }

  setOption(name, value) {
    if (name === "strength")
      this.strength = Math.max(0, parseFloat(value) || 0);
  }
}

ChromaticAberrationPass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_strength;
uniform vec2 u_texelSize;
out vec4 outColor;

void main() {
  vec2 dir = v_uv - 0.5;
  vec2 disp = dir * u_strength;
  vec2 off = disp * u_texelSize;
  float r = texture(u_texture, v_uv + off).r;
  float g = texture(u_texture, v_uv).g;
  float b = texture(u_texture, v_uv - off).b;
  float a = texture(u_texture, v_uv).a;
  outColor = vec4(r, g, b, a);
}`;

export class PixelSortPass extends GLPass {
  static def = {
    type: "PIXELSORT",
    title: "Pixel Sort",
    options: [
      {
        label: "Mode",
        type: "select",
        name: "mode",
        options: ["Fully Sorted", "Threshold"],
        defaultValue: "Fully Sorted",
      },
      {
        label: "Low Threshold",
        type: "range",
        name: "low",
        props: { min: 0, max: 1, step: 0.01 },
        defaultValue: 0.2,
      },
      {
        label: "High Threshold",
        type: "range",
        name: "high",
        props: { min: 0, max: 1, step: 0.01 },
        defaultValue: 0.8,
      },
      {
        label: "Sort By",
        type: "select",
        name: "sortBy",
        options: [
          "Luminance",
          "Hue",
          "Saturation",
          "RGB Average",
          "Red",
          "Green",
          "Blue",
        ],
        defaultValue: "Luminance",
      },
      {
        label: "Direction",
        type: "select",
        name: "direction",
        options: ["Up", "Down", "Left", "Right"],
        defaultValue: "Down",
      },
    ],
    structuralKeys: ["mode", "sortBy", "direction"],
    uniformKeys: [
      "u_texture",
      "u_sortBy",
      "u_sortVec",
      "u_width",
      "u_height",
      "u_mode",
      "u_low",
      "u_high",
      "u_pass",
      "u_reverse",
    ],
  };

  constructor(gl, opts = {}) {
    super(gl, PixelSortPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_sortBy", type: "1i", value: () => this.sortByIndex },
      { name: "u_sortVec", type: "2f", value: () => this.sortVec },
      { name: "u_width", type: "1i", value: ({ width }) => width },
      { name: "u_height", type: "1i", value: ({ height }) => height },
      {
        name: "u_mode",
        type: "1i",
        value: () => (this.mode === "Threshold" ? 1 : 0),
      },
      { name: "u_low", type: "1f", value: () => this.low },
      { name: "u_high", type: "1f", value: () => this.high },
      { name: "u_pass", type: "1i", value: () => this.pass },
      { name: "u_reverse", type: "1i", value: () => this.reverse },
    ]);
    this.mode = opts.mode || "Fully Sorted";
    this.low = opts.low ?? 0.2;
    this.high = opts.high ?? 0.8;
    this.sortBy = opts.sortBy || "Luminance";
    this.direction = opts.direction || "Down";
    this.sortByIndex = PixelSortPass.indexMap[this.sortBy];
    this.sortVec = PixelSortPass.dirMap[this.direction].vec;
    this.reverse = PixelSortPass.dirMap[this.direction].reverse ? 1 : 0;
    this.pass = 0;
  }

  setOption(name, value) {
    if (name === "mode") this.mode = value;
    else if (name === "low") this.low = +value;
    else if (name === "high") this.high = +value;
    else if (name === "sortBy") {
      this.sortBy = value;
      this.sortByIndex = PixelSortPass.indexMap[value];
    } else if (name === "direction") {
      this.direction = value;
      this.sortVec = PixelSortPass.dirMap[value].vec;
      this.reverse = PixelSortPass.dirMap[value].reverse ? 1 : 0;
    }
  }

  render(gl, state, pool, vao) {
    const { texture, width, height } = state;
    const vertical = Math.abs(this.sortVec[1]) > Math.abs(this.sortVec[0]);
    const spanLength = vertical ? height : width;
    const passes = spanLength;
    let src = { texture, width, height },
      dst;
    const pair = pool.getPair(width, height);
    for (let i = 0; i < passes; ++i) {
      this.pass = i;
      dst = pair.next();
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, width, height);
      gl.disable(gl.BLEND);
      this.prog.use();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.texture);
      this.prog.setUniforms({
        texture: 0,
        sortBy: this.sortByIndex,
        sortVec: this.sortVec,
        width,
        height,
        mode: this.mode === "Threshold" ? 1 : 0,
        low: this.low,
        high: this.high,
        pass: i,
        reverse: this.reverse,
      });
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      src = { texture: dst.tex, width, height };
    }
    return src;
  }

  static indexMap = {
    Luminance: 0,
    Hue: 1,
    Saturation: 2,
    "RGB Average": 3,
    Red: 4,
    Green: 5,
    Blue: 6,
  };

  static dirMap = {
    Up: { vec: [0, -1], reverse: 1 },
    Down: { vec: [0, 1], reverse: 0 },
    Left: { vec: [-1, 0], reverse: 1 },
    Right: { vec: [1, 0], reverse: 0 },
  };
}
PixelSortPass.FS = `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_texture;
uniform vec2 u_sortVec;
uniform int u_sortBy;
uniform int u_width;
uniform int u_height;
uniform int u_mode;
uniform float u_low;
uniform float u_high;
uniform int u_pass;
uniform int u_reverse;

out vec4 outColor;

vec3 rgb2hsl(vec3 c) {
    float maxC = max(c.r, max(c.g, c.b));
    float minC = min(c.r, min(c.g, c.b));
    float delta = maxC - minC;
    float h = 0.0;

    if (delta > 0.0) {
        if (maxC == c.r)
            h = mod((c.g - c.b) / delta, 6.0);
        else if (maxC == c.g)
            h = (c.b - c.r) / delta + 2.0;
        else
            h = (c.r - c.g) / delta + 4.0;
        h /= 6.0;
        if (h < 0.0) h += 1.0;
    }

    float l = 0.5 * (maxC + minC);
    float s = delta == 0.0 ? 0.0 : delta / (1.0 - abs(2.0 * l - 1.0));
    return vec3(h, s, l);
}

float getKey(vec3 c) {
    vec3 hsl = rgb2hsl(c);
    if (u_sortBy == 0) return hsl.z;
    if (u_sortBy == 1) return hsl.x;
    if (u_sortBy == 2) return hsl.y;
    if (u_sortBy == 3) return (c.r + c.g + c.b) / 3.0;
    if (u_sortBy == 4) return c.r;
    if (u_sortBy == 5) return c.g;
    if (u_sortBy == 6) return c.b;
    return hsl.z;
}

bool inSpan(float key) {
    if (u_mode == 0) return true;
    return key >= u_low && key <= u_high;
}

void main() {
    ivec2 coord = ivec2(gl_FragCoord.xy);

    bool vertical = abs(u_sortVec.y) > abs(u_sortVec.x);
    int spanLength = vertical ? u_height : u_width;
    int axis = vertical ? coord.y : coord.x;
    int perp = vertical ? coord.x : coord.y;

    vec2 uv = vec2(float(coord.x) + 0.5, float(coord.y) + 0.5) / vec2(u_width, u_height);
    vec4 self = texture(u_texture, uv);
    float key = getKey(self.rgb);
    bool selfInSpan = inSpan(key);

    int pairOffset = ((axis + u_pass) % 2 == 0) ? 1 : -1;
    int neighborAxis = axis + pairOffset;
    bool validNeighbor = neighborAxis >= 0 && neighborAxis < spanLength;

    vec2 neighborUV = vertical
        ? vec2(float(perp) + 0.5, float(neighborAxis) + 0.5) / vec2(u_width, u_height)
        : vec2(float(neighborAxis) + 0.5, float(perp) + 0.5) / vec2(u_width, u_height);

    vec4 neighbor = validNeighbor ? texture(u_texture, neighborUV) : self;
    float neighborKey = getKey(neighbor.rgb);
    bool neighborInSpan = validNeighbor ? inSpan(neighborKey) : false;

    bool doSwap = selfInSpan && neighborInSpan;
    bool gt = key > neighborKey;
    bool lt = key < neighborKey;
    bool shouldSwap = doSwap && (
        (u_reverse == 0 && ((pairOffset == 1 && gt) || (pairOffset == -1 && lt))) ||
        (u_reverse == 1 && ((pairOffset == 1 && lt) || (pairOffset == -1 && gt)))
    );

    outColor = shouldSwap ? neighbor : self;
}
`;
