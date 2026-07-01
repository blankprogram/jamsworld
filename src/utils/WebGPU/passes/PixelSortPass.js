import { GPU_BUFFER_USAGE } from "../constants";

const SHADER_STAGE_COMPUTE = 4;
const UNIFORM_BYTE_SIZE = 48;
const UNIFORM_STRIDE = 256;
const UNIFORM_STRIDE_FLOATS = UNIFORM_STRIDE / 4;
const BITONIC_MAX_REQUESTED_LINE_LENGTH = 16384;
const BITONIC_SORT_ITEM_BYTES = 4;

const SORT_BY = {
  Luminance: 0,
  Hue: 1,
  Saturation: 2,
  "RGB Average": 3,
  Red: 4,
  Green: 5,
  Blue: 6,
};

const DIRECTIONS = {
  Down: {
    code: 0,
    reverse: 0,
    orientation: "vertical",
  },
  Up: {
    code: 1,
    reverse: 1,
    orientation: "vertical",
  },
  Right: {
    code: 2,
    reverse: 0,
    orientation: "horizontal",
  },
  Left: {
    code: 3,
    reverse: 1,
    orientation: "horizontal",
  },
  "Down Right": {
    code: 4,
    reverse: 0,
    orientation: "diagonal",
  },
  "Up Left": {
    code: 5,
    reverse: 1,
    orientation: "diagonal",
  },
  "Down Left": {
    code: 6,
    reverse: 0,
    orientation: "diagonal",
  },
  "Up Right": {
    code: 7,
    reverse: 1,
    orientation: "diagonal",
  },
  "Horizontal Center Out": {
    code: 8,
    reverse: 0,
    orientation: "horizontal",
  },
  "Horizontal Edges In": {
    code: 9,
    reverse: 0,
    orientation: "horizontal",
  },
  "Vertical Center Out": {
    code: 10,
    reverse: 0,
    orientation: "vertical",
  },
  "Vertical Edges In": {
    code: 11,
    reverse: 0,
    orientation: "vertical",
  },
  "Horizontal Snake": {
    code: 12,
    reverse: 0,
    orientation: "horizontal",
  },
  "Vertical Snake": {
    code: 13,
    reverse: 0,
    orientation: "vertical",
  },
  "Down Right Snake": {
    code: 14,
    reverse: 0,
    orientation: "diagonal",
  },
  "Down Left Snake": {
    code: 15,
    reverse: 0,
    orientation: "diagonal",
  },
  "Down Right Center Out": {
    code: 16,
    reverse: 0,
    orientation: "diagonal",
  },
  "Down Right Edges In": {
    code: 17,
    reverse: 0,
    orientation: "diagonal",
  },
  "Down Left Center Out": {
    code: 18,
    reverse: 0,
    orientation: "diagonal",
  },
  "Down Left Edges In": {
    code: 19,
    reverse: 0,
    orientation: "diagonal",
  },
  "Horizontal Split": {
    code: 20,
    reverse: 0,
    orientation: "horizontal-split",
  },
  "Vertical Split": {
    code: 21,
    reverse: 0,
    orientation: "vertical-split",
  },
  "Rectangular Rings Clockwise": {
    code: 22,
    reverse: 0,
    orientation: "rings",
  },
  "Rectangular Rings Counterclockwise": {
    code: 23,
    reverse: 0,
    orientation: "rings",
  },
};

Object.assign(DIRECTIONS, {
  "Center Out ↔": DIRECTIONS["Horizontal Center Out"],
  "Edges In ↔": DIRECTIONS["Horizontal Edges In"],
  "Center Out ↕": DIRECTIONS["Vertical Center Out"],
  "Edges In ↕": DIRECTIONS["Vertical Edges In"],
  "Snake ↔": DIRECTIONS["Horizontal Snake"],
  "Snake ↕": DIRECTIONS["Vertical Snake"],
  "Snake ⤡": DIRECTIONS["Down Right Snake"],
  "Snake ⤢": DIRECTIONS["Down Left Snake"],
  "Center Out ⤡": DIRECTIONS["Down Right Center Out"],
  "Edges In ⤡": DIRECTIONS["Down Right Edges In"],
  "Center Out ⤢": DIRECTIONS["Down Left Center Out"],
  "Edges In ⤢": DIRECTIONS["Down Left Edges In"],
  "Split ↔": DIRECTIONS["Horizontal Split"],
  "Split ↕": DIRECTIONS["Vertical Split"],
  "Rings ↻": DIRECTIONS["Rectangular Rings Clockwise"],
  "Rings ↺": DIRECTIONS["Rectangular Rings Counterclockwise"],
});

const makeParamsShader = (thirdFieldName) => `
struct Params {
  width: f32,
  height: f32,
  ${thirdFieldName}: f32,
  reverse: f32,
  direction: f32,
  mode: f32,
  sortBy: f32,
  low: f32,
  high: f32,
  pad0: f32,
  pad1: f32,
  pad2: f32,
};

@group(0) @binding(0) var srcTex: texture_2d<f32>;
@group(0) @binding(1) var dstTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(2) var<uniform> params: Params;
`;

const SORT_PARAMS_SHADER = makeParamsShader("passIndex");
const BITONIC_PARAMS_SHADER = makeParamsShader("sortSize");

