import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { loadFonts } from "../../utils/fontUtils";
import styles from "./PixelPass.module.css";
import {
  draggable,
  dropTargetForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { useProcessMedia } from "../../hooks/useProcessMedia";
import {
  InvertPass,
  GrayscalePass,
  GaussianBlurPass,
  SharpenPass,
  SobelPass,
  PosterizePass,
  AsciiPass,
  DitherPass,
  PalettePass,
  EmbossPass,
  ChromaticAberrationPass,
  PixelSortPass,
  BloomPass,
  FilmGrainPass,
  XDoGPass,
  VHSPass,
  CRTPass,
  MinesweeperPass,
  ScalePass,
} from "../../utils/GL/passes";
import startIcon from "../../assets/Icons/start.png";
import { createAppManifest } from "../createAppManifest";
import { createPixelPassIcon } from "../../utils/appIconFactory";
import MaskEditor from "./MaskEditor";

export const appManifest = createAppManifest({
  id: "pixelpass",
  title: "PixelPass",
  icon: createPixelPassIcon() || startIcon,
});

const ALL_PASSES = [
  InvertPass,
  GrayscalePass,
  GaussianBlurPass,
  SharpenPass,
  ScalePass,
  SobelPass,
  PosterizePass,
  AsciiPass,
  DitherPass,
  PalettePass,
  EmbossPass,
  ChromaticAberrationPass,
  PixelSortPass,
  BloomPass,
  FilmGrainPass,
  XDoGPass,
  VHSPass,
  CRTPass,
  MinesweeperPass,
];

const DEFAULT_CUSTOM_COLORS = [
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFFFF",
  "#000000",
];
const INACTIVE_INDEX = -1;
const MASK_TOOL_OPTIONS = [
  { id: "select", label: "Select" },
  { id: "rect", label: "Rect" },
  { id: "ellipse", label: "Ellipse" },
  { id: "draw", label: "Draw" },
  { id: "eraser", label: "Eraser" },
];

const makeId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createOffscreenMaskCanvas = () => {
  if (typeof document === "undefined") return null;
  return document.createElement("canvas");
};

function shouldHideOption(filter, optionName) {
  if (
    (filter.type === "PIXELSORT" ||
      filter.type === "ASCII" ||
      filter.type === "MINESWEEPER") &&
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

  return false;
}

function createFilterDefaults(def) {
  const opts = {};
  for (const option of def.options) {
    opts[option.name] =
      option.name === "customColors"
        ? [...DEFAULT_CUSTOM_COLORS]
        : option.defaultValue;
  }
  return opts;
}

function isValidDropBetween(filters, from, to) {
  return !(
    from == null ||
    to == null ||
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= filters.length ||
    to > filters.length
  );
}

function isValidSwap(filters, from, to) {
  return !(
    from == null ||
    to == null ||
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= filters.length ||
    to >= filters.length
  );
}

function reorderBetween(filters, from, to) {
  if (!isValidDropBetween(filters, from, to)) return filters;
  const next = [...filters];
  const [dragged] = next.splice(from, 1);
  next.splice(to > from ? to - 1 : to, 0, dragged);
  return next;
}

function swapFilters(filters, from, to) {
  if (!isValidSwap(filters, from, to)) return filters;
  const next = [...filters];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

function traceMaskSegmentPath(ctx, segment, width, height) {
  if (segment.type === "rect") {
    ctx.beginPath();
    ctx.rect(
      segment.x * width,
      segment.y * height,
      segment.w * width,
      segment.h * height,
    );
    return true;
  }

  if (segment.type === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(
      (segment.x + segment.w / 2) * width,
      (segment.y + segment.h / 2) * height,
      (segment.w / 2) * width,
      (segment.h / 2) * height,
      0,
      0,
      Math.PI * 2,
    );
    return true;
  }

  if (segment.type === "polygon") {
    const pts = segment.points || [];
    if (pts.length < 3) return false;
    ctx.beginPath();
    ctx.moveTo(pts[0].x * width, pts[0].y * height);
    for (let i = 1; i < pts.length; i += 1) {
      ctx.lineTo(pts[i].x * width, pts[i].y * height);
    }
    ctx.closePath();
    return true;
  }

  return false;
}

function getNormalizedStrokeSize(stroke) {
  if (Number.isFinite(stroke?.size) && stroke.size > 0) return stroke.size;
  if (
    Number.isFinite(stroke?.sizePx) &&
    Number.isFinite(stroke?.sourceMaxDimension) &&
    stroke.sourceMaxDimension > 0
  ) {
    return stroke.sizePx / stroke.sourceMaxDimension;
  }
  return 0.003;
}

function strokeMaskSegment(ctx, stroke, width, height, maxDimension) {
  const pts = stroke.points || [];
  if (!pts.length) return false;
  ctx.lineWidth = Math.max(1, getNormalizedStrokeSize(stroke) * maxDimension);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0].x * width, pts[0].y * height);
  for (let i = 1; i < pts.length; i += 1) {
    ctx.lineTo(pts[i].x * width, pts[i].y * height);
  }
  ctx.stroke();

  // Fill point centers to avoid tiny raster gaps in fast pointer movement cases.
  const radius = ctx.lineWidth / 2;
  if (radius > 0) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 1) {
      const px = pts[i].x * width;
      const py = pts[i].y * height;
      ctx.moveTo(px + radius, py);
      ctx.arc(px, py, radius, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  return true;
}

function rasterizeMask(canvas, segments) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  const maxDim = Math.max(w, h);

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, w, h);

  for (const segment of segments) {
    const include = segment.mode !== "exclude";
    ctx.fillStyle = "rgba(255,255,255,1)";
    ctx.strokeStyle = "rgba(255,255,255,1)";

    if (include) {
      if (traceMaskSegmentPath(ctx, segment, w, h)) {
        ctx.globalCompositeOperation = "source-over";
        ctx.fill();

        const erasers = segment.erasers || [];
        if (erasers.length) {
          ctx.save();
          if (traceMaskSegmentPath(ctx, segment, w, h)) {
            ctx.clip();
            ctx.globalCompositeOperation = "destination-out";
            for (const eraserStroke of erasers) {
              strokeMaskSegment(ctx, eraserStroke, w, h, maxDim);
            }
          }
          ctx.restore();
        }
        continue;
      }

      if (segment.type === "stroke") {
        ctx.globalCompositeOperation = "source-over";
        strokeMaskSegment(ctx, segment, w, h, maxDim);
        continue;
      }
    }

    ctx.globalCompositeOperation = "destination-out";
    if (traceMaskSegmentPath(ctx, segment, w, h)) {
      ctx.fill();
      continue;
    }

    if (segment.type === "stroke") {
      strokeMaskSegment(ctx, segment, w, h, maxDim);
      continue;
    }
  }

  ctx.restore();
}

