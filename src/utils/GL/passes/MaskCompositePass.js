import GLPass from "../GLPass.js";
import {
  bindFramebufferCached,
  bindTexture,
  bindVertexArrayCached,
  setBlendEnabledCached,
  setViewportCached,
  setProgramCached,
} from "../helpers.js";

const BLACK_PIXEL = new Uint8Array([0, 0, 0, 0]);

export default class MaskCompositePass extends GLPass {
  constructor(gl, opts = {}) {
    super(gl, MaskCompositePass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_original", type: "1i", value: 1 },
      { name: "u_mask", type: "1i", value: 2 },
      { name: "u_invert", type: "1i", value: () => (this.invert ? 1 : 0) },
    ]);

    this.gl = gl;
    this.invert = !!opts.invert;
    this.maskCanvas = opts.canvas || null;
    this.maskVersion = Number(opts.version ?? 0);
    this.uploadedMaskVersion = -1;
    this.maskTextureSize = { width: 0, height: 0 };

    this.maskTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      BLACK_PIXEL,
    );
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  setOption(name, value) {
    if (name === "invert") {
      this.invert = !!value;
      return;
    }

    if (name === "canvas") {
      this.maskCanvas = value || null;
      this.uploadedMaskVersion = -1;
      return;
    }

    if (name === "version") {
      this.maskVersion = Number(value ?? 0);
    }
  }

  updateMaskTexture() {
    const gl = this.gl;
    const canvas = this.maskCanvas;
    gl.bindTexture(gl.TEXTURE_2D, this.maskTexture);

    if (!canvas || !canvas.width || !canvas.height) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        1,
        1,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        BLACK_PIXEL,
      );
      this.maskTextureSize = { width: 1, height: 1 };
      this.uploadedMaskVersion = this.maskVersion;
      gl.bindTexture(gl.TEXTURE_2D, null);
      return;
    }

    const sizeChanged =
      this.maskTextureSize.width !== canvas.width ||
      this.maskTextureSize.height !== canvas.height;

    if (sizeChanged) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        canvas,
      );
      this.maskTextureSize = { width: canvas.width, height: canvas.height };
    } else {
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        canvas,
      );
    }

    this.uploadedMaskVersion = this.maskVersion;
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  render(gl, state, pool, vao, glState) {
    const { texture, width, height, originalTexture } = state;
    if (!texture || !originalTexture) return state;

    if (this.uploadedMaskVersion !== this.maskVersion) {
      this.updateMaskTexture();
    }

    const temp = pool.getTemp(
      width,
      height,
      new Set([texture, originalTexture, this.maskTexture]),
    );
    const { fbo, tex } = temp;

    bindFramebufferCached(gl, fbo, glState);
    setViewportCached(gl, 0, 0, width, height, glState);
    setBlendEnabledCached(gl, false, glState);

    setProgramCached(gl, this.prog.prog, glState);
    bindTexture(gl, 0, texture, this.prog.locs.u_texture);
    bindTexture(gl, 1, originalTexture, this.prog.locs.u_original);
    bindTexture(gl, 2, this.maskTexture, this.prog.locs.u_mask);
    this.prog.setUniforms();

    bindVertexArrayCached(gl, vao, glState);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return { texture: tex, width, height, temp };
  }

  destroy() {
    super.destroy();
    if (this.maskTexture) {
      this.gl.deleteTexture(this.maskTexture);
      this.maskTexture = null;
    }
  }
}

MaskCompositePass.FS = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_texture;
uniform sampler2D u_original;
uniform sampler2D u_mask;
uniform int u_invert;
out vec4 outColor;

void main() {
  vec2 uv = v_uv;
  vec4 processed = texture(u_texture, uv);
  vec4 original = texture(u_original, uv);

  float maskValue = texture(u_mask, uv).a;
  if (u_invert == 1) {
    maskValue = 1.0 - maskValue;
  }
  maskValue = clamp(maskValue, 0.0, 1.0);

  outColor = mix(original, processed, maskValue);
}
`;