const KEY_SHADER = `
fn keyLuminance(c: vec3<f32>) -> f32 {
  let maxC = max(c.r, max(c.g, c.b));
  let minC = min(c.r, min(c.g, c.b));
  return 0.5 * (maxC + minC);
}

fn keyHue(c: vec3<f32>) -> f32 {
  let maxC = max(c.r, max(c.g, c.b));
  let minC = min(c.r, min(c.g, c.b));
  let delta = maxC - minC;
  var h: f32 = 0.0;

  if (delta > 0.0) {
    if (maxC == c.r) {
      let raw = (c.g - c.b) / delta;
      h = raw - 6.0 * floor(raw / 6.0);
    } else if (maxC == c.g) {
      h = (c.b - c.r) / delta + 2.0;
    } else {
      h = (c.r - c.g) / delta + 4.0;
    }
    h = h / 6.0;
    if (h < 0.0) {
      h = h + 1.0;
    }
  }

  return h;
}

fn keySaturation(c: vec3<f32>) -> f32 {
  let maxC = max(c.r, max(c.g, c.b));
  let minC = min(c.r, min(c.g, c.b));
  let delta = maxC - minC;
  let l = 0.5 * (maxC + minC);
  if (delta == 0.0) {
    return 0.0;
  }
  return delta / (1.0 - abs(2.0 * l - 1.0));
}

fn getKey(c: vec3<f32>) -> f32 {
  let sortBy = u32(params.sortBy);
  if (sortBy == 1u) {
    return keyHue(c);
  }
  if (sortBy == 2u) {
    return keySaturation(c);
  }
  if (sortBy == 3u) {
    return (c.r + c.g + c.b) / 3.0;
  }
  if (sortBy == 4u) {
    return c.r;
  }
  if (sortBy == 5u) {
    return c.g;
  }
  if (sortBy == 6u) {
    return c.b;
  }
  return keyLuminance(c);
}
`;

const THRESHOLD_SHADER = `
fn inSpan(key: f32) -> bool {
  if (u32(params.mode) != 1u) {
    return true;
  }
  if (key < params.low) {
    return false;
  }
  if (key > params.high) {
    return false;
  }
  return true;
}
`;

