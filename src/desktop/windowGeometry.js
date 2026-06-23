import { TASKBAR_HEIGHT } from "./layoutConstants";

export const DEFAULT_VIEWPORT_SIZE = { width: 1440, height: 900 };
export const MIN_DESKTOP_HEIGHT = 120;
export const WINDOW_STAGGER_OFFSET = 24;

export const clampValue = (value, min, max) =>
  Math.min(Math.max(value, min), max);

export const getViewportSize = () => {
  if (typeof window === "undefined") return DEFAULT_VIEWPORT_SIZE;
  return {
    width: window.innerWidth || DEFAULT_VIEWPORT_SIZE.width,
    height: window.innerHeight || DEFAULT_VIEWPORT_SIZE.height,
  };
};

export const getDesktopBounds = (viewport = getViewportSize()) => ({
  x: 0,
  y: 0,
  width: viewport.width,
  height: Math.max(MIN_DESKTOP_HEIGHT, viewport.height - TASKBAR_HEIGHT),
});

export const clampWindowRect = (
  rect,
  minWidth,
  minHeight,
  bounds = getDesktopBounds(),
) => {
  const width = Math.min(
    Math.max(rect.width, minWidth),
    Math.max(minWidth, bounds.width),
  );
  const height = Math.min(
    Math.max(rect.height, minHeight),
    Math.max(minHeight, bounds.height),
  );

  const x = clampValue(
    rect.x,
    bounds.x,
    Math.max(bounds.x, bounds.x + bounds.width - width),
  );
  const y = clampValue(
    rect.y,
    bounds.y,
    Math.max(bounds.y, bounds.y + bounds.height - height),
  );

  return { x, y, width, height };
};

export const centerWindowRect = (windowDefaults, index, bounds = getDesktopBounds()) => {
  const width = Math.min(windowDefaults.width, bounds.width);
  const height = Math.min(windowDefaults.height, bounds.height);
  const stagger = WINDOW_STAGGER_OFFSET * (index % 8);

  return clampWindowRect(
    {
      x: Math.floor(bounds.x + (bounds.width - width) / 2) + stagger,
      y: Math.floor(bounds.y + (bounds.height - height) / 2) + stagger,
      width,
      height,
    },
    windowDefaults.minWidth,
    windowDefaults.minHeight,
    bounds,
  );
};

export const getBottomRightPosition = (
  width,
  height,
  bounds = getDesktopBounds(),
) => ({
  x: bounds.x + bounds.width - width,
  y: bounds.y + bounds.height - height,
});
