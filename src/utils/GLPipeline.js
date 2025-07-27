import { generateFontAtlasTexture } from "./fontUtils";

const SIMPLE_QUAD_VS = `#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
  vec2 pos = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
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

class GLPass {
  constructor(name, fragShader, uniforms = {}, getOutputResolution = null) {
    this.name = name;
    this.fragShader = fragShader;
    this.uniforms = uniforms;
    this.getOutputResolution = getOutputResolution;
  }
  init(gl) {
    this.gl = gl;
    this.program = this._createProgram(gl, SIMPLE_QUAD_VS, this.fragShader);
    this.locs = this._getUniformLocations(gl, this.program);
  }
  setup(gl, outW, outH, inW, inH) {
    this._setUniforms(gl, this.locs, this.uniforms, outW, outH, inW, inH);
  }
  _getUniformLocations(gl, program) {
    const locs = {};
    const nUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < nUniforms; i++) {
      const info = gl.getActiveUniform(program, i);
      locs[info.name] = gl.getUniformLocation(program, info.name);
    }
    return locs;
  }
  _setUniforms(gl, locs, values, outW, outH, inW, inH) {
    for (const key in values) {
      let val = values[key];
      const loc = locs[key];
      if (loc == null) continue;
      if (typeof val === "function") val = val(outW, outH, inW, inH);
      if (typeof val === "number") gl.uniform1f(loc, val);
      else if (Array.isArray(val)) {
        if (val.length === 2) gl.uniform2f(loc, val[0], val[1]);
        else if (val.length === 3) gl.uniform3f(loc, val[0], val[1], val[2]);
        else if (val.length === 4)
          gl.uniform4f(loc, val[0], val[1], val[2], val[3]);
      }
    }
  }
  _createProgram(gl, vsSrc, fsSrc) {
    const compile = (type, src) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
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

class InvertPass extends GLPass {
  constructor() {
    const INVERT_FS = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform sampler2D u_texture;
    out vec4 outColor;
    void main() {
      vec4 c = texture(u_texture, v_uv);
      outColor = vec4(1.0 - c.rgb, c.a);
    }`;
    super("invert", INVERT_FS);
  }
}

class GaussianBlurPass extends GLPass {
  constructor() {
    const BLUR_FS = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform sampler2D u_texture;
    uniform vec2 u_texelSize;
    out vec4 outColor;
    void main() {
      vec4 sum = vec4(0.0);
      for (int dx = -1; dx <= 1; dx++) {
        for (int dy = -1; dy <= 1; dy++) {
          sum += texture(u_texture, v_uv + vec2(dx, dy) * u_texelSize);
        }
      }
      outColor = sum / 9.0;
    }`;
    super("blur", BLUR_FS, { u_texelSize: (w, h) => [1.0 / w, 1.0 / h] });
  }
}

class AsciiPass extends GLPass {
  constructor(opts) {
    const ASCII_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform sampler2D u_fontAtlas;
uniform vec2 u_blockSize;
uniform float u_charCount;
uniform vec3 u_bgColor;
uniform vec2 u_inputSize;
out vec4 outColor;

float luminance(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

void main() {
  ivec2 frag = ivec2(gl_FragCoord.xy);
  ivec2 block = frag / ivec2(u_blockSize);
  vec2 uv = (vec2(block) + 0.5) * u_blockSize / u_inputSize;
  vec4 src = texture(u_texture, uv);
  if (src.a < 0.01) {
    outColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }
  float idx = clamp(floor(luminance(src.rgb) * (u_charCount - 1.0)), 0.0, u_charCount - 1.0);
  vec2 local = (gl_FragCoord.xy - vec2(block) * u_blockSize) / u_blockSize;
  vec2 atlasUV = (vec2(idx, 0.0) + local) / vec2(u_charCount, 1.0);
  float glyph = texture(u_fontAtlas, atlasUV).a;
  vec3 finalColor = mix(u_bgColor, src.rgb, glyph);
  outColor = vec4(finalColor, 1.0);
}`;
    const getRes = (w, h) => {
      const cols = Math.max(1, Math.floor((w / opts.blockSize) * opts.density));
      const rows = Math.max(1, Math.floor((h / opts.blockSize) * opts.density));
      return { width: cols * opts.blockSize, height: rows * opts.blockSize };
    };
    super(
      "ascii",
      ASCII_FS,
      {
        u_blockSize: [opts.blockSize, opts.blockSize],
        u_charCount: opts.chars.length,
        u_bgColor: opts.bgColor,
        u_inputSize: (w, h) => [w, h],
      },
      getRes,
    );
    this.opts = opts;
    this._atlas = null;
  }
  init(gl) {
    super.init(gl);
    this._atlas = generateFontAtlasTexture(
      gl,
      this.opts.chars,
      this.opts.blockSize,
      this.opts.fontFamily,
    );
  }
  setup(gl, outW, outH, inW, inH) {
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this._atlas);
    gl.uniform1i(this.locs.u_fontAtlas, 1);
    super.setup(gl, outW, outH, inW, inH);
  }
}