const LINE_GEOMETRY_SHADER = `
const DIRECTION_DOWN: u32 = 0u;
const DIRECTION_UP: u32 = 1u;
const DIRECTION_RIGHT: u32 = 2u;
const DIRECTION_LEFT: u32 = 3u;
const DIRECTION_DOWN_RIGHT: u32 = 4u;
const DIRECTION_UP_LEFT: u32 = 5u;
const DIRECTION_DOWN_LEFT: u32 = 6u;
const DIRECTION_UP_RIGHT: u32 = 7u;
const DIRECTION_HORIZONTAL_CENTER_OUT: u32 = 8u;
const DIRECTION_HORIZONTAL_EDGES_IN: u32 = 9u;
const DIRECTION_VERTICAL_CENTER_OUT: u32 = 10u;
const DIRECTION_VERTICAL_EDGES_IN: u32 = 11u;
const DIRECTION_HORIZONTAL_SNAKE: u32 = 12u;
const DIRECTION_VERTICAL_SNAKE: u32 = 13u;
const DIRECTION_DOWN_RIGHT_SNAKE: u32 = 14u;
const DIRECTION_DOWN_LEFT_SNAKE: u32 = 15u;
const DIRECTION_DOWN_RIGHT_CENTER_OUT: u32 = 16u;
const DIRECTION_DOWN_RIGHT_EDGES_IN: u32 = 17u;
const DIRECTION_DOWN_LEFT_CENTER_OUT: u32 = 18u;
const DIRECTION_DOWN_LEFT_EDGES_IN: u32 = 19u;
const DIRECTION_HORIZONTAL_SPLIT: u32 = 20u;
const DIRECTION_VERTICAL_SPLIT: u32 = 21u;
const DIRECTION_RINGS_CLOCKWISE: u32 = 22u;
const DIRECTION_RINGS_COUNTERCLOCKWISE: u32 = 23u;

fn isVerticalDirection(direction: u32) -> bool {
  return direction == DIRECTION_DOWN ||
    direction == DIRECTION_UP ||
    direction == DIRECTION_VERTICAL_CENTER_OUT ||
    direction == DIRECTION_VERTICAL_EDGES_IN ||
    direction == DIRECTION_VERTICAL_SNAKE;
}

fn isDiagonalDownRightDirection(direction: u32) -> bool {
  return direction == DIRECTION_DOWN_RIGHT ||
    direction == DIRECTION_UP_LEFT ||
    direction == DIRECTION_DOWN_RIGHT_SNAKE ||
    direction == DIRECTION_DOWN_RIGHT_CENTER_OUT ||
    direction == DIRECTION_DOWN_RIGHT_EDGES_IN;
}

fn isDiagonalDownLeftDirection(direction: u32) -> bool {
  return direction == DIRECTION_DOWN_LEFT ||
    direction == DIRECTION_UP_RIGHT ||
    direction == DIRECTION_DOWN_LEFT_SNAKE ||
    direction == DIRECTION_DOWN_LEFT_CENTER_OUT ||
    direction == DIRECTION_DOWN_LEFT_EDGES_IN;
}

fn isDiagonalDirection(direction: u32) -> bool {
  return isDiagonalDownRightDirection(direction) ||
    isDiagonalDownLeftDirection(direction);
}

fn isCenterOutDirection(direction: u32) -> bool {
  return direction == DIRECTION_HORIZONTAL_CENTER_OUT ||
    direction == DIRECTION_VERTICAL_CENTER_OUT ||
    direction == DIRECTION_DOWN_RIGHT_CENTER_OUT ||
    direction == DIRECTION_DOWN_LEFT_CENTER_OUT;
}

fn isEdgesInDirection(direction: u32) -> bool {
  return direction == DIRECTION_HORIZONTAL_EDGES_IN ||
    direction == DIRECTION_VERTICAL_EDGES_IN ||
    direction == DIRECTION_DOWN_RIGHT_EDGES_IN ||
    direction == DIRECTION_DOWN_LEFT_EDGES_IN;
}

fn isSnakeDirection(direction: u32) -> bool {
  return direction == DIRECTION_HORIZONTAL_SNAKE ||
    direction == DIRECTION_VERTICAL_SNAKE ||
    direction == DIRECTION_DOWN_RIGHT_SNAKE ||
    direction == DIRECTION_DOWN_LEFT_SNAKE;
}

fn isHorizontalSplitDirection(direction: u32) -> bool {
  return direction == DIRECTION_HORIZONTAL_SPLIT;
}

fn isVerticalSplitDirection(direction: u32) -> bool {
  return direction == DIRECTION_VERTICAL_SPLIT;
}

fn isRingDirection(direction: u32) -> bool {
  return direction == DIRECTION_RINGS_CLOCKWISE ||
    direction == DIRECTION_RINGS_COUNTERCLOCKWISE;
}

fn ringCountForDimensions(width: u32, height: u32) -> u32 {
  return (min(width, height) + 1u) / 2u;
}

fn ringLengthForIndex(lineIndex: u32, width: u32, height: u32) -> u32 {
  let inset = lineIndex * 2u;
  let ringWidth = width - inset;
  let ringHeight = height - inset;
  if (ringWidth == 1u) {
    return ringHeight;
  }
  if (ringHeight == 1u) {
    return ringWidth;
  }
  return (ringWidth * 2u) + (ringHeight * 2u) - 4u;
}

fn remapCenterOutAxis(axis: u32, lineLength: u32, center: u32) -> u32 {
  if (axis == 0u) {
    return center;
  }

  let leftCount = center;
  let rightCount = (lineLength - 1u) - center;
  let pairedCount = min(leftCount, rightCount) * 2u;

  if (axis <= pairedCount) {
    if ((axis % 2u) == 1u) {
      return center + ((axis + 1u) / 2u);
    }
    return center - (axis / 2u);
  }

  let remainingStep = axis - pairedCount;
  let pairedSide = pairedCount / 2u;
  if (rightCount > leftCount) {
    return center + pairedSide + remainingStep;
  }
  return center - pairedSide - remainingStep;
}

fn remapEdgesInAxis(axis: u32, lineLength: u32) -> u32 {
  let step = axis / 2u;
  if ((axis % 2u) == 0u) {
    return step;
  }
  return (lineLength - 1u) - step;
}

fn remapCenterInAxis(axis: u32, lineLength: u32, center: u32) -> u32 {
  return remapCenterOutAxis((lineLength - 1u) - axis, lineLength, center);
}

fn remapAxisWithCenter(axis: u32, lineIndex: u32, lineLength: u32, lineCenter: u32, direction: u32) -> u32 {
  if (isSnakeDirection(direction) && ((lineIndex % 2u) == 1u)) {
    return (lineLength - 1u) - axis;
  }

  if (isCenterOutDirection(direction)) {
    return remapCenterOutAxis(axis, lineLength, lineCenter);
  }

  if (isEdgesInDirection(direction)) {
    return remapEdgesInAxis(axis, lineLength);
  }

  return axis;
}

fn clampAxisFromFloat(axis: f32, lineLength: u32) -> u32 {
  return u32(clamp(round(axis), 0.0f, f32(lineLength - 1u)));
}

fn downRightAxisAtCornerSeam(startX: u32, startY: u32, lineLength: u32, width: u32, height: u32) -> u32 {
  if (lineLength <= 1u || width <= 1u || height <= 1u) {
    return 0u;
  }

  let maxX = f32(width - 1u);
  let maxY = f32(height - 1u);
  let lineOffset = f32(startY) - f32(startX);
  let intersectionX = maxX * (maxY - lineOffset) / (maxX + maxY);
  return clampAxisFromFloat(intersectionX - f32(startX), lineLength);
}

fn downLeftAxisAtCornerSeam(startX: u32, startY: u32, lineLength: u32, width: u32, height: u32) -> u32 {
  if (lineLength <= 1u || width <= 1u || height <= 1u) {
    return 0u;
  }

  let maxX = f32(width - 1u);
  let maxY = f32(height - 1u);
  let lineSum = f32(startX + startY);
  let intersectionX = maxX * lineSum / (maxX + maxY);
  return clampAxisFromFloat(f32(startX) - intersectionX, lineLength);
}

fn lineCenterForDirection(lineIndex: u32, lineLength: u32, width: u32, height: u32, direction: u32) -> u32 {
  if (lineLength <= 1u) {
    return 0u;
  }

  if (isDiagonalDirection(direction) && (isCenterOutDirection(direction) || isEdgesInDirection(direction))) {
    if (isDiagonalDownRightDirection(direction)) {
      var startX = lineIndex;
      var startY = 0u;
      if (lineIndex >= width) {
        startX = 0u;
        startY = lineIndex - width + 1u;
      }
      return downRightAxisAtCornerSeam(startX, startY, lineLength, width, height);
    }

    var startX = lineIndex;
    var startY = 0u;
    if (lineIndex >= width) {
      startX = width - 1u;
      startY = lineIndex - width + 1u;
    }
    return downLeftAxisAtCornerSeam(startX, startY, lineLength, width, height);
  }

  return (lineLength - 1u) / 2u;
}

fn diagonalSnakeLineOrdinal(lineIndex: u32, width: u32, direction: u32) -> u32 {
  if (isDiagonalDownRightDirection(direction)) {
    if (lineIndex < width) {
      return (width - 1u) - lineIndex;
    }
    return lineIndex;
  }
  return lineIndex;
}

fn remapDiagonalAxis(axis: u32, lineIndex: u32, lineLength: u32, lineCenter: u32, width: u32, direction: u32) -> u32 {
  let snakeLineOrdinal = diagonalSnakeLineOrdinal(lineIndex, width, direction);
  if (isSnakeDirection(direction) && ((snakeLineOrdinal % 2u) == 1u)) {
    return (lineLength - 1u) - axis;
  }

  if (isCenterOutDirection(direction) || isEdgesInDirection(direction)) {
    if (isCenterOutDirection(direction)) {
      return remapCenterOutAxis(axis, lineLength, lineCenter);
    }
    return remapCenterInAxis(axis, lineLength, lineCenter);
  }

  return axis;
}

fn lineCountForDirection(width: u32, height: u32, direction: u32) -> u32 {
  if (isRingDirection(direction)) {
    return ringCountForDimensions(width, height);
  }
  if (isDiagonalDirection(direction)) {
    return width + height - 1u;
  }
  if (isHorizontalSplitDirection(direction)) {
    return height * 2u;
  }
  if (isVerticalSplitDirection(direction)) {
    return width * 2u;
  }
  if (isVerticalDirection(direction)) {
    return width;
  }
  return height;
}

fn lineLengthForDirection(lineIndex: u32, width: u32, height: u32, direction: u32) -> u32 {
  if (isRingDirection(direction)) {
    return ringLengthForIndex(lineIndex, width, height);
  }
  if (isDiagonalDownRightDirection(direction)) {
    if (lineIndex < width) {
      return min(width - lineIndex, height);
    }
    return min(width, height - (lineIndex - width + 1u));
  }
  if (isDiagonalDownLeftDirection(direction)) {
    if (lineIndex < width) {
      return min(lineIndex + 1u, height);
    }
    return min(width, height - (lineIndex - width + 1u));
  }
  if (isHorizontalSplitDirection(direction)) {
    let leftLength = (width + 1u) / 2u;
    if ((lineIndex % 2u) == 0u) {
      return leftLength;
    }
    return width - leftLength;
  }
  if (isVerticalSplitDirection(direction)) {
    let topLength = (height + 1u) / 2u;
    if ((lineIndex % 2u) == 0u) {
      return topLength;
    }
    return height - topLength;
  }
  if (isVerticalDirection(direction)) {
    return height;
  }
  return width;
}

fn coordFromRingAxis(axis: u32, lineIndex: u32, lineLength: u32, width: u32, height: u32, direction: u32) -> vec2<i32> {
  let left = lineIndex;
  let top = lineIndex;
  let right = (width - 1u) - lineIndex;
  let bottom = (height - 1u) - lineIndex;
  let ringWidth = right - left + 1u;
  let ringHeight = bottom - top + 1u;
  let ringLength = lineLength;
  let seamAxis = ringWidth / 2u;
  var ringAxis = (axis + seamAxis) % ringLength;
  if (direction == DIRECTION_RINGS_COUNTERCLOCKWISE) {
    ringAxis = ((ringLength - (axis % ringLength)) + seamAxis) % ringLength;
  }

  if (ringHeight == 1u) {
    return vec2<i32>(i32(left + ringAxis), i32(top));
  }
  if (ringWidth == 1u) {
    return vec2<i32>(i32(left), i32(top + ringAxis));
  }

  if (ringAxis < ringWidth) {
    return vec2<i32>(i32(left + ringAxis), i32(top));
  }
  var rest = ringAxis - ringWidth;
  if (rest < (ringHeight - 1u)) {
    return vec2<i32>(i32(right), i32(top + 1u + rest));
  }
  rest = rest - (ringHeight - 1u);
  if (rest < (ringWidth - 1u)) {
    return vec2<i32>(i32(right - 1u - rest), i32(bottom));
  }
  rest = rest - (ringWidth - 1u);
  return vec2<i32>(i32(left), i32(bottom - 1u - rest));
}

// Normalizes each direction into logical 1D lines, then maps line/axis back to image coordinates.
fn coordFromLineAxisWithLengthAndCenter(axis: u32, lineIndex: u32, lineLength: u32, lineCenter: u32, width: u32, height: u32, direction: u32) -> vec2<i32> {
  if (isRingDirection(direction)) {
    return coordFromRingAxis(axis, lineIndex, lineLength, width, height, direction);
  }

  if (isDiagonalDownRightDirection(direction)) {
    var startX = lineIndex;
    var startY = 0u;
    if (lineIndex >= width) {
      startX = 0u;
      startY = lineIndex - width + 1u;
    }
    let diagonalAxis = remapDiagonalAxis(axis, lineIndex, lineLength, lineCenter, width, direction);
    return vec2<i32>(i32(startX + diagonalAxis), i32(startY + diagonalAxis));
  }

  if (isDiagonalDownLeftDirection(direction)) {
    var startX = lineIndex;
    var startY = 0u;
    if (lineIndex >= width) {
      startX = width - 1u;
      startY = lineIndex - width + 1u;
    }
    let diagonalAxis = remapDiagonalAxis(axis, lineIndex, lineLength, lineCenter, width, direction);
    return vec2<i32>(i32(startX - diagonalAxis), i32(startY + diagonalAxis));
  }

  let mappedAxis = remapAxisWithCenter(axis, lineIndex, lineLength, lineCenter, direction);

  if (isVerticalDirection(direction)) {
    return vec2<i32>(i32(lineIndex), i32(mappedAxis));
  }

  if (isHorizontalSplitDirection(direction)) {
    let row = lineIndex / 2u;
    let leftLength = (width + 1u) / 2u;
    if ((lineIndex % 2u) == 0u) {
      return vec2<i32>(i32(mappedAxis), i32(row));
    }
    return vec2<i32>(i32(leftLength + mappedAxis), i32(row));
  }

  if (isVerticalSplitDirection(direction)) {
    let column = lineIndex / 2u;
    let topLength = (height + 1u) / 2u;
    if ((lineIndex % 2u) == 0u) {
      return vec2<i32>(i32(column), i32(mappedAxis));
    }
    return vec2<i32>(i32(column), i32(topLength + mappedAxis));
  }

  return vec2<i32>(i32(mappedAxis), i32(lineIndex));
}

`;

