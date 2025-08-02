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
    let state = {
      texture: this._inputTexture,
      width: this._imgSize.width,
      height: this._imgSize.height,
    };

    const frameLiveTemps = new Set([state.texture]);
    const pool = this.pool;
    const trackedPool = {
      getTemp: (w, h) => {
        const temp = pool.getTemp(w, h);
        frameLiveTemps.add(temp.tex);
        return temp;
      },
      getPair: (w, h) => pool.getPair(w, h),
    };

    for (const pass of this.passes) {
      const result = pass.render(this.gl, state, trackedPool, this.quadVAO);
      if (result.temp) frameLiveTemps.add(result.temp.tex);
      state = result;
    }

    this._blitToScreen(state);

    this.pool.releaseAllExcept(frameLiveTemps);
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
