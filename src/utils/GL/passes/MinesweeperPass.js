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
      {
        label: "Block Size",
        type: "range",
        name: "blockSize",
        props: { min: 1, max: 64, step: 1 },
        defaultValue: 17,
      },
      {
        label: "Mode",
        type: "select",
        name: "mode",
        options: ["All", "Threshold"],
        defaultValue: "All",
      },
      {
        label: "Low Threshold",
        type: "range",
        name: "low",
        props: { min: 0, max: 1, step: 0.01 },
        defaultValue: 0,
      },
      {
        label: "High Threshold",
        type: "range",
        name: "high",
        props: { min: 0, max: 1, step: 0.01 },
        defaultValue: 1,
      },
      {
        label: "Alpha Threshold",
        type: "range",
        name: "alphaThreshold",
        props: { min: 0, max: 1, step: 0.01 },
        defaultValue: 0.5,
      },
      {
        label: "Overlay",
        type: "select",
        name: "overlay",
        options: ["No", "Yes"],
        defaultValue: "No",
      },
    ],
    uniformKeys: [],
    structuralKeys: [
      "blockSize",
      "mode",
      "low",
      "high",
      "alphaThreshold",
      "overlay",
    ],
  };

  constructor(gl, opts = {}) {
    super(gl, MinesweeperPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_atlas", type: "1i", value: 1 },
      { name: "u_background", type: "1i", value: 2 },
      { name: "u_cellSize", type: "1f", value: () => this.blockSize },
      {
        name: "u_alphaThreshold",
        type: "1f",
        value: () => this.alphaThreshold,
      },
      {
        name: "u_mode",
        type: "1i",
        value: () => (this.mode === "Threshold" ? 1 : 0),
      },
      {
        name: "u_overlay",
        type: "1i",
        value: () => (this.overlay === "Yes" ? 1 : 0),
      },
      { name: "u_low", type: "1f", value: () => this.low },
      { name: "u_high", type: "1f", value: () => this.high },
      { name: "u_ready", type: "1f", value: () => (this.atlasTex ? 1 : 0) },
    ]);

    this.gl = gl;

    this.blockSize = Number(opts.blockSize ?? 17);
    this.mode = opts.mode || "All";
    this.low = Number(opts.low ?? 0);
    this.high = Number(opts.high ?? 1);
    this.alphaThreshold = Number(opts.alphaThreshold ?? 0.5);
    this.overlay = opts.overlay || "No";

    this.invalidate =
      typeof opts.invalidate === "function" ? opts.invalidate : () => {};

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
        .catch((e) =>
          console.error("Minesweeper atlas failed to load:", atlasUrl, e),
        );
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
    if (name === "blockSize") {
      this.blockSize = Number(value);
    } else if (name === "mode") {
      this.mode = value;
    } else if (name === "low") {
      this.low = Number(value);
    } else if (name === "high") {
      this.high = Number(value);
    } else if (name === "alphaThreshold") {
      this.alphaThreshold = Number(value);
    } else if (name === "overlay") {
      this.overlay = value;
    }
  }

  render(gl, state, pool, vao) {
    const cellSize = Math.max(1, this.blockSize);

    const cols = Math.max(1, Math.floor(state.width / cellSize));
    const rows = Math.max(1, Math.floor(state.height / cellSize));

    const downState = this.downPass.render(
      gl,
      { texture: state.texture, width: cols, height: rows },
      pool,
      vao,
    );

    const outW = state.width;
    const outH = state.height;
    const out = pool.getTemp(outW, outH);

    gl.bindFramebuffer(gl.FRAMEBUFFER, out.fbo);
    gl.viewport(0, 0, outW, outH);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    this.prog.use();
    bindTexture(gl, 0, downState.texture, this.prog.locs.u_texture);
    bindTexture(
      gl,
      1,
      this.atlasTex || downState.texture,
      this.prog.locs.u_atlas,
    );
    bindTexture(gl, 2, state.texture, this.prog.locs.u_background);

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
void main() {
  outColor = texture(u_texture, v_uv);
}
`;

MinesweeperPass.FS = `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_texture;
uniform sampler2D u_atlas;
uniform sampler2D u_background;

uniform float u_cellSize;
uniform float u_alphaThreshold;
uniform float u_ready;
uniform int u_mode;
uniform int u_overlay;
uniform float u_low;
uniform float u_high;

out vec4 outColor;

float luminance(vec3 c) {
  return dot(c, vec3(0.299, 0.587, 0.114));
}

bool inRange(float v) {
  if (u_mode == 0) return true;
  return v >= u_low && v <= u_high;
}

void main() {
  if (u_ready < 0.5) {
    outColor = texture(u_background, v_uv);
    return;
  }

  const int TILE = 17;
  const int COUNT = 14;

  vec2 frag = gl_FragCoord.xy;
  ivec2 block = ivec2(floor(frag / u_cellSize));
  vec2 local = fract(frag / u_cellSize);

  vec4 src = texelFetch(u_texture, block, 0);
  vec4 bg = texture(u_background, v_uv);

  float alphaMask = step(u_alphaThreshold, src.a);
  float b = luminance(src.rgb);
  float rangeMask = inRange(b) ? 1.0 : 0.0;
  float activeMask = alphaMask * rangeMask;

  if (activeMask < 0.5) {
    if (u_overlay == 1) {
      outColor = bg;
    } else {
      outColor = vec4(0.0);
    }
    return;
  }

  int idx = int(
    clamp(
      floor(b * float(COUNT - 1) + 0.0001),
      0.0,
      float(COUNT - 1)
    )
  );

  int tx = int(floor(local.x * float(TILE)));
  int ty = int(floor(local.y * float(TILE)));

  tx = clamp(tx, 0, TILE - 1);
  ty = clamp(ty, 0, TILE - 1);

  int ax = idx * TILE + tx;
  int ay = ty;

  vec4 tile = texelFetch(u_atlas, ivec2(ax, ay), 0);

  if (u_overlay == 1) {
    outColor = vec4(tile.rgb, bg.a);
  } else {
    outColor = vec4(tile.rgb, 1.0);
  }
}
`;
