import ShaderProgram from "./ShaderProgram";
import {
  bindFramebufferCached,
  bindTexture,
  bindVertexArrayCached,
  setBlendEnabledCached,
  setViewportCached,
  setProgramCached,
} from "./helpers.js";
import { SIMPLE_QUAD_VS } from "./GLPipeline";

export default class GLPass {
  constructor(gl, fsSrc, uniforms = []) {
    this.gl = gl;
    this.prog = new ShaderProgram(gl, SIMPLE_QUAD_VS, fsSrc, uniforms);
  }

  setOption(name, value) {}

  render(gl, { texture, width, height }, pool, vao, glState) {
    const temp = pool.getTemp(width, height, new Set([texture]));
    const { fbo, tex } = temp;

    bindFramebufferCached(gl, fbo, glState);
    setViewportCached(gl, 0, 0, width, height, glState);
    setBlendEnabledCached(gl, false, glState);

    setProgramCached(gl, this.prog.prog, glState);
    bindTexture(gl, 0, texture, this.prog.locs.u_texture);
    this.prog.setUniforms({ texture, width, height });

    bindVertexArrayCached(gl, vao, glState);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return { texture: tex, width, height, temp };
  }

  destroy() {
    this.prog.destroy();
  }
}
