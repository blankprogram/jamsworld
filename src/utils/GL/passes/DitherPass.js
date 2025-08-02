import GLPass from "../GLPass.js";

export default class DitherPass extends GLPass {
  static def = {
    type: "DITHER",
    title: "Dithering",
    options: [
      {
        label: "Algorithm",
        type: "select",
        name: "algo",
        options: ["Ordered", "Stochastic", "Halftone", "Error Diffusion"],
        defaultValue: "Ordered",
      },
      {
        label: "Levels",
        type: "range",
        name: "levels",
        props: { min: 2, max: 10, step: 1 },
        defaultValue: 2,
      },
    ],
    uniformKeys: ["u_algo", "u_levels"],
    structuralKeys: ["algo", "levels"],
  };

  constructor(gl, opts = {}) {
    super(gl, DitherPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_algo", type: "1i", value: () => this.algoIndex },
      { name: "u_levels", type: "1f", value: () => this.levels },
    ]);
    this.algo = opts.algo || "Ordered";
    this.algoIndex =
      this.algo === "Stochastic"
        ? 1
        : this.algo === "Halftone"
          ? 2
          : this.algo === "Error Diffusion"
            ? 3
            : 0;
    this.levels = opts.levels ?? 2;
    this.cpuTexture = null;
  }

  setOption(name, value) {
    if (name === "algo") {
      this.algo = value;
      this.algoIndex =
        value === "Stochastic"
          ? 1
          : value === "Halftone"
            ? 2
            : value === "Error Diffusion"
              ? 3
              : 0;
    }
    if (name === "levels") this.levels = Math.max(2, parseInt(value, 10) || 2);
  }

  render(gl, state, pool, vao) {
    if (this.algo !== "Error Diffusion")
      return super.render(gl, state, pool, vao);

    const { texture, width, height } = state;
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      texture,
      0,
    );

    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fbo);

    this.applyFloydSteinberg(pixels, width, height, this.levels);

    if (!this.cpuTexture) {
      this.cpuTexture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, this.cpuTexture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
    } else {
      gl.bindTexture(gl.TEXTURE_2D, this.cpuTexture);
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        width,
        height,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        pixels,
      );
    }

    return { texture: this.cpuTexture, width, height };
  }
  applyFloydSteinberg(pixels, width, height, levels) {
    const quantLevel = levels - 1;
    const idx = (x, y) => 4 * (y * width + x);
    const quantize = (v) => Math.round(v * quantLevel) / quantLevel;

    const floatPixels = new Float32Array(pixels.length);
    for (let i = 0; i < pixels.length; i++) floatPixels[i] = pixels[i] / 255;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = idx(x, y);
        for (let c = 0; c < 3; c++) {
          const oldVal = floatPixels[i + c];
          const newVal = quantize(oldVal);
          const error = oldVal - newVal;
          floatPixels[i + c] = newVal;
          if (x + 1 < width) floatPixels[idx(x + 1, y) + c] += (error * 7) / 16;
          if (x - 1 >= 0 && y + 1 < height)
            floatPixels[idx(x - 1, y + 1) + c] += (error * 3) / 16;
          if (y + 1 < height)
            floatPixels[idx(x, y + 1) + c] += (error * 5) / 16;
          if (x + 1 < width && y + 1 < height)
            floatPixels[idx(x + 1, y + 1) + c] += (error * 1) / 16;
        }
      }
    }

    for (let i = 0; i < pixels.length; i += 4) {
      pixels[i] = Math.min(255, Math.max(0, floatPixels[i] * 255));
      pixels[i + 1] = Math.min(255, Math.max(0, floatPixels[i + 1] * 255));
      pixels[i + 2] = Math.min(255, Math.max(0, floatPixels[i + 2] * 255));
    }
  }

  destroy() {
    super.destroy();
    if (this.cpuTexture) {
      this.gl.deleteTexture(this.cpuTexture);
      this.cpuTexture = null;
    }
  }
}

DitherPass.FS = `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_texture;
uniform int u_algo;
uniform float u_levels;
out vec4 outColor;

const int bayer4[16] = int[16](
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5
);

float rand(vec2 co) {
  return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

void main() {
  vec4 src = texture(u_texture, v_uv);

  if(u_algo == 2) {
    bool isGray = abs(src.r - src.g) < 0.001 && abs(src.r - src.b) < 0.001;
    float a0 = isGray ? radians(45.0) : radians(15.0);
    float a1 = isGray ? radians(45.0) : radians(45.0);
    float a2 = isGray ? radians(45.0) : radians(75.0);
    vec2 p = gl_FragCoord.xy / u_levels;
    vec2 c0 = fract(rot(a0) * p) - 0.5;
    vec2 c1 = fract(rot(a1) * p) - 0.5;
    vec2 c2 = fract(rot(a2) * p) - 0.5;
    float r0 = (1.0 - src.r) * 0.5;
    float r1 = (1.0 - src.g) * 0.5;
    float r2 = (1.0 - src.b) * 0.5;
    float v0 = length(c0) < r0 ? 0.0 : 1.0;
    float v1 = length(c1) < r1 ? 0.0 : 1.0;
    float v2 = length(c2) < r2 ? 0.0 : 1.0;
    outColor = vec4(vec3(v0, v1, v2), src.a);
    return;
  }

  ivec2 pix = ivec2(gl_FragCoord.xy);
  float threshold = (u_algo == 0)
    ? (float(bayer4[(pix.y & 3) * 4 + (pix.x & 3)]) + 0.5) / 16.0
    : rand(gl_FragCoord.xy);
  vec3 q = floor(src.rgb * u_levels + threshold) / u_levels;
  outColor = vec4(q, src.a);
}
`;
