import GLPass from "../GLPass.js";
import { bindTexture } from "../helpers.js";
import atlasUrl from "../../../assets/atlas/minesweeper.png";

let _atlasImg = null;
let _atlasImgPromise = null;

function ensureAtlasImage() {
  if (_atlasImg) return Promise.resolve(_atlasImg);
  if (_atlasImgPromise) return _atlasImgPromise;

  _atlasImgPromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      _atlasImg = img;
      resolve(img);
    };
    img.onerror = reject;
    img.src = atlasUrl;
  });

  return _atlasImgPromise;
}

export default class MinesweeperPass extends GLPass {
  static def = {
    type: "MINESWEEPER",
    title: "Minesweeper",
    options: [
      { label: "Block Size", type: "range", name: "blockSize", props: { min: 1, max: 64, step: 1 }, defaultValue: 17 },
      { label: "Density", type: "range", name: "density", props: { min: 0.25, max: 5, step: 0.25 }, defaultValue: 1 },
      { label: "Alpha Threshold", type: "range", name: "alphaThreshold", props: { min: 0, max: 1, step: 0.01 }, defaultValue: 0.5 },
    ],
    uniformKeys: [],
    structuralKeys: ["blockSize", "density", "alphaThreshold"],
  };

  constructor(gl, opts = {}) {
    super(gl, MinesweeperPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_atlas", type: "1i", value: 1 },
      { name: "u_blockSize", type: "1f", value: () => this.blockSize },
      { name: "u_alphaThreshold", type: "1f", value: () => this.alphaThreshold },
      { name: "u_ready", type: "1f", value: () => (this.atlasTex ? 1 : 0) },
    ]);

    this.gl = gl;

    this.blockSize = opts.blockSize ?? 17;
    this.density = opts.density ?? 1;
    this.alphaThreshold = opts.alphaThreshold ?? 0.5;

    this.invalidate = typeof opts.invalidate === "function" ? opts.invalidate : () => {};

    this.atlasTex = null;
    this._destroyed = false;

    this.downPass = new GLPass(gl, MinesweeperPass.DownsampleFS, [
      { name: "u_texture", type: "1i", value: 0 },
    ]);

    if (_atlasImg) {
      this._uploadAtlas(_atlasImg);
    } else {
      ensureAtlasImage()
        .then((img) => {
          if (this._destroyed) return;
          this._uploadAtlas(img);
          this.invalidate();
        })
        .catch((e) => console.error("Minesweeper atlas failed to load:", atlasUrl, e));
    }
  }

  _uploadAtlas(img) {
    const gl = this.gl;

    if (!this.atlasTex) this.atlasTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.atlasTex);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  setOption(name, value) {
    const v = +value;
    if (name === "blockSize") this.blockSize = v;
    else if (name === "density") this.density = v;
    else if (name === "alphaThreshold") this.alphaThreshold = v;
  }

  render(gl, state, pool, vao) {
    const cols = Math.max(1, Math.floor((state.width / this.blockSize) * this.density));
    const rows = Math.max(1, Math.floor((state.height / this.blockSize) * this.density));

    const downState = this.downPass.render(gl, { texture: state.texture, width: cols, height: rows }, pool, vao);

    const outW = cols * this.blockSize;
    const outH = rows * this.blockSize;
    const out = pool.getTemp(outW, outH);

    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo);
    gl.viewport(0, 0, outW, outH);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.prog.use();
    bindTexture(gl, 0, downState.texture, this.prog.locs.u_texture);

    bindTexture(gl, 1, this.atlasTex || downState.texture, this.prog.locs.u_atlas);

    this.prog.setUniforms(
      { texture: downState.texture, width: cols, height: rows },
      { texture: out.tex, width: outW, height: outH },
    );

    gl.bindVertexArray(vao);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return { texture: out.tex, width: outW, height: outH, temp: out };
  }

  destroy() {
    this._destroyed = true;
    this.prog.destroy();
    this.downPass.destroy();
    if (this.atlasTex) this.gl.deleteTexture(this.atlasTex);
  }
}

MinesweeperPass.DownsampleFS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
out vec4 outColor;
void main(){ outColor = texture(u_texture, v_uv); }
`;

MinesweeperPass.FS = `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_texture;
uniform sampler2D u_atlas;

uniform float u_blockSize;
uniform float u_alphaThreshold;
uniform float u_ready;

out vec4 outColor;

float luminance(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }

void main(){
  if (u_ready < 0.5) {
    outColor = texture(u_texture, v_uv);
    return;
  }

  const int TILE = 17;
  const int COUNT = 14;

  ivec2 frag = ivec2(gl_FragCoord.xy);
  int bs = max(1, int(floor(u_blockSize + 0.5)));

  ivec2 block = frag / ivec2(bs);
  ivec2 local = frag - block * ivec2(bs);

  vec4 src = texelFetch(u_texture, block, 0);
  float mask = step(u_alphaThreshold, src.a);
  if (mask < 0.5) { outColor = vec4(0.0); return; }

  float b = luminance(src.rgb);
  int idx = int(clamp(floor(b * float(COUNT - 1) + 0.0001), 0.0, float(COUNT - 1)));

  int tx = (local.x * TILE) / bs;
  int ty = (local.y * TILE) / bs;

  int ax = idx * TILE + tx;
  int ay = ty;

  vec4 tile = texelFetch(u_atlas, ivec2(ax, ay), 0);
  outColor = vec4(tile.rgb, src.a);
}
`;