const PIXEL_SORT_SHADER = `
${SORT_PARAMS_SHADER}
${KEY_SHADER}
${THRESHOLD_SHADER}
${LINE_GEOMETRY_SHADER}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let width = u32(params.width);
  let height = u32(params.height);
  let direction = u32(params.direction);
  let lineIndex = gid.y;
  let lineCount = lineCountForDirection(width, height, direction);
  if (lineIndex >= lineCount) {
    return;
  }

  let spanLength = lineLengthForDirection(lineIndex, width, height, direction);
  let lineCenter = lineCenterForDirection(lineIndex, spanLength, width, height, direction);
  let parity = u32(params.passIndex) % 2u;
  let axisA = parity + gid.x * 2u;
  let axisB = axisA + 1;

  if (parity == 1u && gid.x == 0u) {
    let edgeCoord = coordFromLineAxisWithLengthAndCenter(
      0u,
      lineIndex,
      spanLength,
      lineCenter,
      width,
      height,
      direction
    );
    let edgeColor = textureLoad(srcTex, edgeCoord, 0);
    textureStore(dstTex, edgeCoord, edgeColor);
  }

  if (axisA >= spanLength) {
    return;
  }

  let coordA = coordFromLineAxisWithLengthAndCenter(
    axisA,
    lineIndex,
    spanLength,
    lineCenter,
    width,
    height,
    direction
  );

  if (u32(params.passIndex) >= spanLength) {
    let colorA = textureLoad(srcTex, coordA, 0);
    textureStore(dstTex, coordA, colorA);
    if (axisB < spanLength) {
      let coordB = coordFromLineAxisWithLengthAndCenter(
        axisB,
        lineIndex,
        spanLength,
        lineCenter,
        width,
        height,
        direction
      );
      let colorB = textureLoad(srcTex, coordB, 0);
      textureStore(dstTex, coordB, colorB);
    }
    return;
  }

  if (axisB >= spanLength) {
    let edgeColor = textureLoad(srcTex, coordA, 0);
    textureStore(dstTex, coordA, edgeColor);
    return;
  }

  let coordB = coordFromLineAxisWithLengthAndCenter(
    axisB,
    lineIndex,
    spanLength,
    lineCenter,
    width,
    height,
    direction
  );
  let colorA = textureLoad(srcTex, coordA, 0);
  let colorB = textureLoad(srcTex, coordB, 0);
  let keyA = getKey(colorA.rgb);
  let keyB = getKey(colorB.rgb);
  let inSpanA = inSpan(keyA);
  let inSpanB = inSpan(keyB);

  let reverse = i32(params.reverse) == 1;
  let shouldSwap = inSpanA && inSpanB && select(keyA > keyB, keyA < keyB, reverse);

  if (shouldSwap) {
    textureStore(dstTex, coordA, colorB);
    textureStore(dstTex, coordB, colorA);
  } else {
    textureStore(dstTex, coordA, colorA);
    textureStore(dstTex, coordB, colorB);
  }
}
`;

