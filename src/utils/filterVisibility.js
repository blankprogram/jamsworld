export function getQuadtreeMaskedArea(opts = {}) {
  if (opts.maskedArea) return opts.maskedArea;
  return opts.maskOverlay === "No" ? "Fill" : "Original";
}

export function shouldHideFilterOption(filter, optionName) {
  if (
    (filter.type === "PIXELSORT" ||
      filter.type === "ASCII" ||
      filter.type === "MINESWEEPER" ||
      filter.type === "MINECRAFT") &&
    (optionName === "low" || optionName === "high") &&
    filter.opts.mode !== "Threshold"
  ) {
    return true;
  }

  if (
    filter.type === "ASCII" &&
    optionName === "textColor" &&
    filter.opts.textColorMode !== "Custom"
  ) {
    return true;
  }

  if (
    filter.type === "ASCII" &&
    optionName === "fill" &&
    filter.opts.fillMode === "Transparent"
  ) {
    return true;
  }

  if (
    filter.type === "SCALE" &&
    (optionName === "scaleX" || optionName === "scaleY") &&
    filter.opts.uniform !== "No"
  ) {
    return true;
  }

  if (
    filter.type === "SCALE" &&
    optionName === "scale" &&
    filter.opts.uniform !== "Yes"
  ) {
    return true;
  }

  if (
    filter.type === "DITHER" &&
    optionName === "dizzyStyle" &&
    filter.opts.algo !== "Dizzy"
  ) {
    return true;
  }

  if (
    filter.type === "DITHER" &&
    optionName === "levels" &&
    filter.opts.algo === "Dizzy" &&
    filter.opts.dizzyStyle !== "Standard"
  ) {
    return true;
  }

  if (
    filter.type === "KUWAHARA" &&
    optionName === "brushiness" &&
    filter.opts.style !== "Brushy"
  ) {
    return true;
  }

  if (
    filter.type === "QUADTREE" &&
    (optionName === "low" ||
      optionName === "high" ||
      optionName === "maskedArea" ||
      optionName === "maskFill") &&
    filter.opts.mode !== "Threshold"
  ) {
    return true;
  }

  if (
    filter.type === "QUADTREE" &&
    optionName === "maskFillColor" &&
    (filter.opts.mode !== "Threshold" ||
      getQuadtreeMaskedArea(filter.opts) !== "Fill" ||
      filter.opts.maskFill !== "Color")
  ) {
    return true;
  }

  if (
    filter.type === "QUADTREE" &&
    optionName === "maskFill" &&
    getQuadtreeMaskedArea(filter.opts) !== "Fill"
  ) {
    return true;
  }

  if (
    filter.type === "QUADTREE" &&
    optionName === "shapeBounds" &&
    (filter.opts.shape || "Square") === "Square"
  ) {
    return true;
  }

  if (
    filter.type === "QUADTREE" &&
    optionName === "shapeBackgroundColor" &&
    (filter.opts.shape || "Square") === "Square"
  ) {
    return true;
  }

  if (
    filter.type === "QUADTREE" &&
    optionName === "lineColor" &&
    filter.opts.showOutlines === "No"
  ) {
    return true;
  }

  return false;
}
