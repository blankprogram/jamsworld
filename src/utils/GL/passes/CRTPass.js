import GLPass from "../GLPass.js";

export default class CRTPass extends GLPass {
  static def = {
    type: "CRT",
    title: "CRT",
    options: [
      { label: "Warp", type: "range", name: "warp", props: { min: 0, max: 2, step: 0.01 }, defaultValue: 0.6 },
      { label: "Scanlines", type: "range", name: "scanlines", props: { min: 0, max: 2, step: 0.01 }, defaultValue: 1.0 },
      { label: "Mask", type: "range", name: "mask", props: { min: 0, max: 2, step: 0.01 }, defaultValue: 0.9 },
      { label: "Glow", type: "range", name: "glow", props: { min: 0, max: 2, step: 0.01 }, defaultValue: 0.35 },
      { label: "Vignette", type: "range", name: "vignette", props: { min: 0, max: 2, step: 0.01 }, defaultValue: 0.7 },
    ],
    structuralKeys: [],
    uniformKeys: ["u_texture", "u_resolution", "u_scanlines", "u_mask", "u_warp", "u_vignette", "u_glow"],
  };

  constructor(gl, opts = {}) {
    super(gl, CRTPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_resolution", type: "2f", value: ({ width, height }) => [width, height] },
      { name: "u_scanlines", type: "1f", value: () => this.scanlines },
      { name: "u_mask", type: "1f", value: () => this.mask },
      { name: "u_warp", type: "1f", value: () => this.warp },
      { name: "u_vignette", type: "1f", value: () => this.vignette },
      { name: "u_glow", type: "1f", value: () => this.glow },
    ]);

    this.scanlines = opts.scanlines ?? 1.0;
    this.mask = opts.mask ?? 0.9;
    this.warp = opts.warp ?? 0.6;
    this.vignette = opts.vignette ?? 0.7;
    this.glow = opts.glow ?? 0.35;
  }

  setOption(name, value) {
    const v = +value;
    if (name === "scanlines") this.scanlines = v;
    else if (name === "mask") this.mask = v;
    else if (name === "warp") this.warp = v;
    else if (name === "vignette") this.vignette = v;
    else if (name === "glow") this.glow = v;
  }
}

CRTPass.FS = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_resolution;

uniform float u_scanlines;
uniform float u_mask;
uniform float u_warp;
uniform float u_vignette;
uniform float u_glow;

out vec4 outColor;

vec2 warpUV(vec2 uv, float amt){
  vec2 cc = uv * 2.0 - 1.0;
  float r2 = dot(cc, cc);
  cc *= 1.0 + amt * 0.12 * r2;
  return cc * 0.5 + 0.5;
}

vec3 glowApprox(vec2 uv, vec2 px, float amt){
  vec3 c = texture(u_texture, uv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  float m = smoothstep(0.55, 1.0, l) * amt;

  vec3 a = texture(u_texture, clamp(uv + vec2(px.x, 0.0), 0.0, 1.0)).rgb;
  vec3 b = texture(u_texture, clamp(uv - vec2(px.x, 0.0), 0.0, 1.0)).rgb;
  vec3 d = texture(u_texture, clamp(uv + vec2(0.0, px.y), 0.0, 1.0)).rgb;
  vec3 e = texture(u_texture, clamp(uv - vec2(0.0, px.y), 0.0, 1.0)).rgb;
  vec3 blur = (a + b + d + e + c) / 5.0;

  return c + (blur - c) * m;
}

vec3 phosphorMask(vec2 uv, float strength){
  float scale = 1.0;
  float x = floor(uv.x * u_resolution.x * scale);
  float tri = mod(x, 3.0);
  vec3 mask = tri < 1.0 ? vec3(1.00, 0.55, 0.55)
            : tri < 2.0 ? vec3(0.55, 1.00, 0.55)
                       : vec3(0.55, 0.55, 1.00);
  return mix(vec3(1.0), mask, clamp(strength, 0.0, 1.0));
}

float scanBeam(vec2 uv, float strength){
  float y = uv.y * u_resolution.y;
  float fy = fract(y) - 0.5;
  float beam = exp(-fy * fy * 18.0);
  return mix(1.0, beam, clamp(strength, 0.0, 1.0));
}

void main() {
  vec4 src0 = texture(u_texture, v_uv);
  float a0 = src0.a;
  if (a0 <= 0.001) {
    outColor = src0;
    return;
  }

  vec2 px = 1.0 / u_resolution;

  vec2 uv = warpUV(v_uv, u_warp);
  float crop = 0.015 * u_warp;
  uv = (uv - 0.5) * (1.0 + crop * 2.0) + 0.5;

  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    outColor = vec4(0.0, 0.0, 0.0, 0.0);
    return;
  }

  vec4 src = texture(u_texture, uv);
  float a = src.a;
  if (a <= 0.001) {
    outColor = src;
    return;
  }

  vec3 col = src.rgb;

  col = glowApprox(uv, px * (1.0 + 1.5 * u_glow), u_glow);

  float beam = scanBeam(uv, 0.75 * u_scanlines);
  col *= beam;

  col *= phosphorMask(uv, 0.85 * u_mask);

  vec2 cc = uv * 2.0 - 1.0;
  float v = smoothstep(1.15, 0.25, dot(cc, cc));
  col *= mix(1.0, v, clamp(u_vignette, 0.0, 1.0));

  col = pow(max(col, 0.0), vec3(0.95));

  outColor = vec4(clamp(col, 0.0, 1.0), a);
}
`;