const makePixelSortBitonicShader = (maxLineLength) => {
  const indexBits = Math.ceil(Math.log2(maxLineLength));
  const indexMask = maxLineLength - 1;
  const maxKeyPart = 2 ** (32 - indexBits) - 1;

  return `
${BITONIC_PARAMS_SHADER}

const MAX_LINE_LENGTH: u32 = ${maxLineLength}u;
const INDEX_BITS: u32 = ${indexBits}u;
const MAX_KEY_PART: u32 = ${maxKeyPart}u;
const INDEX_MASK: u32 = ${indexMask}u;

var<workgroup> sortItems: array<u32, ${maxLineLength}>;

fn maxU32() -> u32 {
  return (MAX_KEY_PART << INDEX_BITS) | INDEX_MASK;
}

${KEY_SHADER}
${LINE_GEOMETRY_SHADER}

fn thresholdContains(key: f32) -> bool {
  if (key < params.low) {
    return false;
  }
  if (key > params.high) {
    return false;
  }
  return true;
}

fn pixelInSpan(axis: u32, lineIndex: u32, lineLength: u32, lineCenter: u32) -> bool {
  if (axis >= lineLength) {
    return false;
  }
  let direction = u32(params.direction);
  let width = u32(params.width);
  let height = u32(params.height);
  let color = textureLoad(
    srcTex,
    coordFromLineAxisWithLengthAndCenter(axis, lineIndex, lineLength, lineCenter, width, height, direction),
    0
  );
  return thresholdContains(getKey(color.rgb));
}

fn transformedKey(key: f32, reverse: bool) -> u32 {
  let keyBits = u32(round(clamp(key, 0.0, 1.0) * f32(MAX_KEY_PART)));
  if (reverse) {
    return MAX_KEY_PART - keyBits;
  }
  return keyBits;
}

fn makeSortItem(key: f32, relativeIndex: u32, reverse: bool) -> u32 {
  return (transformedKey(key, reverse) << INDEX_BITS) | (relativeIndex & INDEX_MASK);
}

fn sentinelSortItem() -> u32 {
  return maxU32();
}

fn itemIndex(item: u32) -> u32 {
  return item & INDEX_MASK;
}

fn nextPowerOfTwo(value: u32) -> u32 {
  var result = value - 1u;
  result = result | (result >> 1u);
  result = result | (result >> 2u);
  result = result | (result >> 4u);
  result = result | (result >> 8u);
  result = result | (result >> 16u);
  return result + 1u;
}

@compute @workgroup_size(256)
fn main(
  @builtin(workgroup_id) workgroupId: vec3<u32>,
  @builtin(local_invocation_id) localId: vec3<u32>
) {
  let width = u32(params.width);
  let height = u32(params.height);
  let direction = u32(params.direction);
  let thresholdMode = u32(params.mode) == 1u;
  let lineCount = lineCountForDirection(width, height, direction);
  let lineIndex = workgroupId.x;

  if (lineIndex >= lineCount) {
    return;
  }

  let lineLength = lineLengthForDirection(lineIndex, width, height, direction);
  if (lineLength == 0u || lineLength > MAX_LINE_LENGTH) {
    return;
  }

  let lineCenter = lineCenterForDirection(lineIndex, lineLength, width, height, direction);
  let reverse = u32(params.reverse) == 1u;

  var searchStart = 0u;
  loop {
    var spanStart = 0u;
    var spanEnd = lineLength;

    if (thresholdMode) {
      spanStart = searchStart;
      loop {
        if (spanStart >= lineLength) {
          break;
        }
        if (pixelInSpan(spanStart, lineIndex, lineLength, lineCenter)) {
          break;
        }
        spanStart = spanStart + 1u;
      }

      spanEnd = spanStart;
      loop {
        if (spanEnd >= lineLength) {
          break;
        }
        if (!pixelInSpan(spanEnd, lineIndex, lineLength, lineCenter)) {
          break;
        }
        spanEnd = spanEnd + 1u;
      }
    }

    if (spanStart >= lineLength) {
      break;
    }

    let spanLength = spanEnd - spanStart;
    let sortSize = nextPowerOfTwo(spanLength);

    for (var axis = localId.x; axis < sortSize; axis = axis + 256u) {
      if (axis < spanLength) {
        let sourceAxis = spanStart + axis;
        let color = textureLoad(
          srcTex,
          coordFromLineAxisWithLengthAndCenter(sourceAxis, lineIndex, lineLength, lineCenter, width, height, direction),
          0
        );
        sortItems[axis] = makeSortItem(getKey(color.rgb), axis, reverse);
      } else {
        sortItems[axis] = sentinelSortItem();
      }
    }
    workgroupBarrier();

    var blockSize = 2u;
    loop {
      if (blockSize > sortSize) {
        break;
      }

      var stride = blockSize >> 1u;
      loop {
        if (stride == 0u) {
          break;
        }

        for (var axis = localId.x; axis < sortSize; axis = axis + 256u) {
          let partner = axis ^ stride;
          if (partner > axis && partner < sortSize) {
            let ascending = (axis & blockSize) == 0u;
            let a = sortItems[axis];
            let b = sortItems[partner];
            var shouldSwap = false;
            if (ascending) {
              shouldSwap = a > b;
            } else {
              shouldSwap = a < b;
            }
            if (shouldSwap) {
              sortItems[axis] = b;
              sortItems[partner] = a;
            }
          }
        }
        workgroupBarrier();

        stride = stride >> 1u;
      }

      blockSize = blockSize << 1u;
    }

    for (var axis = localId.x; axis < spanLength; axis = axis + 256u) {
      let sourceAxis = spanStart + itemIndex(sortItems[axis]);
      let color = textureLoad(
        srcTex,
        coordFromLineAxisWithLengthAndCenter(sourceAxis, lineIndex, lineLength, lineCenter, width, height, direction),
        0
      );
      textureStore(
        dstTex,
        coordFromLineAxisWithLengthAndCenter(spanStart + axis, lineIndex, lineLength, lineCenter, width, height, direction),
        color
      );
    }
    workgroupBarrier();

    searchStart = spanEnd;
    if (!thresholdMode) {
      break;
    }
  }
}
`;
};

