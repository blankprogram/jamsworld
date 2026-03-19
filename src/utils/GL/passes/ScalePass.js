import GLPass from "../GLPass.js";
import {
  bindFramebufferCached,
  bindTexture,
  bindVertexArrayCached,
  cacheTextureFilterState,
  setBlendEnabledCached,
  setViewportCached,
  setProgramCached,
} from "../helpers.js";

export default class ScalePass extends GLPass {
  static def = {
    type: "SCALE",
    title: "Scale",
    options: [
      {
        label: "Use Uniform Scale",
        type: "select",
        name: "uniform",
        options: ["Yes", "No"],
        defaultValue: "Yes",
      },
      {
        label: "Scale",
        type: "range",
        name: "scale",
        props: { min: 0.25, max: 8, step: 0.25 },
        defaultValue: 1,
      },
      {
        label: "Scale X",
        type: "range",
        name: "scaleX",
        props: { min: 0.25, max: 8, step: 0.25 },
        defaultValue: 1,
      },
      {
        label: "Scale Y",
        type: "range",
        name: "scaleY",
        props: { min: 0.25, max: 8, step: 0.25 },
        defaultValue: 1,
      },
      {
        label: "Filter",
        type: "select",
        name: "filter",
        options: ["Nearest", "Linear"],
        defaultValue: "Nearest",
      },
    ],
    uniformKeys: [],
    structuralKeys: ["filter", "uniform", "scale", "scaleX", "scaleY"],
  };

  constructor(gl, opts = {}) {
    super(gl, ScalePass.FS, [{ name: "u_texture", type: "1i", value: 0 }]);

    this.gl = gl;
    this.scale = Number(opts.scale ?? 1);
    this.scaleX = Number(opts.scaleX ?? 1);
    this.scaleY = Number(opts.scaleY ?? 1);
    this.filter = opts.filter || "Nearest";
    this.uniform = opts.uniform || "Yes";
    this._filterCache = new WeakMap();
  }

  setOption(name, value) {
    if (name === "scale") this.scale = Number(value);
    else if (name === "scaleX") this.scaleX = Number(value);
    else if (name === "scaleY") this.scaleY = Number(value);
    else if (name === "filter") this.filter = value;
    else if (name === "uniform") this.uniform = value;
  }

  render(gl, state, pool, vao, glState) {
    const sx = this.uniform === "Yes" ? this.scale : this.scaleX;
    const sy = this.uniform === "Yes" ? this.scale : this.scaleY;

    const outW = Math.max(1, Math.round(state.width * sx));
    const outH = Math.max(1, Math.round(state.height * sy));
    const out = pool.getTemp(outW, outH, new Set([state.texture]));

    bindFramebufferCached(gl, out.fbo, glState);
    setViewportCached(gl, 0, 0, outW, outH, glState);
    setBlendEnabledCached(gl, false, glState);

    const minFilter = this.filter === "Nearest" ? gl.NEAREST : gl.LINEAR;
    const magFilter = minFilter;
    const filterStateChanged = cacheTextureFilterState(
      { textureFilterCache: this._filterCache },
      state.texture,
      minFilter,
      magFilter,
    );
    gl.bindTexture(gl.TEXTURE_2D, state.texture);
    if (filterStateChanged) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);

    setProgramCached(gl, this.prog.prog, glState);
    bindTexture(gl, 0, state.texture, this.prog.locs.u_texture);
    this.prog.setUniforms(
      { texture: state.texture, width: state.width, height: state.height },
      { texture: out.tex, width: outW, height: outH },
    );

    bindVertexArrayCached(gl, vao, glState);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return {
      texture: out.tex,
      width: outW,
      height: outH,
      temp: out,
    };
  }
}

ScalePass.FS = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_texture;
out vec4 outColor;

void main() {
  outColor = texture(u_texture, v_uv);
}
`;
