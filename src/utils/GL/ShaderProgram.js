export default class ShaderProgram {
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
      if (loc == null) continue;

      let val =
        typeof u.value === "function" ? u.value(stateIn, stateOut) : u.value;

      if (val === undefined) {
        console.warn(`Uniform ${u.name} has undefined value`);
        continue;
      }

      switch (u.type) {
        case "1f":
          gl.uniform1f(loc, val);
          break;
        case "1i":
          gl.uniform1i(loc, val);
          break;
        case "2f":
          if (!Array.isArray(val) || val.length < 2) {
            console.warn(`Invalid value for uniform ${u.name}:`, val);
            continue;
          }
          gl.uniform2f(loc, val[0], val[1]);
          break;
        case "3f":
          if (!Array.isArray(val) || val.length < 3) {
            console.warn(`Invalid value for uniform ${u.name}:`, val);
            continue;
          }
          gl.uniform3f(loc, val[0], val[1], val[2]);
          break;
        case "3fv":
          gl.uniform3fv(loc, val);
          break;
        case "4f":
          if (!Array.isArray(val) || val.length < 4) {
            console.warn(`Invalid value for uniform ${u.name}:`, val);
            continue;
          }
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
