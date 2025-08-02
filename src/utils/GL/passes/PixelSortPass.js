import GLPass from "../GLPass.js";
import { bindTexture } from "../helpers.js";

export default class PixelSortPass extends GLPass {
  static def = {
    type: "PIXELSORT",
    title: "Pixel Sort",
    options: [
      {
        label: "Mode",
        type: "select",
        name: "mode",
        options: ["Fully Sorted", "Threshold"],
        defaultValue: "Fully Sorted",
      },
      {
        label: "Low Threshold",
        type: "range",
        name: "low",
        props: { min: 0, max: 1, step: 0.01 },
        defaultValue: 0.2,
      },
      {
        label: "High Threshold",
        type: "range",
        name: "high",
        props: { min: 0, max: 1, step: 0.01 },
        defaultValue: 0.8,
      },
      {
        label: "Sort By",
        type: "select",
        name: "sortBy",
        options: [
          "Luminance",
          "Hue",
          "Saturation",
          "RGB Average",
          "Red",
          "Green",
          "Blue",
        ],
        defaultValue: "Luminance",
      },
      {
        label: "Direction",
        type: "select",
        name: "direction",
        options: ["Up", "Down", "Left", "Right"],
        defaultValue: "Down",
      },
    ],
    structuralKeys: ["mode", "sortBy", "direction"],
    uniformKeys: [
      "u_texture",
      "u_sortBy",
      "u_sortVec",
      "u_width",
      "u_height",
      "u_mode",
      "u_low",
      "u_high",
      "u_pass",
      "u_reverse",
    ],
  };

  constructor(gl, opts = {}) {
    super(gl, PixelSortPass.FS, [
      { name: "u_texture", type: "1i", value: 0 },
      { name: "u_sortBy", type: "1i", value: () => this.sortByIndex },
      { name: "u_sortVec", type: "2f", value: () => this.sortVec },
      { name: "u_width", type: "1i", value: ({ width }) => width },
      { name: "u_height", type: "1i", value: ({ height }) => height },
      {
        name: "u_mode",
        type: "1i",
        value: () => (this.mode === "Threshold" ? 1 : 0),
      },
      { name: "u_low", type: "1f", value: () => this.low },
      { name: "u_high", type: "1f", value: () => this.high },
      { name: "u_pass", type: "1i", value: () => this.pass },
      { name: "u_reverse", type: "1i", value: () => this.reverse },
    ]);
    this.mode = opts.mode || "Fully Sorted";
    this.low = opts.low ?? 0.2;
    this.high = opts.high ?? 0.8;
    this.sortBy = opts.sortBy || "Luminance";
    this.direction = opts.direction || "Down";
    this.sortByIndex = PixelSortPass.indexMap[this.sortBy];
    this.sortVec = PixelSortPass.dirMap[this.direction].vec;
    this.reverse = PixelSortPass.dirMap[this.direction].reverse ? 1 : 0;
    this.pass = 0;
  }

  setOption(name, value) {
    if (name === "mode") this.mode = value;
    else if (name === "low") this.low = +value;
    else if (name === "high") this.high = +value;
    else if (name === "sortBy") {
      this.sortBy = value;
      this.sortByIndex = PixelSortPass.indexMap[value];
    } else if (name === "direction") {
      this.direction = value;
      this.sortVec = PixelSortPass.dirMap[value].vec;
      this.reverse = PixelSortPass.dirMap[value].reverse ? 1 : 0;
    }
  }

  render(gl, state, pool, vao) {
    const { texture, width, height } = state;
    const vertical = Math.abs(this.sortVec[1]) > Math.abs(this.sortVec[0]);
    const spanLength = vertical ? height : width;
    const passes = spanLength;

    let src = { texture, width, height };
    const pair = pool.getPair(width, height);

    for (let i = 0; i < passes; ++i) {
      this.pass = i;
      const dst = pair.next();
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
      gl.viewport(0, 0, width, height);
      gl.disable(gl.BLEND);

      this.prog.use();
      bindTexture(gl, 0, src.texture, this.prog.locs.u_texture);
      this.prog.setUniforms({
        texture: 0,
        sortBy: this.sortByIndex,
        sortVec: this.sortVec,
        width,
        height,
        mode: this.mode === "Threshold" ? 1 : 0,
        low: this.low,
        high: this.high,
        pass: i,
        reverse: this.reverse,
      });

      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      src = { texture: dst.tex, width, height };
    }

    return src;
  }