function getFilterDefs(fonts) {
  const defs = {};
  for (const PassClass of ALL_PASSES) {
    const def = { ...PassClass.def };
    if (def.type === "ASCII") {
      def.options = def.options.map((opt) =>
        opt.name === "font"
          ? { ...opt, type: "select", options: fonts, defaultValue: fonts[0] }
          : opt,
      );
    }
    defs[def.type] = { Pass: PassClass, ...def };
  }
  return defs;
}

const FilterControl = ({
  label,
  type,
  name,
  value,
  options,
  onChange,
  props,
}) => (
  <label className={styles.filterLabel}>
    {label}:
    {type === "select" ? (
      <select name={name} value={value} onChange={onChange}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    ) : type === "range" ? (
      <div className={styles.rangeWrapper}>
        <input
          type="range"
          name={name}
          value={value}
          onChange={onChange}
          {...props}
          className={styles.rangeInput}
        />
        <span className={styles.rangeValue}>{value}</span>
      </div>
    ) : (
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        {...props}
      />
    )}
  </label>
);

const DropZone = React.memo(function DropZone({
  onDrop,
  onDragEnter,
  onDragLeave,
  isActive,
  idx,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const cleanup = dropTargetForElements({
      element: el,
      getData: () => ({ dropZoneIdx: idx }),
      canDrop: () => true,
      onDrop: ({ source }) => onDrop(idx, source?.data?.index),
      onDragEnter: () => onDragEnter?.(idx),
      onDragLeave: () => onDragLeave?.(idx),
    });

    return () => cleanup?.();
  }, [idx, onDrop, onDragEnter, onDragLeave]);

  return (
    <div
      ref={ref}
      className={`${styles.dropZone} ${isActive ? styles.isActive : ""}`}
    />
  );
});

