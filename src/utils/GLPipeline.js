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

function hexToRgbArray(hex) {
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
        case "4f":
          gl.uniform4f(loc, val[0], val[1], val[2], val[3]);
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
  }

  use(pass) {
    this.passes.push(pass);
    return this;
  }

  useAscii(opts) {
    return this.use(new AsciiPass(this.gl, opts));
  }

  useInvert() {
    return this.use(new InvertPass(this.gl));
  }
  useGrayscale() {
    return this.use(new GrayscalePass(this.gl));
  }

  useEdge() {
    return this.use(new EdgePass(this.gl));
  }
  usePosterize(opts) {
    return this.use(new PosterizePass(this.gl, opts));
  }
  useBlur(strength = 1) {
    const full = Math.floor(strength);
    const frac = strength - full;
    for (let i = 0; i < full; i++) {
      this.use(new GaussianBlurPass(this.gl, 1));
    }
    if (frac > 0) {
      this.use(new GaussianBlurPass(this.gl, frac));
    }
    return this;
  }

  useSharpen(amount = 1, radius = 1) {
    this.use(new SharpenPass(this.gl, amount, radius));
    return this;
  }
  useFilter(type, opts = {}, img = null) {
    switch (type) {
      case "INVERT":
        return this.useInvert();

      case "GRAYSCALE":
        return this.useGrayscale();

      case "BLUR":
        return this.useBlur(opts.strength);

      case "SHARPEN":
        return this.useSharpen(opts.amount, opts.radius);

      case "EDGE":
        return this.useEdge();

      case "POSTERIZE":
        return this.usePosterize(opts.levels);

      case "ASCII":
        return this.useAscii({
          chars: opts.chars,
          fontFamily: opts.font,
          blockSize: opts.blockSize,
          fill: hexToRgbArray(opts.fill),
          density: opts.density,
          originalSize: img && { width: img.width, height: img.height },
          alphaThreshold: 0.5,
        });

      default:
        console.warn(`Unknown filter type: ${type}`);
        return this;
    }
  }
  async run(img) {
    const gl = this.gl;

    if (this._inputTexture) gl.deleteTexture(this._inputTexture);
    this._inputTexture = this._createTexture(img);

    let state = {
      texture: this._inputTexture,
      width: img.width,
      height: img.height,
    };
    for (let p of this.passes) {
      state = p.render(gl, state, this.pool, this.quadVAO);
    }

    this.canvas.width = state.width;
    this.canvas.height = state.height;

    this._blitToScreen(state);
  }

  _blitToScreen({ texture }) {
    const gl = this.gl;

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    this.copyProg.use();
    bindTexture(gl, 0, texture, this.copyProg.locs.u_texture);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.disable(gl.BLEND);
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

export class InvertPass {
  constructor(gl) {
    this.prog = new ShaderProgram(gl, SIMPLE_QUAD_VS, InvertPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
    ]);
  }

  render(gl, { texture, width, height }, pool, vao) {
    const { fbo, tex } = pool.getPair(width, height).next();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, width, height);

    this.prog.use();
    bindTexture(gl, 0, texture, this.prog.locs.u_texture);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return { texture: tex, width, height };
  }

  destroy() {
    this.prog.destroy();
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

export class GrayscalePass {
  constructor(gl) {
    this.prog = new ShaderProgram(gl, SIMPLE_QUAD_VS, GrayscalePass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
    ]);
  }

  render(gl, { texture, width, height }, pool, vao) {
    const { fbo, tex } = pool.getPair(width, height).next();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, width, height);

    this.prog.use();
    bindTexture(gl, 0, texture, this.prog.locs.u_texture);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return { texture: tex, width, height };
  }

  destroy() {
    this.prog.destroy();
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

export class GaussianBlurPass {
  constructor(gl, strength = 1) {
    this.strength = strength;
    this.prog = new ShaderProgram(gl, SIMPLE_QUAD_VS, GaussianBlurPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      {
        name: "u_texelSize",
        type: "2f",
        value: ({ width, height }) => [1 / width, 1 / height],
      },
      { name: "u_strength", type: "1f", value: () => this.strength },
    ]);
  }

  render(gl, { texture, width, height }, pool, vao) {
    const { fbo, tex } = pool.getPair(width, height).next();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
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
  outColor = mix(orig, blur, u_strength);
}
`;

export class SharpenPass {
  constructor(gl, amount = 1.0, radius = 1.0) {
    this.gl = gl;
    this.amount = amount;
    this.radius = radius;
    this.prog = new ShaderProgram(gl, SIMPLE_QUAD_VS, SharpenPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      {
        name: "u_texelSize",
        type: "2f",
        value: ({ width, height }) => [1 / width, 1 / height],
      },
      { name: "u_radius", type: "1f", value: () => this.radius },
      { name: "u_amount", type: "1f", value: () => this.amount },
    ]);
  }

  render(gl, { texture, width, height }, pool, vao) {
    const { fbo, tex } = pool.getPair(width, height).next();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
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

SharpenPass.FS = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2      u_texelSize;
uniform float     u_radius;
uniform float     u_amount;
out vec4 outColor;

// simple box‐blur; swap in your Gaussian if you like
vec3 blur(vec2 uv) {
  vec3 sum = vec3(0.0);
  int r = int(u_radius);
  int d = 2*r+1;
  for(int i=-r; i<=r; ++i){
    for(int j=-r; j<=r; ++j){
      sum += texture(u_texture, uv + vec2(i,j)*u_texelSize).rgb;
    }
  }
  return sum / float(d*d);
}

void main() {
  vec3 orig   = texture(u_texture, v_uv).rgb;
  vec3 b      = blur(v_uv);
  vec3 mask   = orig - b;
  vec3 result = orig + u_amount * mask;
  outColor     = vec4(clamp(result, 0.0, 1.0), 1.0);
}
`;

export class EdgePass {
  constructor(gl) {
    this.prog = new ShaderProgram(gl, SIMPLE_QUAD_VS, EdgePass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      {
        name: "u_texelSize",
        type: "2f",
        value: ({ width, height }) => [1 / width, 1 / height],
      },
    ]);
  }

  render(gl, { texture, width, height }, pool, vao) {
    const { fbo, tex } = pool.getPair(width, height).next();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
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

export class PosterizePass {
  constructor(gl, levels = 5) {
    this.levels = levels;
    this.prog = new ShaderProgram(gl, SIMPLE_QUAD_VS, PosterizePass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_levels", type: "1f", value: () => this.levels },
    ]);
  }

  render(gl, { texture, width, height }, pool, vao) {
    const { fbo, tex } = pool.getPair(width, height).next();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
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

PosterizePass.FS = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_texture;
uniform float u_levels;
out vec4 outColor;

void main() {
  vec4 c = texture(u_texture, v_uv);
  vec3 p = floor(c.rgb * u_levels) / (u_levels - 1.0);
  outColor = vec4(p, c.a);
}
`;

export class DownsamplePass {
  constructor(gl, { blockSize, density }) {
    this.blockSize = blockSize;
    this.density = density;
    this.prog = new ShaderProgram(gl, SIMPLE_QUAD_VS, DownsamplePass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
    ]);
  }
  render(gl, { texture, width: inW, height: inH }, pool, vao) {
    const cols = Math.max(1, Math.floor((inW / this.blockSize) * this.density));
    const rows = Math.max(1, Math.floor((inH / this.blockSize) * this.density));
    const { fbo, tex } = pool.getPair(cols, rows).next();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, cols, rows);
    this.prog.use();
    bindTexture(gl, 0, texture, this.prog.locs.u_texture);
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return { texture: tex, width: cols, height: rows };
  }
  destroy() {
    this.prog.destroy();
  }
}
DownsamplePass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
out vec4 outColor;
void main() {
  outColor = texture(u_texture, v_uv);
}`;

export class AsciiPass {
  constructor(gl, opts) {
    this.gl = gl;
    this.blockSize = opts.blockSize;
    this.atlas = generateFontAtlasTexture(
      gl,
      opts.chars,
      opts.blockSize,
      opts.fontFamily,
    );
    this.prog = new ShaderProgram(gl, SIMPLE_QUAD_VS, AsciiPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_fontAtlas", type: "1i", value: 1 },
      {
        name: "u_blockSize",
        type: "2f",
        value: [opts.blockSize, opts.blockSize],
      },
      { name: "u_charCount", type: "1f", value: opts.chars.length },
      { name: "u_fill", type: "3f", value: opts.fill },
      { name: "u_alphaThreshold", type: "1f", value: opts.alphaThreshold },
    ]);
    this.down = new DownsamplePass(gl, {
      blockSize: opts.blockSize,
      density: opts.density,
    });
  }

  render(gl, state, pool, vao) {
    const small = this.down.render(gl, state, pool, vao);
    const { texture: smallTex, width: cols, height: rows } = small;
    const outW = cols * this.blockSize;
    const outH = rows * this.blockSize;
    const { fbo, tex } = pool.getPair(outW, outH).next();

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, outW, outH);
    this.prog.use();
    bindTexture(gl, 0, smallTex, this.prog.locs.u_texture);
    bindTexture(gl, 1, this.atlas, this.prog.locs.u_fontAtlas);
    this.prog.setUniforms(
      { texture: smallTex, width: cols, height: rows },
      { texture: tex, width: outW, height: outH },
    );
    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return { texture: tex, width: outW, height: outH };
  }

  destroy() {
    this.prog.destroy();
    this.gl.deleteTexture(this.atlas);
    this.down.destroy();
  }
}
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
