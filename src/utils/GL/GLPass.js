import ShaderProgram from "./ShaderProgram";
import { bindTexture } from "./helpers.js";
import { SIMPLE_QUAD_VS } from "./GLPipeline";

export default class GLPass {
  constructor(gl, fsSrc, uniforms = []) {
    this.gl = gl;
    this.prog = new ShaderProgram(gl, SIMPLE_QUAD_VS, fsSrc, uniforms);
  }

  setOption(name, value) {}

  render(gl, { texture, width, height }, pool, vao) {
    const temp = pool.getTemp(width, height, new Set([texture]));
    const { fbo, tex } = temp;

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.viewport(0, 0, width, height);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.prog.use();
    bindTexture(gl, 0, texture, this.prog.locs.u_texture);
    this.prog.setUniforms({ texture, width, height });

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return { texture: tex, width, height, temp };
  }

  destroy() {
    this.prog.destroy();
  }
}