export default class WebGPUPixelSortPass {
  static type = "PIXELSORT";

  constructor(device, opts = {}) {
    this.device = device;
    this.mode = opts.mode || "Fully Sorted";
    this.low = opts.low ?? 0.2;
    this.high = opts.high ?? 0.8;
    this.sortBy = opts.sortBy || "Luminance";
    this.direction = opts.direction || "Down";
    this.invalidate =
      typeof opts.invalidate === "function" ? opts.invalidate : () => {};
    this.module = device.createShaderModule({
      label: "PixelSortPass shader",
      code: PIXEL_SORT_SHADER,
    });
    this.bindGroupLayout = device.createBindGroupLayout({
      label: "PixelSortPass bind group layout",
      entries: [
        {
          binding: 0,
          visibility: SHADER_STAGE_COMPUTE,
          texture: { sampleType: "float" },
        },
        {
          binding: 1,
          visibility: SHADER_STAGE_COMPUTE,
          storageTexture: { access: "write-only", format: "rgba8unorm" },
        },
        {
          binding: 2,
          visibility: SHADER_STAGE_COMPUTE,
          buffer: {
            type: "uniform",
            hasDynamicOffset: true,
            minBindingSize: UNIFORM_BYTE_SIZE,
          },
        },
      ],
    });
    this.bitonicBindGroupLayout = device.createBindGroupLayout({
      label: "PixelSortPass bitonic bind group layout",
      entries: [
        {
          binding: 0,
          visibility: SHADER_STAGE_COMPUTE,
          texture: { sampleType: "float" },
        },
        {
          binding: 1,
          visibility: SHADER_STAGE_COMPUTE,
          storageTexture: { access: "write-only", format: "rgba8unorm" },
        },
        {
          binding: 2,
          visibility: SHADER_STAGE_COMPUTE,
          buffer: {
            type: "uniform",
            minBindingSize: UNIFORM_BYTE_SIZE,
          },
        },
      ],
    });
    this.pipeline = device.createComputePipeline({
      label: "PixelSortPass pipeline",
      layout: device.createPipelineLayout({
        bindGroupLayouts: [this.bindGroupLayout],
      }),
      compute: { module: this.module, entryPoint: "main" },
    });
    this.maxBitonicLineLength = this._resolveMaxBitonicLineLength();
    this.bitonicPipelines = new Map();
    this.uniformBuffer = null;
    this.uniformCapacity = 0;
    this.uniformUpload = new Float32Array(0);
    this.uniformSignature = "";
    this.bitonicUniformBuffer = this._createBitonicUniformBuffer();
    this.bitonicUniformUpload = new Float32Array(UNIFORM_BYTE_SIZE / 4);
    this.bitonicUniformSignature = "";
  }

