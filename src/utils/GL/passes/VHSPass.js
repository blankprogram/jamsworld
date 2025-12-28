import GLPass from "../GLPass.js";

export default class VHSPass extends GLPass {
  static def = {
    type: "VHS",
    title: "VHS",
    options: [
      { label: "Amount", type: "range", name: "amount", props: { min: 0, max: 1, step: 0.01 }, defaultValue: 0.65 },
      { label: "Noise", type: "range", name: "noise", props: { min: 0, max: 2, step: 0.01 }, defaultValue: 0.35 },
      { label: "Chroma Smear", type: "range", name: "chromaSmear", props: { min: 0, max: 3, step: 0.01 }, defaultValue: 1.2 },
      { label: "Head Switch", type: "range", name: "headSwitch", props: { min: 0, max: 2, step: 0.01 }, defaultValue: 1.0 },
    ],
    structuralKeys: [],
    uniformKeys: ["u_texture", "u_resolution", "u_time", "u_amount", "u_noise", "u_chromaSmear", "u_headSwitch"],
  };

  constructor(gl, opts = {}) {
    super(gl, VHSPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_resolution", type: "2f", value: ({ width, height }) => [width, height] },
      { name: "u_time", type: "1f", value: () => (this._t += 1 / 60) },
      { name: "u_amount", type: "1f", value: () => this.amount },
      { name: "u_noise", type: "1f", value: () => this.noise },
      { name: "u_chromaSmear", type: "1f", value: () => this.chromaSmear },
      { name: "u_headSwitch", type: "1f", value: () => this.headSwitch },
    ]);

    this._t = 0;

    this.amount = opts.amount ?? 0.65;
    this.noise = opts.noise ?? 0.35;
    this.chromaSmear = opts.chromaSmear ?? 1.2;
    this.headSwitch = opts.headSwitch ?? 1.0;
  }

  setOption(name, value) {
    const v = +value;
    if (name === "amount") this.amount = v;
    else if (name === "noise") this.noise = v;
    else if (name === "chromaSmear") this.chromaSmear = v;
    else if (name === "headSwitch") this.headSwitch = v;
  }
}

VHSPass.FS = `#version 300 es
precision highp float;

in vec2 v_uv;
uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_time;

uniform float u_amount;
uniform float u_noise;
uniform float u_chromaSmear;
uniform float u_headSwitch;

out vec4 outColor;

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec3 rgb2yiq(vec3 c) {
  return vec3(
    dot(c, vec3(0.299, 0.587, 0.114)),
    dot(c, vec3(0.596, -0.275, -0.321)),
    dot(c, vec3(0.212, -0.523, 0.311))
  );
}
vec3 yiq2rgb(vec3 y) {
  return vec3(
    y.x + 0.956 * y.y + 0.621 * y.z,
    y.x - 0.272 * y.y - 0.647 * y.z,
    y.x - 1.106 * y.y + 1.703 * y.z
  );
}

vec3 texRGB(vec2 uv) {
  return texture(u_texture, uv).rgb;
}

void main() {
  vec2 uv = v_uv;

  vec4 src = texture(u_texture, uv);
  float a = src.a;
  if (a <= 0.001) {
    outColor = src;
    return;
  }

  float timebase = 1.0;
  float chromaLoss = 1.0;
  float softness = 0.6;
  float dropouts = 0.3;
  float seed = 1.0;

  float yPix = floor(uv.y * u_resolution.y);
  float frame = floor(u_time * 60.0);

  float slowDrift = sin(u_time * 0.7 + seed) * 0.0015;
  float lineRnd = hash11(yPix + frame * 13.0 + seed * 101.0) - 0.5;
  float lineJit = lineRnd * 0.0035 * timebase;

  float block = floor(yPix / 24.0);
  float corr = (hash11(block + frame * 3.0 + seed * 7.0) - 0.5);
  corr *= step(0.93, hash11(frame + block * 9.0 + seed * 2.0));
  corr *= 0.006 * timebase;

  uv.x += (slowDrift + lineJit + corr) * u_amount;
  uv = clamp(uv, vec2(0.001), vec2(0.999));

  vec2 px = 1.0 / u_resolution;
  vec3 c0 = texRGB(uv);
  vec3 cL = texRGB(uv + vec2(-px.x, 0.0));
  vec3 cR = texRGB(uv + vec2(px.x, 0.0));
  vec3 soft = mix(c0, (cL + c0 + cR) / 3.0, clamp(softness * 0.6, 0.0, 1.0) * u_amount);

  vec3 yiq = rgb2yiq(soft);

  float chromaRes = mix(u_resolution.x, 160.0, clamp(chromaLoss * 0.6 * u_amount, 0.0, 1.0));
  vec2 uvC = uv;
  uvC.x = (floor(uvC.x * chromaRes) + 0.5) / chromaRes;

  vec3 yiqC0 = rgb2yiq(texRGB(uvC));
  float smearPx = (1.0 + 6.0 * u_chromaSmear) * px.x * u_amount;
  vec3 yiqC1 = rgb2yiq(texRGB(uvC + vec2(smearPx, 0.0)));
  vec3 yiqC2 = rgb2yiq(texRGB(uvC - vec2(smearPx, 0.0)));
  vec2 chroma = (yiqC0.yz + yiqC1.yz + yiqC2.yz) / 3.0;

  vec3 outYIQ = vec3(yiq.x, chroma);

  float band = smoothstep(0.80, 0.96, uv.y) * u_headSwitch * u_amount;
  float tear = (hash11(frame + seed * 17.0) - 0.5) * 0.02 * band;
  vec2 uvT = clamp(vec2(uv.x + tear, uv.y), vec2(0.001), vec2(0.999));

  float n = (hash21(vec2(yPix, frame) + seed) - 0.5);
  outYIQ.x += n * 0.18 * band;

  outYIQ.yz += vec2(
    sin(uv.y * 900.0 + u_time * 40.0),
    cos(uv.y * 700.0 - u_time * 35.0)
  ) * 0.02 * band;

  float doChance = dropouts * 0.015 * u_amount;
  float doLine = step(1.0 - doChance, hash11(yPix + frame * 19.0 + seed * 5.0));
  float doLen = step(0.7, hash21(vec2(frame, yPix) + seed * 3.0));
  float doMask = doLine * doLen;
  outYIQ.x = mix(outYIQ.x, outYIQ.x * 0.2 + 0.8, doMask);

  float luma = outYIQ.x;
  float vidNoise = (hash21(vec2(uv.x * u_resolution.x, yPix) + frame + seed) - 0.5);
  outYIQ.x += vidNoise * (0.06 + 0.10 * (1.0 - luma)) * u_noise * u_amount;

  vec3 rgb = yiq2rgb(outYIQ);
  vec3 rgbT = yiq2rgb(vec3(rgb2yiq(texRGB(uvT)).x, outYIQ.yz));
  rgb = mix(rgb, rgbT, band * 0.25);

  outColor = vec4(clamp(rgb, 0.0, 1.0), a);
}
`;
