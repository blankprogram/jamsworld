import FBOPool from "./FBOPool";
import ShaderProgram from "./ShaderProgram";
import { bindTexture } from "./helpers";

export const SIMPLE_QUAD_VS = `#version 300 es
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

export const FINAL_COPY_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
out vec4 outColor;
void main() {
  outColor = texture(u_texture, vec2(v_uv.x, 1.0 - v_uv.y));
}
`;

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
    this._lastTemp = null;
  }

  use(pass) {
    this.passes.push(pass);
    return this;
  }

  clearPasses() {
    this.passes.forEach((p) => p.destroy?.());
    this.passes = [];

    if (this._lastTemp) {
      this.pool.returnTemp(this._lastTemp);
      this._lastTemp = null;
    }
  }

  destroy() {
    this.clearPasses();

    if (this._inputTexture) {
      this.gl.deleteTexture(this._inputTexture);
      this._inputTexture = null;
    }

    this.copyProg.destroy();
    this.gl.deleteVertexArray(this.quadVAO);
    this.pool.destroy();
  }

  _ensureInputTexture() {
    const gl = this.gl;

    if (this._inputTexture) return this._inputTexture;

    const tex = gl.createTexture();
    if (!tex) throw new Error("Failed to create texture");

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this._inputTexture = tex;
    return tex;
  }

  _setCanvasSize(w, h) {
    if (this.canvas.width !== w) this.canvas.width = w;
    if (this.canvas.height !== h) this.canvas.height = h;
  }

  prepareImage(src) {
    const gl = this.gl;
    const w = src?.width | 0 || 0;
    const h = src?.height | 0 || 0;
    if (w <= 0 || h <= 0) return false;

    const tex = this._ensureInputTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);

    const sizeChanged = this._imgSize.width !== w || this._imgSize.height !== h;

    if (sizeChanged) {
      this._imgSize = { width: w, height: h };
      this._setCanvasSize(w, h);

      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    return true;
  }

  prepareVideo(videoEl) {
    const gl = this.gl;

    const w = videoEl?.videoWidth | 0;
    const h = videoEl?.videoHeight | 0;
    if (w <= 0 || h <= 0) return false;

    const tex = this._ensureInputTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);

    const sizeChanged = this._imgSize.width !== w || this._imgSize.height !== h;
    if (sizeChanged) {
      this._imgSize = { width: w, height: h };
      this._setCanvasSize(w, h);

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
    }

    gl.bindTexture(gl.TEXTURE_2D, null);
    return true;
  }

  updateVideoFrame(videoEl) {
    const gl = this.gl;
    if (!this._inputTexture) return false;

    const w = videoEl?.videoWidth | 0;
    const h = videoEl?.videoHeight | 0;
    if (w <= 0 || h <= 0) return false;

    if (this._imgSize.width !== w || this._imgSize.height !== h) {
      return this.prepareVideo(videoEl);
    }

    gl.bindTexture(gl.TEXTURE_2D, this._inputTexture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      0,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      videoEl,
    );
    gl.bindTexture(gl.TEXTURE_2D, null);

    return true;
  }

  renderFrame() {
    const gl = this.gl;

    const state0 = {
      texture: this._inputTexture,
      width: this._imgSize.width,
      height: this._imgSize.height,
      temp: null,
    };

    let state = state0;

    const pool = this.pool;
    const allTemps = [];

    const trackedPool = {
      getTemp: (w, h) => {
        const temp = pool.getTemp(w, h);
        allTemps.push(temp);
        return temp;
      },
      getPair: (w, h) => pool.getPair(w, h),
    };

    for (const pass of this.passes) {
      state = pass.render(gl, state, trackedPool, this.quadVAO);
    }

    this._setCanvasSize(state.width, state.height);
    this._blitToScreen(state);

    if (this._lastTemp && this._lastTemp !== state.temp) {
      pool.returnTemp(this._lastTemp);
    }
    this._lastTemp = state.temp;

    for (const temp of allTemps) {
      if (temp !== state.temp) pool.returnTemp(temp);
    }

    return state;
  }

  _blitToScreen({ texture }) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.copyProg.use();
    bindTexture(gl, 0, texture, this.copyProg.locs.u_texture);
    gl.bindVertexArray(this.quadVAO);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  clearToTransparent() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  clearInputTexture() {
    const gl = this.gl;

    this._imgSize = { width: 0, height: 0 };

    const tex = this._inputTexture;
    if (!tex) return;

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    );
    gl.bindTexture(gl.TEXTURE_2D, null);

    this._imgSize = { width: 1, height: 1 };
    this._setCanvasSize(1, 1);
  }
}