  setOption(name, value) {
    const prev = this[name];
    if (name === "mode") this.mode = value;
    else if (name === "low") this.low = +value;
    else if (name === "high") this.high = +value;
    else if (name === "sortBy") this.sortBy = value;
    else if (name === "direction") this.direction = value;
    else if (name === "invalidate") {
      this.invalidate = typeof value === "function" ? value : () => {};
    }

    if (name !== "invalidate" && prev !== this[name]) {
      this.uniformSignature = "";
      this.bitonicUniformSignature = "";
    }
  }

  _createBitonicPipeline(maxLineLength) {
    const module = this.device.createShaderModule({
      label: `PixelSortPass bitonic ${maxLineLength} shader`,
      code: makePixelSortBitonicShader(maxLineLength),
    });

    return this.device.createComputePipeline({
      label: `PixelSortPass bitonic ${maxLineLength} pipeline`,
      layout: this.device.createPipelineLayout({
        bindGroupLayouts: [this.bitonicBindGroupLayout],
      }),
      compute: { module, entryPoint: "main" },
    });
  }

  _getBitonicPipeline(sortSize) {
    let pipeline = this.bitonicPipelines.get(sortSize);
    if (!pipeline) {
      pipeline = this._createBitonicPipeline(sortSize);
      this.bitonicPipelines.set(sortSize, pipeline);
    }
    return pipeline;
  }

  _resolveMaxBitonicLineLength() {
    // Packed sort items keep long lines within WebGPU workgroup storage limits.
    const storageSize = Number(
      this.device.limits?.maxComputeWorkgroupStorageSize,
    ) || 16384;
    const maxLineLength = Math.floor(storageSize / BITONIC_SORT_ITEM_BYTES);
    const cappedLineLength = Math.min(
      maxLineLength,
      BITONIC_MAX_REQUESTED_LINE_LENGTH,
    );
    return this._previousPowerOfTwo(cappedLineLength);
  }

  _createBitonicUniformBuffer() {
    return this.device.createBuffer({
      size: UNIFORM_BYTE_SIZE,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
    });
  }

  _createUniformBuffer(spanLength) {
    return this.device.createBuffer({
      size: UNIFORM_STRIDE * spanLength,
      usage: GPU_BUFFER_USAGE.UNIFORM | GPU_BUFFER_USAGE.COPY_DST,
    });
  }

  _ensureUniformBuffer(spanLength) {
    if (this.uniformBuffer && this.uniformCapacity >= spanLength) return;

    this.uniformBuffer?.destroy();
    this.uniformBuffer = this._createUniformBuffer(spanLength);
    this.uniformCapacity = spanLength;
    this.uniformUpload = new Float32Array(spanLength * UNIFORM_STRIDE_FLOATS);
    this.uniformSignature = "";
  }

  _writeUniformRecord(width, height, passIndex) {
    const dir = DIRECTIONS[this.direction] || DIRECTIONS.Down;
    const offset = passIndex * UNIFORM_STRIDE_FLOATS;
    this.uniformUpload[offset + 0] = width;
    this.uniformUpload[offset + 1] = height;
    this.uniformUpload[offset + 2] = passIndex;
    this.uniformUpload[offset + 3] = dir.reverse;
    this.uniformUpload[offset + 4] = dir.code;
    this.uniformUpload[offset + 5] = this.mode === "Threshold" ? 1 : 0;
    this.uniformUpload[offset + 6] = SORT_BY[this.sortBy] ?? 0;
    this.uniformUpload[offset + 7] = this.low;
    this.uniformUpload[offset + 8] = this.high;
    for (let i = 9; i < 12; i += 1) {
      this.uniformUpload[offset + i] = 0;
    }
  }

  _uniformSignature(width, height, spanLength) {
    return [
      width,
      height,
      spanLength,
      this.mode,
      this.low,
      this.high,
      this.sortBy,
      this.direction,
    ].join(":");
  }

  _syncUniformBuffers(width, height, spanLength) {
    const signature = this._uniformSignature(width, height, spanLength);
    this._ensureUniformBuffer(spanLength);

    if (signature === this.uniformSignature) return;

    for (let i = 0; i < spanLength; i += 1) {
      this._writeUniformRecord(width, height, i);
    }
    this.device.queue.writeBuffer(
      this.uniformBuffer,
      0,
      this.uniformUpload,
      0,
      spanLength * UNIFORM_STRIDE_FLOATS,
    );
    this.uniformSignature = signature;
  }

  _nextPowerOfTwo(value) {
    let result = 1;
    while (result < value) result *= 2;
    return result;
  }

  _previousPowerOfTwo(value) {
    let result = 1;
    while (result * 2 <= value) result *= 2;
    return result;
  }

  _bitonicUniformSignature(width, height, sortSize) {
    return [
      width,
      height,
      sortSize,
      this.mode,
      this.low,
      this.high,
      this.sortBy,
      this.direction,
    ].join(":");
  }

  _syncBitonicUniformBuffer(width, height, sortSize) {
    const signature = this._bitonicUniformSignature(width, height, sortSize);
    if (signature === this.bitonicUniformSignature) return;

    const dir = DIRECTIONS[this.direction] || DIRECTIONS.Down;
    this.bitonicUniformUpload[0] = width;
    this.bitonicUniformUpload[1] = height;
    this.bitonicUniformUpload[2] = sortSize;
    this.bitonicUniformUpload[3] = dir.reverse;
    this.bitonicUniformUpload[4] = dir.code;
    this.bitonicUniformUpload[5] = this.mode === "Threshold" ? 1 : 0;
    this.bitonicUniformUpload[6] = SORT_BY[this.sortBy] ?? 0;
    this.bitonicUniformUpload[7] = this.low;
    this.bitonicUniformUpload[8] = this.high;
    for (let i = 9; i < 12; i += 1) {
      this.bitonicUniformUpload[i] = 0;
    }

    this.device.queue.writeBuffer(
      this.bitonicUniformBuffer,
      0,
      this.bitonicUniformUpload,
      0,
      this.bitonicUniformUpload.length,
    );
    this.bitonicUniformSignature = signature;
  }