export default class GLPipeline {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext("webgl2", {
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
    });
    if (!this.gl) throw new Error("WebGL2 not supported");
    this.passes = [];
    this.quadVAO = this.gl.createVertexArray();
    this.copyProg = this._createProgram(SIMPLE_QUAD_VS, FINAL_COPY_FS);
    this.copyLocs = {
      u_texture: this.gl.getUniformLocation(this.copyProg, "u_texture"),
    };
    this._fboCache = {};
  }
  addPass(pass) {
    pass.init(this.gl);
    this.passes.push(pass);
    return this;
  }
  insertPassBefore(name, pass) {
    const i = this.passes.findIndex((p) => p.name === name);
    if (i >= 0) {
      pass.init(this.gl);
      this.passes.splice(i, 0, pass);
    }
    return this;
  }
  removePass(name) {
    this.passes = this.passes.filter((p) => p.name !== name);
    return this;
  }
  async process(img) {
    const gl = this.gl;
    const tex = this._createTextureFromImage(img);
    let currentTex = tex;
    let currentWidth = img.width;
    let currentHeight = img.height;
    for (const pass of this.passes) {
      const target = pass.getOutputResolution
        ? pass.getOutputResolution(currentWidth, currentHeight)
        : { width: currentWidth, height: currentHeight };
      const fbos = this._getFBOs(target.width, target.height);
      const outFBO = fbos.next();
      gl.viewport(0, 0, target.width, target.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, outFBO.fbo);
      gl.useProgram(pass.program);
      gl.bindVertexArray(this.quadVAO);
      this._bindTexture(gl.TEXTURE0, currentTex, pass.locs.u_texture, 0);
      pass.setup(gl, target.width, target.height, currentWidth, currentHeight);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      currentTex = outFBO.tex;
      currentWidth = target.width;
      currentHeight = target.height;
    }
    this.canvas.width = currentWidth;
    this.canvas.height = currentHeight;
    this._drawFinal(currentTex);
  }
  _getFBOs(w, h) {
    const key = `${w}x${h}`;
    if (!this._fboCache[key]) {
      const fboA = this._makeFBO(w, h);
      const fboB = this._makeFBO(w, h);
      let ping = 0;
      this._fboCache[key] = {
        fbos: [fboA, fboB],
        next() {
          ping = 1 - ping;
          return this.fbos[ping];
        },
      };
    }
    return this._fboCache[key];
  }
  _bindTexture(unit, texture, loc, slot) {
    const gl = this.gl;
    gl.activeTexture(unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (loc) gl.uniform1i(loc, slot);
  }
  _drawFinal(texture) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.copyProg);
    gl.bindVertexArray(this.quadVAO);
    this._bindTexture(gl.TEXTURE0, texture, this.copyLocs.u_texture, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  _createTextureFromImage(img) {
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
  _makeFBO(w, h) {
    const gl = this.gl;
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      w,
      h,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0,
    );
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex };
  }
  _createProgram(vsSrc, fsSrc) {
    const gl = this.gl;
    const compile = (type, src) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
        throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
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

export { GLPass, InvertPass, GaussianBlurPass, AsciiPass };
