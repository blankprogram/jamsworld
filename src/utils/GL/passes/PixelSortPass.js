import GLPass from "../GLPass.js";
import ShaderProgram from "../ShaderProgram.js";
import {
  bindFramebufferCached,
  bindTexture,
  bindVertexArrayCached,
  setBlendEnabledCached,
  setViewportCached,
  setProgramCached,
} from "../helpers.js";

const QUAD_VS = `#version 300 es
precision highp float;
void main() {
  vec2 pos = vec2(
    float((gl_VertexID << 1) & 2),
    float(gl_VertexID & 2)
  );
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}
`;

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
      "u_sortVec",
      "u_width",
      "u_height",
      "u_low",
      "u_high",
      "u_pass",
      "u_reverse",
    ],
  };

  static UNIFORMS = [
    { name: "u_texture", type: "1i", value: 0 },
    { name: "u_sortVec", type: "2f", value: ({ sortVec }) => sortVec },
    { name: "u_width", type: "1i", value: ({ width }) => width },
    { name: "u_height", type: "1i", value: ({ height }) => height },
    { name: "u_low", type: "1f", value: ({ low }) => low },
    { name: "u_high", type: "1f", value: ({ high }) => high },
    { name: "u_pass", type: "1i", value: ({ pass }) => pass },
    { name: "u_reverse", type: "1i", value: ({ reverse }) => reverse },
  ];

  constructor(gl, opts = {}) {
    const mode = opts.mode || "Fully Sorted";
    const sortBy = opts.sortBy || "Luminance";
    const sortByIndex = PixelSortPass.indexMap[sortBy] ?? 0;
    super(
      gl,
      PixelSortPass.buildFragmentSource(mode, sortByIndex),
      PixelSortPass.UNIFORMS,
    );

    this.mode = mode;
    this.low = opts.low ?? 0.2;
    this.high = opts.high ?? 0.8;
    this.sortBy = sortBy;
    this.direction = opts.direction || "Down";
    this.sortByIndex = sortByIndex;
    this.sortVec = PixelSortPass.dirMap[this.direction].vec;
    this.reverse = PixelSortPass.dirMap[this.direction].reverse ? 1 : 0;
    this.pass = 0;

    this.programCache = new Map();
    this.programCache.set(this._programKey(), this.prog);
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

  _programKey() {
    return `${this.mode}:${this.sortByIndex}`;
  }

  _getProgram() {
    const key = this._programKey();
    const cached = this.programCache.get(key);
    if (cached) return cached;

    const program = new ShaderProgram(
      this.gl,
      QUAD_VS,
      PixelSortPass.buildFragmentSource(this.mode, this.sortByIndex),
      PixelSortPass.UNIFORMS,
    );
    this.programCache.set(key, program);
    return program;
  }

  render(gl, state, pool, vao, glState) {
    const { texture, width, height } = state;
    const vertical = Math.abs(this.sortVec[1]) > Math.abs(this.sortVec[0]);
    const spanLength = vertical ? height : width;
    if (spanLength <= 1) return state;

    let passes = spanLength;
    if (this.mode === "Threshold") {
      if (this.low >= this.high) return state;
    }

    const prog = this._getProgram();
    let src = { texture, width, height };
    const pair = pool.getPair(width, height);
    setBlendEnabledCached(gl, false, glState);

    for (let i = 0; i < passes; ++i) {
      this.pass = i;
      const dst = pair.next();
      bindFramebufferCached(gl, dst.fbo, glState);
      setViewportCached(gl, 0, 0, width, height, glState);
      setProgramCached(gl, prog.prog, glState);
      bindVertexArrayCached(gl, vao, glState);

      bindTexture(gl, 0, src.texture, prog.locs.u_texture);
      prog.setUniforms({
        texture: 0,
        sortVec: this.sortVec,
        width,
        height,
        low: this.low,
        high: this.high,
        pass: i,
        reverse: this.reverse,
      });

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      src = { texture: dst.tex, width, height };
    }

    return src;
  }

  static buildFragmentSource(mode, sortByIndex) {
    const keySource = PixelSortPass.getKeySource(sortByIndex);
    const thresholdSource =
      mode === "Threshold"
        ? `
uniform float u_low;
uniform float u_high;

bool inSpan(float key) {
    return key >= u_low && key <= u_high;
}
`
        : `
bool inSpan(float key) {
    return true;
}
`;

    return `#version 300 es
precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_sortVec;
uniform int u_width;
uniform int u_height;
uniform int u_pass;
uniform int u_reverse;
${thresholdSource}
out vec4 outColor;

${keySource}

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
  }

  static getKeySource(sortByIndex) {
    switch (sortByIndex) {
      case 1:
        return `float getKey(vec3 c) {
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

    return h;
}`;
      case 2:
        return `float getKey(vec3 c) {
    float maxC = max(c.r, max(c.g, c.b));
    float minC = min(c.r, min(c.g, c.b));
    float delta = maxC - minC;
    float l = 0.5 * (maxC + minC);
    return delta == 0.0 ? 0.0 : delta / (1.0 - abs(2.0 * l - 1.0));
}`;
      case 3:
        return `float getKey(vec3 c) {
    return (c.r + c.g + c.b) / 3.0;
}`;
      case 4:
        return `float getKey(vec3 c) {
    return c.r;
}`;
      case 5:
        return `float getKey(vec3 c) {
    return c.g;
}`;
      case 6:
        return `float getKey(vec3 c) {
    return c.b;
}`;
      case 0:
      default:
        return `float getKey(vec3 c) {
    float maxC = max(c.r, max(c.g, c.b));
    float minC = min(c.r, min(c.g, c.b));
    return 0.5 * (maxC + minC);
}`;
    }
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

  destroy() {
    const uniquePrograms = new Set(this.programCache.values());
    for (const program of uniquePrograms) {
      program.destroy();
    }
    this.programCache.clear();
    this.prog = null;
  }
}
