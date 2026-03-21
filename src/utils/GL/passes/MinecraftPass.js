import GLPass from "../GLPass.js";
import {
  bindFramebufferCached,
  bindTexture,
  bindVertexArrayCached,
  setBlendEnabledCached,
  setProgramCached,
  setViewportCached,
} from "../helpers.js";
import atlasUrl from "../../../assets/atlas/minecraft_atlas.png";
import atlasMeta from "../../../assets/atlas/minecraft_atlas.json";

const LUT_LEVELS = 24;
const BLACK_PIXEL = new Uint8Array([0, 0, 0, 0]);

let _atlasImg = null;
let _atlasImgPromise = null;
let _atlasRuntime = null;

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

function srgbToLinear(value) {
  if (value <= 0.04045) return value / 12.92;
  return ((value + 0.055) / 1.055) ** 2.4;
}

function rgbToLab(r, g, b) {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);

  const x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375;
  const y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175;
  const z = rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041;

  const xr = x / 0.95047;
  const yr = y / 1.0;
  const zr = z / 1.08883;

  const epsilon = 216 / 24389;
  const kappa = 24389 / 27;

  const f = (t) => (t > epsilon ? Math.cbrt(t) : (kappa * t + 16) / 116);
  const fx = f(xr);
  const fy = f(yr);
  const fz = f(zr);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function nearestEntryIndex(lab, entries) {
  let bestIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < entries.length; i += 1) {
    const target = entries[i].lab;
    const dl = lab[0] - target[0];
    const da = lab[1] - target[1];
    const db = lab[2] - target[2];
    const dist = dl * dl + da * da + db * db;
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function buildColorLut(entries) {
  const levelCount = LUT_LEVELS;
  const lut = new Uint16Array(levelCount * levelCount * levelCount);
  for (let r = 0; r < levelCount; r += 1) {
    for (let g = 0; g < levelCount; g += 1) {
      for (let b = 0; b < levelCount; b += 1) {
        const rr = (r + 0.5) / levelCount;
        const gg = (g + 0.5) / levelCount;
        const bb = (b + 0.5) / levelCount;
        const lab = rgbToLab(rr, gg, bb);
        const best = nearestEntryIndex(lab, entries);
        const lutIndex = (r * levelCount + g) * levelCount + b;
        lut[lutIndex] = best;
      }
    }
  }
  return lut;
}

function buildAtlasRuntime() {
  if (_atlasRuntime) return _atlasRuntime;

  const tileSize = Math.max(1, Number(atlasMeta?.tile_size ?? 16) || 16);
  const columns = Math.max(1, Number(atlasMeta?.columns ?? 1) || 1);
  const rows = Math.max(1, Number(atlasMeta?.rows ?? 1) || 1);
  const textures = atlasMeta?.textures || {};

  const entries = Object.entries(textures)
    .map(([name, record]) => {
      const atlasX = Number(record?.atlas_x ?? 0);
      const atlasY = Number(record?.atlas_y ?? 0);
      const avgLab = Array.isArray(record?.avg_lab) ? record.avg_lab : null;
      if (!avgLab || avgLab.length < 3) return null;

      const lab0 = Number(avgLab[0]);
      const lab1 = Number(avgLab[1]);
      const lab2 = Number(avgLab[2]);
      if (![lab0, lab1, lab2].every((v) => Number.isFinite(v))) return null;

      return {
        name,
        tileCol: Math.max(0, Math.floor(atlasX / tileSize)),
        tileRow: Math.max(0, Math.floor(atlasY / tileSize)),
        lab: [lab0, lab1, lab2],
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (a.tileRow !== b.tileRow) return a.tileRow - b.tileRow;
      if (a.tileCol !== b.tileCol) return a.tileCol - b.tileCol;
      return a.name.localeCompare(b.name);
    });

  const lut = buildColorLut(entries);
  _atlasRuntime = { tileSize, columns, rows, entries, lut };
  return _atlasRuntime;
}

export default class MinecraftPass extends GLPass {
  static def = {
    type: "MINECRAFT",
    title: "Minecraft",
    options: [
      {
        label: "Block Size",
        type: "range",
        name: "blockSize",
        props: { min: 1, max: 64, step: 1 },
        defaultValue: 16,
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
    structuralKeys: ["blockSize", "alphaThreshold", "overlay"],
  };

  constructor(gl, opts = {}) {
    super(gl, MinecraftPass.FS, [
      { name: "u_tileMap", type: "1i", value: 0 },
      { name: "u_atlas", type: "1i", value: 1 },
      { name: "u_background", type: "1i", value: 2 },
      { name: "u_cellSize", type: "1f", value: () => this.blockSize },
      { name: "u_tileSize", type: "1f", value: () => this.tileSize },
      {
        name: "u_overlay",
        type: "1i",
        value: () => (this.overlay === "Yes" ? 1 : 0),
      },
      { name: "u_ready", type: "1f", value: () => (this.atlasTex ? 1 : 0) },
    ]);

    this.gl = gl;
    this.blockSize = Number(opts.blockSize ?? 16);
    this.mode = opts.mode || "All";
    this.low = Number(opts.low ?? 0);
    this.high = Number(opts.high ?? 1);
    this.alphaThreshold = Number(opts.alphaThreshold ?? 0.5);
    this.overlay = opts.overlay || "No";
    this.invalidate =
      typeof opts.invalidate === "function" ? opts.invalidate : () => {};

    this.runtime = buildAtlasRuntime();
    this.tileSize = this.runtime.tileSize;

    this.atlasTex = null;
    this.readbackFbo = null;
    this.tileMapTex = null;
    this.tileMapSize = { width: 0, height: 0 };
    this.readPixelBuffer = null;
    this.tileMapBuffer = null;
    this._destroyed = false;

    this.downPass = new GLPass(gl, MinecraftPass.DownsampleFS, [
      { name: "u_texture", type: "1i", value: 0 },
    ]);

    this.tileMapTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tileMapTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
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

    if (_atlasImg) {
      this._uploadAtlas(_atlasImg);
    } else {
      ensureAtlasImage()
        .then((img) => {
          if (this._destroyed) return;
          this._uploadAtlas(img);
          this.invalidate();
        })
        .catch((err) =>
          console.error("Minecraft atlas failed to load:", atlasUrl, err),
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

  _ensureBuffers(cols, rows) {
    const needed = cols * rows * 4;
    if (!this.readPixelBuffer || this.readPixelBuffer.length !== needed) {
      this.readPixelBuffer = new Uint8Array(needed);
    }
    if (!this.tileMapBuffer || this.tileMapBuffer.length !== needed) {
      this.tileMapBuffer = new Uint8Array(needed);
    }
  }

  _updateTileMap(gl, downTexture, cols, rows, glState) {
    if (!this.readbackFbo) {
      this.readbackFbo = gl.createFramebuffer();
    }
    this._ensureBuffers(cols, rows);

    bindFramebufferCached(gl, this.readbackFbo, glState);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      downTexture,
      0,
    );

    gl.readPixels(
      0,
      0,
      cols,
      rows,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.readPixelBuffer,
    );

    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      null,
      0,
    );
    bindFramebufferCached(gl, null, glState);

    const levelCount = LUT_LEVELS;
    const lut = this.runtime.lut;
    const entries = this.runtime.entries;
    const alphaThresholdByte = Math.round(
      Math.max(0, Math.min(1, this.alphaThreshold)) * 255,
    );
    const thresholdMode = this.mode === "Threshold";
    const low = Number(this.low);
    const high = Number(this.high);

    const src = this.readPixelBuffer;
    const dst = this.tileMapBuffer;
    for (let i = 0; i < src.length; i += 4) {
      const alpha = src[i + 3];
      if (alpha < alphaThresholdByte) {
        dst[i] = 0;
        dst[i + 1] = 0;
        dst[i + 2] = 0;
        dst[i + 3] = 0;
        continue;
      }

      if (thresholdMode) {
        const luminance =
          (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255;
        if (luminance < low || luminance > high) {
          dst[i] = 0;
          dst[i + 1] = 0;
          dst[i + 2] = 0;
          dst[i + 3] = 0;
          continue;
        }
      }

      const rb = Math.min(levelCount - 1, (src[i] * levelCount) >> 8);
      const gb = Math.min(levelCount - 1, (src[i + 1] * levelCount) >> 8);
      const bb = Math.min(levelCount - 1, (src[i + 2] * levelCount) >> 8);
      const lutIndex = (rb * levelCount + gb) * levelCount + bb;
      const entry = entries[lut[lutIndex]] || entries[0];

      dst[i] = entry?.tileCol ?? 0;
      dst[i + 1] = entry?.tileRow ?? 0;
      dst[i + 2] = 0;
      dst[i + 3] = 255;
    }

    gl.bindTexture(gl.TEXTURE_2D, this.tileMapTex);
    const sizeChanged =
      this.tileMapSize.width !== cols || this.tileMapSize.height !== rows;
    if (sizeChanged) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        cols,
        rows,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.tileMapBuffer,
      );
      this.tileMapSize = { width: cols, height: rows };
    } else {
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        cols,
        rows,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.tileMapBuffer,
      );
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  render(gl, state, pool, vao, glState) {
    const cellSize = Math.max(1, Number(this.blockSize) || 1);
    const cols = Math.max(1, Math.ceil(state.width / cellSize));
    const rows = Math.max(1, Math.ceil(state.height / cellSize));

    const downState = this.downPass.render(
      gl,
      { texture: state.texture, width: cols, height: rows },
      pool,
      vao,
      glState,
    );

    this._updateTileMap(gl, downState.texture, cols, rows, glState);

    const outW = state.width;
    const outH = state.height;
    const out = pool.getTemp(outW, outH);

    bindFramebufferCached(gl, out.fbo, glState);
    setViewportCached(gl, 0, 0, outW, outH, glState);
    setBlendEnabledCached(gl, false, glState);

    setProgramCached(gl, this.prog.prog, glState);
    bindTexture(gl, 0, this.tileMapTex, this.prog.locs.u_tileMap);
    bindTexture(gl, 1, this.atlasTex || state.texture, this.prog.locs.u_atlas);
    bindTexture(gl, 2, state.texture, this.prog.locs.u_background);

    this.prog.setUniforms(
      { texture: this.tileMapTex, width: cols, height: rows },
      { texture: out.tex, width: outW, height: outH },
    );

    bindVertexArrayCached(gl, vao, glState);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    return { texture: out.tex, width: outW, height: outH, temp: out };
  }

  destroy() {
    this._destroyed = true;
    super.destroy();
    this.downPass?.destroy?.();
    if (this.readbackFbo) {
      this.gl.deleteFramebuffer(this.readbackFbo);
      this.readbackFbo = null;
    }
    if (this.tileMapTex) {
      this.gl.deleteTexture(this.tileMapTex);
      this.tileMapTex = null;
    }
    if (this.atlasTex) {
      this.gl.deleteTexture(this.atlasTex);
      this.atlasTex = null;
    }
    this.readPixelBuffer = null;
    this.tileMapBuffer = null;
    this.tileMapSize = { width: 0, height: 0 };
  }
}

MinecraftPass.DownsampleFS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
out vec4 outColor;
void main() {
  outColor = texture(u_texture, v_uv);
}
`;

MinecraftPass.FS = `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_tileMap;
uniform sampler2D u_atlas;
uniform sampler2D u_background;

uniform float u_cellSize;
uniform float u_tileSize;
uniform int u_overlay;
uniform float u_ready;

out vec4 outColor;

void main() {
  vec4 bg = texture(u_background, v_uv);
  if (u_ready < 0.5) {
    outColor = bg;
    return;
  }

  vec2 frag = gl_FragCoord.xy;
  ivec2 block = ivec2(floor(frag / u_cellSize));
  vec2 local = fract(frag / u_cellSize);

  vec4 mapInfo = texelFetch(u_tileMap, block, 0);
  if (mapInfo.a < 0.5) {
    outColor = (u_overlay == 1) ? bg : vec4(0.0);
    return;
  }

  int tileCol = int(floor(mapInfo.r * 255.0 + 0.5));
  int tileRow = int(floor(mapInfo.g * 255.0 + 0.5));
  int tile = int(floor(u_tileSize));

  int tx = int(floor(local.x * float(tile)));
  int ty = int(floor(local.y * float(tile)));

  tx = clamp(tx, 0, tile - 1);
  ty = clamp(ty, 0, tile - 1);

  int ax = tileCol * tile + tx;
  int ay = tileRow * tile + ty;

  vec4 tileColor = texelFetch(u_atlas, ivec2(ax, ay), 0);
  if (u_overlay == 1) {
    outColor = vec4(tileColor.rgb, bg.a);
  } else {
    outColor = vec4(tileColor.rgb, 1.0);
  }
}
`;