const FilterOptions = React.memo(function FilterOptions({
  filter,
  index,
  defs,
  toggleFilter,
  handleOptionChange,
  removeFilter,
  toggleEnabled,
  addCustomColor,
  removeCustomColor,
  swapActive,
  onSwapDrop,
  onSwapEnter,
  onSwapLeave,
}) {
  const ref = useRef(null);
  const cfg = filter ? defs[filter.type] : null;
  const visibleOptions = useMemo(() => {
    if (!cfg) return [];
    return cfg.options.filter((opt) => {
      if (shouldHideOption(filter, opt.name)) return false;
      if (
        filter.type === "PALETTE" &&
        opt.name === "customColors" &&
        filter.opts.preset !== "Custom"
      ) {
        return false;
      }
      return true;
    });
  }, [cfg, filter]);
  const canToggleOpen = visibleOptions.length > 0;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const cleanup = draggable({
      element: el,
      dragHandle: el.querySelector(`.${styles.filterTitle}`),
      getInitialData: () => ({ index }),
    });

    return () => cleanup?.();
  }, [index]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const cleanup = dropTargetForElements({
      element: el,
      getData: () => ({ swapIdx: index }),
      canDrop: () => true,
      onDrop: ({ source }) => onSwapDrop(index, source?.data?.index),
      onDragEnter: () => onSwapEnter(index),
      onDragLeave: () => onSwapLeave(index),
    });

    return () => cleanup?.();
  }, [index, onSwapDrop, onSwapEnter, onSwapLeave]);

  if (!cfg) return null;

  return (
    <div
      ref={ref}
      className={`${styles.filterOptions} ${filter.enabled ? styles.enabled : ""} ${swapActive ? styles.swapActive : ""}`}
    >
      <div className={styles.filterHeader}>
        <h4
          className={`${styles.filterTitle} ${!canToggleOpen ? styles.filterTitleDisabled : ""}`}
          onClick={canToggleOpen ? () => toggleFilter(index) : undefined}
        >
          {cfg.title}
        </h4>
        <div className={styles.filterIcons}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => toggleEnabled(index)}
            aria-label={filter.enabled ? "Disable filter" : "Enable filter"}
          >
            {filter.enabled ? "👁️" : "🚫"}
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.delete}`}
            onClick={() => removeFilter(index)}
            aria-label="Remove filter"
          />
        </div>
      </div>

      {canToggleOpen && filter.open && (
        <div className={styles.filterContent}>
          {visibleOptions.map((opt) => {
            if (filter.type === "PALETTE" && opt.name === "customColors") {
              return (
                <div key="customColors" className={styles.customColors}>
                  {filter.opts.customColors.map((col, ci) => (
                    <div key={ci}>
                      <input
                        type="color"
                        value={col}
                        onChange={(e) =>
                          handleOptionChange(
                            index,
                            "customColors",
                            filter.opts.customColors.map((c, j) =>
                              j === ci ? e.target.value : c,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        onClick={() => removeCustomColor(index, ci)}
                        aria-label="Remove custom color"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addCustomColor(index)}
                    aria-label="Add custom color"
                  >
                    + Add
                  </button>
                </div>
              );
            }

            return (
              <FilterControl
                key={opt.name}
                {...opt}
                value={filter.opts[opt.name]}
                onChange={(e) =>
                  handleOptionChange(index, opt.name, e.target.value)
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
});

const TopMenuAction = React.memo(function TopMenuAction({
  label,
  onActivate,
  disabled = false,
  active = false,
  expanded,
}) {
  const handleClick = useCallback(() => onActivate?.(), [onActivate]);

  return (
    <button
      type="button"
      disabled={disabled}
      aria-expanded={expanded}
      className={`${styles.topMenuButton} ${active ? styles.topMenuButtonActive : ""} ${disabled ? styles.topMenuButtonDisabled : ""}`}
      onClick={handleClick}
    >
      {label}
    </button>
  );
});

function useFilterStackState(defs) {
  const [filters, setFilters] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [dropZoneActive, setDropZoneActive] = useState(INACTIVE_INDEX);
  const [swapIdx, setSwapIdx] = useState(INACTIVE_INDEX);

  const processingFilters = useMemo(
    () =>
      filters.map(({ id, type, opts, enabled }) => ({
        id,
        type,
        opts,
        enabled,
      })),
    [filters],
  );
  const availableFilterEntries = useMemo(() => Object.entries(defs), [defs]);

  const clearDnDUI = useCallback(() => {
    setDropZoneActive(INACTIVE_INDEX);
    setSwapIdx(INACTIVE_INDEX);
  }, []);

  const handleDropBetween = useCallback(
    (dropIdx, sourceIdx) => {
      setFilters((fs) => reorderBetween(fs, sourceIdx, dropIdx));
      clearDnDUI();
    },
    [clearDnDUI],
  );

  const handleSwapDrop = useCallback(
    (targetIdx, sourceIdx) => {
      setFilters((fs) => swapFilters(fs, sourceIdx, targetIdx));
      clearDnDUI();
    },
    [clearDnDUI],
  );

  const handleDropZoneEnter = useCallback((idx) => setDropZoneActive(idx), []);
  const handleDropZoneLeave = useCallback(
    () => setDropZoneActive(INACTIVE_INDEX),
    [],
  );
  const handleSwapEnter = useCallback((idx) => setSwapIdx(idx), []);
  const handleSwapLeave = useCallback(() => setSwapIdx(INACTIVE_INDEX), []);

  const closeAddMenu = useCallback(() => setShowAdd(false), []);
  const toggleShowAdd = useCallback(() => setShowAdd((v) => !v), []);

  const addFilter = useCallback(
    (type) => {
      const def = defs[type];
      if (!def) return;

      setFilters((fs) => [
        ...fs,
        {
          id: makeId(),
          type,
          opts: createFilterDefaults(def),
          open: false,
          enabled: true,
        },
      ]);
      setShowAdd(false);
    },
    [defs],
  );

  const handleOptionChange = useCallback((i, name, val) => {
    setFilters((fs) =>
      fs.map((f, j) =>
        j === i ? { ...f, opts: { ...f.opts, [name]: val } } : f,
      ),
    );
  }, []);

  const addCustomColor = useCallback((i) => {
    setFilters((fs) =>
      fs.map((f, j) =>
        j === i
          ? {
              ...f,
              opts: {
                ...f.opts,
                customColors: [...f.opts.customColors, "#000000"],
              },
            }
          : f,
      ),
    );
  }, []);

  const removeCustomColor = useCallback((i, ci) => {
    setFilters((fs) =>
      fs.map((f, j) =>
        j === i
          ? {
              ...f,
              opts: {
                ...f.opts,
                customColors: f.opts.customColors.filter((_, k) => k !== ci),
              },
            }
          : f,
      ),
    );
  }, []);

  const removeFilter = useCallback((i) => {
    setFilters((fs) => fs.filter((_, j) => j !== i));
  }, []);

  const toggleFilter = useCallback((i) => {
    setFilters((fs) =>
      fs.map((f, j) => (j === i ? { ...f, open: !f.open } : f)),
    );
  }, []);

  const toggleEnabled = useCallback((i) => {
    setFilters((fs) =>
      fs.map((f, j) => (j === i ? { ...f, enabled: !f.enabled } : f)),
    );
  }, []);

  return {
    filters,
    showAdd,
    dropZoneActive,
    swapIdx,
    processingFilters,
    availableFilterEntries,
    handleDropBetween,
    handleSwapDrop,
    handleDropZoneEnter,
    handleDropZoneLeave,
    handleSwapEnter,
    handleSwapLeave,
    closeAddMenu,
    toggleShowAdd,
    addFilter,
    handleOptionChange,
    addCustomColor,
    removeCustomColor,
    removeFilter,
    toggleFilter,
    toggleEnabled,
  };
}

function useMaskState() {
  const [showMaskSettings, setShowMaskSettings] = useState(false);
  const [maskEnabled, setMaskEnabled] = useState(false);
  const [maskInvert, setMaskInvert] = useState(false);
  const [maskShowOutlines, setMaskShowOutlines] = useState(true);
  const [maskTool, setMaskTool] = useState("draw");
  const [maskBrushSize, setMaskBrushSize] = useState(24);
  const [maskSegments, setMaskSegments] = useState([]);
  const [selectedMaskSegmentId, setSelectedMaskSegmentId] = useState(null);
  const [maskVersion, setMaskVersion] = useState(0);

  useEffect(() => {
    if (!maskEnabled) setSelectedMaskSegmentId(null);
  }, [maskEnabled]);

  useEffect(() => {
    if (!selectedMaskSegmentId) return;
    const exists = maskSegments.some((segment) => segment.id === selectedMaskSegmentId);
    if (!exists) setSelectedMaskSegmentId(null);
  }, [maskSegments, selectedMaskSegmentId]);

  const removeSelectedMaskSegment = useCallback(() => {
    if (!selectedMaskSegmentId) return;
    setMaskSegments((prev) =>
      prev.filter((segment) => segment.id !== selectedMaskSegmentId),
    );
    setSelectedMaskSegmentId(null);
  }, [selectedMaskSegmentId]);

  const clearMask = useCallback(() => {
    setMaskSegments([]);
    setSelectedMaskSegmentId(null);
  }, []);

  return {
    showMaskSettings,
    setShowMaskSettings,
    maskEnabled,
    setMaskEnabled,
    maskInvert,
    setMaskInvert,
    maskShowOutlines,
    setMaskShowOutlines,
    maskTool,
    setMaskTool,
    maskBrushSize,
    setMaskBrushSize,
    maskSegments,
    setMaskSegments,
    selectedMaskSegmentId,
    setSelectedMaskSegmentId,
    maskVersion,
    setMaskVersion,
    removeSelectedMaskSegment,
    clearMask,
  };
}

function useViewportSizing(imageSurfaceRef, canvasRef) {
  const [surfaceSize, setSurfaceSize] = useState({ width: 0, height: 0 });
  const [contentSize, setContentSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    const surface = imageSurfaceRef.current;
    if (!surface || typeof ResizeObserver === "undefined") return undefined;

    const updateSurfaceSize = () => {
      setSurfaceSize({
        width: surface.clientWidth || 0,
        height: surface.clientHeight || 0,
      });
    };

    updateSurfaceSize();
    const observer = new ResizeObserver(updateSurfaceSize);
    observer.observe(surface);

    return () => observer.disconnect();
  }, [imageSurfaceRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const updateContentSize = () => {
      setContentSize({
        width: Math.max(1, canvas.width || 1),
        height: Math.max(1, canvas.height || 1),
      });
    };

    updateContentSize();

    if (typeof MutationObserver === "undefined") return undefined;
    const observer = new MutationObserver(updateContentSize);
    observer.observe(canvas, {
      attributes: true,
      attributeFilter: ["width", "height"],
    });

    return () => observer.disconnect();
  }, [canvasRef]);

  return { surfaceSize, contentSize };
}

function useMaskMenuDismiss(showMaskSettings, setShowMaskSettings, maskMenuRef) {
  useEffect(() => {
    if (!showMaskSettings) return undefined;

    const handlePointerDown = (event) => {
      const root = maskMenuRef.current;
      if (!root) return;
      if (!root.contains(event.target)) setShowMaskSettings(false);
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setShowMaskSettings(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showMaskSettings, setShowMaskSettings, maskMenuRef]);
}

function useMaskRasterization(
  maskCanvasRef,
  maskEnabled,
  maskSegments,
  contentSize,
  setMaskVersion,
) {
  useEffect(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;

    const targetWidth = Math.max(1, contentSize.width || 1);
    const targetHeight = Math.max(1, contentSize.height || 1);

    if (maskCanvas.width !== targetWidth) maskCanvas.width = targetWidth;
    if (maskCanvas.height !== targetHeight) maskCanvas.height = targetHeight;

    if (!maskEnabled || !maskSegments.length) {
      const ctx = maskCanvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      setMaskVersion((v) => v + 1);
      return;
    }

    rasterizeMask(maskCanvas, maskSegments);
    setMaskVersion((v) => v + 1);
  }, [
    maskCanvasRef,
    maskEnabled,
    maskSegments,
    contentSize.width,
    contentSize.height,
    setMaskVersion,
  ]);
}

export default function PixelPass() {
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const imageSurfaceRef = useRef(null);
  const maskMenuRef = useRef(null);
  const maskCanvasRef = useRef(createOffscreenMaskCanvas());

  const [fonts, setFonts] = useState([]);
  const [canExport, setCanExport] = useState(false);
  const [fileURL, setFileURL] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    loadFonts().then(setFonts);
  }, []);

  const defs = useMemo(() => getFilterDefs(fonts), [fonts]);
  const {
    filters,
    showAdd,
    dropZoneActive,
    swapIdx,
    processingFilters,
    availableFilterEntries,
    handleDropBetween,
    handleSwapDrop,
    handleDropZoneEnter,
    handleDropZoneLeave,
    handleSwapEnter,
    handleSwapLeave,
    closeAddMenu,
    toggleShowAdd,
    addFilter,
    handleOptionChange,
    addCustomColor,
    removeCustomColor,
    removeFilter,
    toggleFilter,
    toggleEnabled,
  } = useFilterStackState(defs);
  const {
    showMaskSettings,
    setShowMaskSettings,
    maskEnabled,
    setMaskEnabled,
    maskInvert,
    setMaskInvert,
    maskShowOutlines,
    setMaskShowOutlines,
    maskTool,
    setMaskTool,
    maskBrushSize,
    setMaskBrushSize,
    maskSegments,
    setMaskSegments,
    selectedMaskSegmentId,
    setSelectedMaskSegmentId,
    maskVersion,
    setMaskVersion,
    removeSelectedMaskSegment,
    clearMask,
  } = useMaskState();
  const { surfaceSize, contentSize } = useViewportSizing(
    imageSurfaceRef,
    canvasRef,
  );

  const maskConfig = useMemo(
    () => ({
      enabled: maskEnabled,
      invert: maskInvert,
      canvas: maskCanvasRef.current,
      version: maskVersion,
    }),
    [maskEnabled, maskInvert, maskVersion],
  );
  const mediaConfig = useMemo(() => {
    return { defs, filters: processingFilters, mask: maskConfig };
  }, [defs, processingFilters, maskConfig]);

  const { loadFile, exportResult } = useProcessMedia(canvasRef, mediaConfig, {
    cameraOn,
    videoRef,
  });

  const handleFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (fileURL) URL.revokeObjectURL(fileURL);

      const url = await loadFile(file);
      setFileURL(url);
      setCanExport(true);
      closeAddMenu();
    },
    [loadFile, fileURL, closeAddMenu],
  );

  useEffect(
    () => () => {
      if (fileURL) URL.revokeObjectURL(fileURL);
    },
    [fileURL],
  );
  useMaskMenuDismiss(showMaskSettings, setShowMaskSettings, maskMenuRef);
  useMaskRasterization(
    maskCanvasRef,
    maskEnabled,
    maskSegments,
    contentSize,
    setMaskVersion,
  );

  const imageViewportStyle = useMemo(() => {
    const sw = surfaceSize.width;
    const sh = surfaceSize.height;
    const cw = contentSize.width;
    const ch = contentSize.height;
    if (sw <= 0 || sh <= 0 || cw <= 0 || ch <= 0) return undefined;

    const surfaceAspect = sw / sh;
    const contentAspect = cw / ch;

    if (contentAspect > surfaceAspect) {
      const width = sw;
      const height = sw / contentAspect;
      return {
        left: 0,
        top: (sh - height) / 2,
        width,
        height,
      };
    }

    const height = sh;
    const width = sh * contentAspect;
    return {
      left: (sw - width) / 2,
      top: 0,
      width,
      height,
    };
  }, [surfaceSize, contentSize]);

  const handleExport = useCallback(
    () => exportResult("pixelpass"),
    [exportResult],
  );

  return (
    <div className={styles.mainContainer}>
      <div className={styles.topMenuBar}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFile}
          accept="image/*,video/*,.gif"
          className={styles.field}
        />
        <TopMenuAction
          label="Choose File"
          disabled={cameraOn}
          onActivate={() => fileInputRef.current?.click()}
        />
        <TopMenuAction
          label="Export"
          disabled={!canExport || cameraOn}
          onActivate={handleExport}
        />
        <TopMenuAction
          label={cameraOn ? "Stop Camera" : "Use Camera"}
          onActivate={() => setCameraOn((v) => !v)}
        />

        <div ref={maskMenuRef} className={styles.topMenuGroup}>
          <TopMenuAction
            label="Mask Settings"
            active={showMaskSettings}
            expanded={showMaskSettings}
            onActivate={() => setShowMaskSettings((v) => !v)}
          />

          {showMaskSettings && (
            <div className={styles.maskMenuDropdown}>
              <div className={styles.maskButtonsRow}>
                <button
                  type="button"
                  className="xpButton"
                  onClick={() => setMaskEnabled((v) => !v)}
                >
                  {maskEnabled ? "Disable Mask" : "Enable Mask"}
                </button>

                <button
                  type="button"
                  className={`xpButton ${maskInvert ? styles.maskButtonActive : ""}`}
                  disabled={!maskEnabled}
                  onClick={() => setMaskInvert((v) => !v)}
                >
                  Invert Mask {maskInvert ? "On" : "Off"}
                </button>

                <button
                  type="button"
                  className={`xpButton ${!maskShowOutlines ? styles.maskButtonActive : ""}`}
                  disabled={!maskEnabled}
                  onClick={() => setMaskShowOutlines((v) => !v)}
                >
                  {maskShowOutlines ? "Hide Outlines" : "Show Outlines"}
                </button>
              </div>

              <div className={styles.maskTools}>
                {MASK_TOOL_OPTIONS.map((toolDef) => (
                  <button
                    key={toolDef.id}
                    type="button"
                    className={`xpButton ${maskTool === toolDef.id ? styles.maskToolActive : ""}`}
                    disabled={!maskEnabled}
                    onClick={() => setMaskTool(toolDef.id)}
                  >
                    {toolDef.label}
                  </button>
                ))}
              </div>

              <label className={styles.maskBrushSize}>
                Eraser Size
                <input
                  type="range"
                  min={4}
                  max={96}
                  step={1}
                  value={maskBrushSize}
                  disabled={!maskEnabled || maskTool !== "eraser"}
                  onChange={(e) => setMaskBrushSize(Number(e.target.value))}
                />
              </label>

              <div className={styles.maskActions}>
                <button
                  type="button"
                  className="xpButton"
                  disabled={!maskEnabled || !selectedMaskSegmentId}
                  onClick={removeSelectedMaskSegment}
                >
                  Delete Selected
                </button>
                <button
                  type="button"
                  className="xpButton"
                  disabled={!maskEnabled || maskSegments.length === 0}
                  onClick={clearMask}
                >
                  Clear Mask
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.mainWorkspace}>
        <div className={styles.filterStack}>
          <div className={styles.filterStackFixed}>
            <h3>PixelPass</h3>
          </div>

          <div className={styles.filterStackScrollable}>
            <DropZone
              idx={0}
              onDrop={handleDropBetween}
              onDragEnter={handleDropZoneEnter}
              onDragLeave={handleDropZoneLeave}
              isActive={dropZoneActive === 0}
            />

            {filters.map((f, i) =>
              f ? (
                <React.Fragment key={f.id}>
                  <FilterOptions
                    filter={f}
                    index={i}
                    defs={defs}
                    toggleFilter={toggleFilter}
                    handleOptionChange={handleOptionChange}
                    removeFilter={removeFilter}
                    toggleEnabled={toggleEnabled}
                    addCustomColor={addCustomColor}
                    removeCustomColor={removeCustomColor}
                    swapActive={swapIdx === i}
                    onSwapDrop={handleSwapDrop}
                    onSwapEnter={handleSwapEnter}
                    onSwapLeave={handleSwapLeave}
                  />

                  <DropZone
                    idx={i + 1}
                    onDrop={handleDropBetween}
                    onDragEnter={handleDropZoneEnter}
                    onDragLeave={handleDropZoneLeave}
                    isActive={dropZoneActive === i + 1}
                  />
                </React.Fragment>
              ) : null,
            )}

            <button
              type="button"
              className="xpButton"
              onClick={toggleShowAdd}
            >
              + Add Filter
            </button>

            {showAdd && (
              <div className={styles.filterSelection}>
                {availableFilterEntries.map(([type, def]) => (
                  <button
                    type="button"
                    key={type}
                    className="xpButton"
                    onClick={() => addFilter(type)}
                  >
                    {def.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.imagesContainer}>
          <div className={styles.imageBox}>
            <div ref={imageSurfaceRef} className={styles.imageSurface}>
              <div className={styles.imageViewport} style={imageViewportStyle}>
                <canvas ref={canvasRef} className={styles.image} />
                <MaskEditor
                  enabled={maskEnabled}
                  showOutlines={maskShowOutlines}
                  tool={maskTool}
                  brushSize={maskBrushSize}
                  onBrushSizeChange={setMaskBrushSize}
                  segments={maskSegments}
                  selectedSegmentId={selectedMaskSegmentId}
                  onSegmentsChange={setMaskSegments}
                  onSelectSegment={setSelectedMaskSegmentId}
                  className={styles.maskOverlay}
                  enabledClassName={styles.maskOverlayEnabled}
                />
              </div>
            </div>
            <video ref={videoRef} playsInline muted style={{ display: "none" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