  _canUseBitonic(spanLength) {
    return spanLength <= this.maxBitonicLineLength;
  }

  _getLineCount(width, height, dir) {
    if (dir.orientation === "rings") {
      return Math.ceil(Math.min(width, height) / 2);
    }
    if (dir.orientation === "diagonal") return width + height - 1;
    if (dir.orientation === "horizontal-split") return height * 2;
    if (dir.orientation === "vertical-split") return width * 2;
    if (dir.orientation === "vertical") return width;
    return height;
  }

  _getMaxSpanLength(width, height, dir) {
    if (dir.orientation === "rings") {
      if (width === 1) return height;
      if (height === 1) return width;
      return width * 2 + height * 2 - 4;
    }
    if (dir.orientation === "diagonal") return Math.min(width, height);
    if (dir.orientation === "horizontal-split") return Math.ceil(width / 2);
    if (dir.orientation === "vertical-split") return Math.ceil(height / 2);
    if (dir.orientation === "vertical") return height;
    return width;
  }

  _renderBitonic(encoder, state, pool, spanLength, lineCount) {
    const sortSize = this._nextPowerOfTwo(spanLength);
    this._syncBitonicUniformBuffer(state.width, state.height, sortSize);

    const dstTexture = pool.getTemp(state.width, state.height, state.texture);
    if (this.mode === "Threshold") {
      encoder.copyTextureToTexture(
        { texture: state.texture },
        { texture: dstTexture },
        {
          width: state.width,
          height: state.height,
          depthOrArrayLayers: 1,
        },
      );
    }

    const bindGroup = this.device.createBindGroup({
      layout: this.bitonicBindGroupLayout,
      entries: [
        { binding: 0, resource: state.texture.createView() },
        { binding: 1, resource: dstTexture.createView() },
        {
          binding: 2,
          resource: {
            buffer: this.bitonicUniformBuffer,
            offset: 0,
            size: UNIFORM_BYTE_SIZE,
          },
        },
      ],
    });

    const pass = encoder.beginComputePass();
    pass.setPipeline(this._getBitonicPipeline(sortSize));
    pass.setBindGroup(0, bindGroup);
    pass.dispatchWorkgroups(lineCount);
    pass.end();

    return {
      texture: dstTexture,
      width: state.width,
      height: state.height,
    };
  }

  _renderOddEven(encoder, state, pool, spanLength, lineCount) {
    this._syncUniformBuffers(state.width, state.height, spanLength);

    const texA = pool.getTemp(state.width, state.height, state.texture);
    const texB = pool.getTemp(state.width, state.height, [
      state.texture,
      texA,
    ]);
    const textureViews = new Map();
    const getView = (texture) => {
      let view = textureViews.get(texture);
      if (!view) {
        view = texture.createView();
        textureViews.set(texture, view);
      }
      return view;
    };
    let srcTexture = state.texture;
    let dstTexture = texA;
    const workgroupsX = Math.ceil(Math.ceil(spanLength / 2) / 8);
    const workgroupsY = Math.ceil(lineCount / 8);
    const createSortBindGroup = (src, dst) =>
      this.device.createBindGroup({
        layout: this.bindGroupLayout,
        entries: [
          { binding: 0, resource: getView(src) },
          { binding: 1, resource: getView(dst) },
          {
            binding: 2,
            resource: {
              buffer: this.uniformBuffer,
              offset: 0,
              size: UNIFORM_BYTE_SIZE,
            },
          },
        ],
      });
    const firstBindGroup = createSortBindGroup(state.texture, texA);
    const aToB = createSortBindGroup(texA, texB);
    const bToA = createSortBindGroup(texB, texA);

    for (let i = 0; i < spanLength; i += 1) {
      const bindGroup =
        i === 0 ? firstBindGroup : srcTexture === texA ? aToB : bToA;
      const pass = encoder.beginComputePass();
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, bindGroup, [i * UNIFORM_STRIDE]);
      pass.dispatchWorkgroups(workgroupsX, workgroupsY);
      pass.end();

      srcTexture = dstTexture;
      dstTexture = dstTexture === texA ? texB : texA;
    }

    const finalTexture = srcTexture;
    const spareTexture = finalTexture === texA ? texB : texA;
    pool.returnTemp(spareTexture, state.width, state.height);

    return {
      texture: finalTexture,
      width: state.width,
      height: state.height,
    };
  }

  render(encoder, state, pool) {
    const dir = DIRECTIONS[this.direction] || DIRECTIONS.Down;
    const spanLength = this._getMaxSpanLength(state.width, state.height, dir);
    const lineCount = this._getLineCount(state.width, state.height, dir);
    if (spanLength <= 1) return state;
    if (this.mode === "Threshold" && this.low >= this.high) return state;

    if (this._canUseBitonic(spanLength)) {
      return this._renderBitonic(
        encoder,
        state,
        pool,
        spanLength,
        lineCount,
      );
    }

    return this._renderOddEven(encoder, state, pool, spanLength, lineCount);
  }

  destroy() {
    this.uniformBuffer?.destroy();
    this.bitonicUniformBuffer?.destroy();
    this.uniformBuffer = null;
    this.bitonicUniformBuffer = null;
    this.uniformCapacity = 0;
    this.uniformUpload = new Float32Array(0);
    this.bitonicUniformUpload = new Float32Array(0);
  }
}
