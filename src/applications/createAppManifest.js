const DEFAULT_WINDOW_DEFAULTS = Object.freeze({
  width: 1200,
  height: 700,
  minWidth: 600,
  minHeight: 200,
  resizable: true,
});

const normalizeDimension = (value, fallback) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  return fallback;
};

const normalizeWindowDefaults = (windowDefaults = {}) => ({
  width: normalizeDimension(windowDefaults.width, DEFAULT_WINDOW_DEFAULTS.width),
  height: normalizeDimension(windowDefaults.height, DEFAULT_WINDOW_DEFAULTS.height),
  minWidth: normalizeDimension(
    windowDefaults.minWidth,
    DEFAULT_WINDOW_DEFAULTS.minWidth,
  ),
  minHeight: normalizeDimension(
    windowDefaults.minHeight,
    DEFAULT_WINDOW_DEFAULTS.minHeight,
  ),
  resizable:
    typeof windowDefaults.resizable === "boolean"
      ? windowDefaults.resizable
      : DEFAULT_WINDOW_DEFAULTS.resizable,
});

export function createAppManifest({
  id,
  title,
  icon,
  useStyledWindow = true,
  windowDefaults,
}) {
  return {
    id,
    title,
    icon,
    useStyledWindow,
    windowDefaults: normalizeWindowDefaults(windowDefaults),
  };
}

export { DEFAULT_WINDOW_DEFAULTS, normalizeWindowDefaults };