  static indexMap = {
    Luminance: 0,
    Hue: 1,
    Saturation: 2,
    "RGB Average": 3,
    Red: 4,
    Green: 5,
    Blue: 6,
  };

  static dirMap = {
    Up: { vec: [0, -1], reverse: 1 },
    Down: { vec: [0, 1], reverse: 0 },
    Left: { vec: [-1, 0], reverse: 1 },
    Right: { vec: [1, 0], reverse: 0 },
  };
}
PixelSortPass.FS = `#version 300 es
precision highp float;

in vec2 v_uv;

uniform sampler2D u_texture;
uniform vec2 u_sortVec;
uniform int u_sortBy;
uniform int u_width;
uniform int u_height;
uniform int u_mode;
uniform float u_low;
uniform float u_high;
uniform int u_pass;
uniform int u_reverse;

out vec4 outColor;

vec3 rgb2hsl(vec3 c) {
    float maxC = max(c.r, max(c.g, c.b));
    float minC = min(c.r, min(c.g, c.b));
    float delta = maxC - minC;
    float h = 0.0;

    if (delta > 0.0) {
        if (maxC == c.r)
            h = mod((c.g - c.b) / delta, 6.0);
        else if (maxC == c.g)
            h = (c.b - c.r) / delta + 2.0;
        else
            h = (c.r - c.g) / delta + 4.0;
        h /= 6.0;
        if (h < 0.0) h += 1.0;
    }

    float l = 0.5 * (maxC + minC);
    float s = delta == 0.0 ? 0.0 : delta / (1.0 - abs(2.0 * l - 1.0));
    return vec3(h, s, l);
}

float getKey(vec3 c) {
    vec3 hsl = rgb2hsl(c);
    if (u_sortBy == 0) return hsl.z;
    if (u_sortBy == 1) return hsl.x;
    if (u_sortBy == 2) return hsl.y;
    if (u_sortBy == 3) return (c.r + c.g + c.b) / 3.0;
    if (u_sortBy == 4) return c.r;
    if (u_sortBy == 5) return c.g;
    if (u_sortBy == 6) return c.b;
    return hsl.z;
}

bool inSpan(float key) {
    if (u_mode == 0) return true;
    return key >= u_low && key <= u_high;
}

void main() {
    ivec2 coord = ivec2(gl_FragCoord.xy);

    bool vertical = abs(u_sortVec.y) > abs(u_sortVec.x);
    int spanLength = vertical ? u_height : u_width;
    int axis = vertical ? coord.y : coord.x;
    int perp = vertical ? coord.x : coord.y;

    vec2 uv = vec2(float(coord.x) + 0.5, float(coord.y) + 0.5) / vec2(u_width, u_height);
    vec4 self = texture(u_texture, uv);
    float key = getKey(self.rgb);
    bool selfInSpan = inSpan(key);

    int pairOffset = ((axis + u_pass) % 2 == 0) ? 1 : -1;
    int neighborAxis = axis + pairOffset;
    bool validNeighbor = neighborAxis >= 0 && neighborAxis < spanLength;

    vec2 neighborUV = vertical
        ? vec2(float(perp) + 0.5, float(neighborAxis) + 0.5) / vec2(u_width, u_height)
        : vec2(float(neighborAxis) + 0.5, float(perp) + 0.5) / vec2(u_width, u_height);

    vec4 neighbor = validNeighbor ? texture(u_texture, neighborUV) : self;
    float neighborKey = getKey(neighbor.rgb);
    bool neighborInSpan = validNeighbor ? inSpan(neighborKey) : false;

    bool doSwap = selfInSpan && neighborInSpan;
    bool gt = key > neighborKey;
    bool lt = key < neighborKey;
    bool shouldSwap = doSwap && (
        (u_reverse == 0 && ((pairOffset == 1 && gt) || (pairOffset == -1 && lt))) ||
        (u_reverse == 1 && ((pairOffset == 1 && lt) || (pairOffset == -1 && gt)))
    );

    outColor = shouldSwap ? neighbor : self;
}
`;
