import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  useReducer,
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
  MinecraftPass,
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
  MinecraftPass,
];

const DEFAULT_CUSTOM_COLORS = [
  "#FF0000",
  "#00FF00",
  "#0000FF",
  "#FFFFFF",
  "#000000",
];
const INACTIVE_INDEX = -1;
const HEADER_INTERACTIVE_SELECTOR = "button, input, select, textarea, label, a";
const MASK_HISTORY_LIMIT = 100;
const MASK_TOOL_OPTIONS = [
  { id: "select", label: "Select" },
  { id: "rect", label: "Rect" },
  { id: "ellipse", label: "Ellipse" },
  { id: "draw", label: "Draw" },
  { id: "eraser", label: "Eraser" },
];
const MASK_GROUP_STROKE_PALETTE = [
  "#2f6db5",
  "#2f8f67",
  "#b06d1f",
  "#8b4ca8",
  "#9d3d3d",
  "#3b7f9a",
  "#6f8f2b",
  "#94547a",
];
const PIPELINE_MODE_GLOBAL = "global";
const PIPELINE_MODE_PER_MASK = "perMask";

const makeId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

function createMaskGroup(index = 1) {
  return {
    id: makeId(),
    displayIndex: index,
    enabled: true,
    invert: false,
    filters: [],
  };
}

function getMaskGroupDisplayIndex(group, fallback = 1) {
  const value = Number(group?.displayIndex);
  if (Number.isFinite(value) && value > 0) return Math.floor(value);
  return fallback;
}

function getMaskGroupLabel(group, fallback = 1) {
  return `G${getMaskGroupDisplayIndex(group, fallback)}`;
}

function toProcessingFilters(filters) {
  if (!Array.isArray(filters)) return [];
  return filters.map(({ id, type, opts, enabled }) => ({
    id,
    type,
    opts,
    enabled,
  }));
}

function normalizeSegmentGroupId(segment, defaultGroupId) {
  if (segment?.groupId) return segment.groupId;
  return defaultGroupId || null;
}

function hashString(input = "") {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getMaskGroupRemovalPlan(
  maskGroups,
  selectedGroupId,
  maskSegments,
  defaultGroupId,
) {
  if (
    !selectedGroupId ||
    !Array.isArray(maskGroups) ||
    maskGroups.length <= 1
  ) {
    return null;
  }

  const removeIndex = maskGroups.findIndex(
    (group) => group.id === selectedGroupId,
  );
  if (removeIndex < 0) return null;

  const selectedGroup = maskGroups[removeIndex];
  const deletedCount = (maskSegments || []).reduce((count, segment) => {
    const groupId = normalizeSegmentGroupId(segment, defaultGroupId);
    return groupId === selectedGroupId ? count + 1 : count;
  }, 0);

  return {
    selectedGroupLabel: selectedGroup
      ? getMaskGroupLabel(selectedGroup, removeIndex + 1)
      : "Selected Group",
    deletedCount,
  };
}

const createOffscreenMaskCanvas = () => {
  if (typeof document === "undefined") return null;
  return document.createElement("canvas");
};

function isEditableEventTarget(target) {
  return (
    target instanceof Element &&
    !!target.closest("input, textarea, select, [contenteditable='true']")
  );
}

function areSegmentListsEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function pushHistory(past, snapshot) {
  const next = [...past, snapshot];
  if (next.length > MASK_HISTORY_LIMIT) {
    return next.slice(next.length - MASK_HISTORY_LIMIT);
  }
  return next;
}

function maskHistoryReducer(state, action) {
  switch (action.type) {
    case "start-interaction": {
      if (state.interactionBase) return state;
      return {
        ...state,
        interactionBase: state.segments,
      };
    }

    case "end-interaction": {
      if (!state.interactionBase) return state;
      const base = state.interactionBase;
      if (areSegmentListsEqual(base, state.segments)) {
        return {
          ...state,
          interactionBase: null,
        };
      }
      return {
        segments: state.segments,
        past: pushHistory(state.past, base),
        future: [],
        interactionBase: null,
      };
    }

    case "set": {
      const nextSegments =
        typeof action.next === "function"
          ? action.next(state.segments)
          : action.next;
      if (!Array.isArray(nextSegments)) return state;
      if (areSegmentListsEqual(nextSegments, state.segments)) return state;
      if (state.interactionBase) {
        return {
          ...state,
          segments: nextSegments,
        };
      }
      return {
        segments: nextSegments,
        past: pushHistory(state.past, state.segments),
        future: [],
        interactionBase: null,
      };
    }

    case "undo": {
      if (!state.past.length) return state;
      const previous = state.past[state.past.length - 1];
      const nextFuture = [state.segments, ...state.future];
      return {
        segments: previous,
        past: state.past.slice(0, -1),
        future: nextFuture.slice(0, MASK_HISTORY_LIMIT),
        interactionBase: null,
      };
    }

    case "redo": {
      if (!state.future.length) return state;
      const [nextSegments, ...remainingFuture] = state.future;
      return {
        segments: nextSegments,
        past: pushHistory(state.past, state.segments),
        future: remainingFuture,
        interactionBase: null,
      };
    }

    default:
      return state;
  }
}

function shouldHideOption(filter, optionName) {
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

function rasterizeMask(canvas, segments, includeSegment = () => true) {
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
    if (!includeSegment(segment)) continue;

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
  const handleHeaderClick = useCallback(
    (e) => {
      if (!canToggleOpen) return;
      const target = e.target;
      if (
        target instanceof Element &&
        target.closest(HEADER_INTERACTIVE_SELECTOR)
      ) {
        return;
      }
      toggleFilter(index);
    },
    [canToggleOpen, index, toggleFilter],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const cleanup = draggable({
      element: el,
      dragHandle: el,
      canDrag: ({ input }) => {
        if (typeof document === "undefined") return true;
        const target = document.elementFromPoint(input.clientX, input.clientY);
        if (!(target instanceof Element)) return true;
        return !target.closest(HEADER_INTERACTIVE_SELECTOR);
      },
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
      <div
        className={styles.filterHeader}
        onClick={handleHeaderClick}
      >
        <h4
          className={`${styles.filterTitle} ${!canToggleOpen ? styles.filterTitleDisabled : ""}`}
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

const MaskEyeIcon = React.memo(function MaskEyeIcon() {
  return (
    <svg
      className={styles.maskIconSvg}
      viewBox="0 0 16 10"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M1 5s2.5-3.5 7-3.5S15 5 15 5s-2.5 3.5-7 3.5S1 5 1 5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <circle cx="8" cy="5" r="1.8" fill="currentColor" />
    </svg>
  );
});

function useFilterStackState(defs, filters, setFilters) {
  const [showAdd, setShowAdd] = useState(false);
  const [dropZoneActive, setDropZoneActive] = useState(INACTIVE_INDEX);
  const [swapIdx, setSwapIdx] = useState(INACTIVE_INDEX);

  const processingFilters = useMemo(
    () => toProcessingFilters(filters),
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
    [clearDnDUI, setFilters],
  );

  const handleSwapDrop = useCallback(
    (targetIdx, sourceIdx) => {
      setFilters((fs) => swapFilters(fs, sourceIdx, targetIdx));
      clearDnDUI();
    },
    [clearDnDUI, setFilters],
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
    [defs, setFilters],
  );

  const handleOptionChange = useCallback(
    (i, name, val) => {
      setFilters((fs) =>
        fs.map((f, j) =>
          j === i ? { ...f, opts: { ...f.opts, [name]: val } } : f,
        ),
      );
    },
    [setFilters],
  );

  const addCustomColor = useCallback(
    (i) => {
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
    },
    [setFilters],
  );

  const removeCustomColor = useCallback(
    (i, ci) => {
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
    },
    [setFilters],
  );

  const removeFilter = useCallback(
    (i) => {
      setFilters((fs) => fs.filter((_, j) => j !== i));
    },
    [setFilters],
  );

  const toggleFilter = useCallback(
    (i) => {
      setFilters((fs) =>
        fs.map((f, j) => (j === i ? { ...f, open: !f.open } : f)),
      );
    },
    [setFilters],
  );

  const toggleEnabled = useCallback(
    (i) => {
      setFilters((fs) =>
        fs.map((f, j) => (j === i ? { ...f, enabled: !f.enabled } : f)),
      );
    },
    [setFilters],
  );

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
  const [pipelineMode, setPipelineMode] = useState(PIPELINE_MODE_GLOBAL);
  const [maskGroups, setMaskGroups] = useState(() => [createMaskGroup(1)]);
  const [nextMaskGroupDisplayIndex, setNextMaskGroupDisplayIndex] = useState(2);
  const [selectedMaskGroupId, setSelectedMaskGroupId] = useState(null);
  const [maskShowOutlines, setMaskShowOutlines] = useState(true);
  const [maskTool, setMaskTool] = useState("draw");
  const [maskBrushSize, setMaskBrushSize] = useState(24);
  const [maskHistory, dispatchMaskHistory] = useReducer(maskHistoryReducer, {
    segments: [],
    past: [],
    future: [],
    interactionBase: null,
  });
  const maskSegments = maskHistory.segments;
  const setMaskSegments = useCallback(
    (next) => dispatchMaskHistory({ type: "set", next }),
    [],
  );
  const [selectedMaskSegmentId, setSelectedMaskSegmentId] = useState(null);
  const [maskVersion, setMaskVersion] = useState(0);
  const canUndoMask = maskHistory.past.length > 0;
  const canRedoMask = maskHistory.future.length > 0;
  const undoMask = useCallback(() => dispatchMaskHistory({ type: "undo" }), []);
  const redoMask = useCallback(() => dispatchMaskHistory({ type: "redo" }), []);
  const startMaskInteraction = useCallback(
    () => dispatchMaskHistory({ type: "start-interaction" }),
    [],
  );
  const endMaskInteraction = useCallback(
    () => dispatchMaskHistory({ type: "end-interaction" }),
    [],
  );

  useEffect(() => {
    if (!maskEnabled) setSelectedMaskSegmentId(null);
  }, [maskEnabled]);

  useEffect(() => {
    if (
      selectedMaskGroupId &&
      maskGroups.some((group) => group.id === selectedMaskGroupId)
    ) {
      return;
    }
    setSelectedMaskGroupId(maskGroups[0]?.id || null);
  }, [maskGroups, selectedMaskGroupId]);

  useEffect(() => {
    let maxDisplayIndex = 0;
    let shouldPatchGroups = false;
    const patchedGroups = maskGroups.map((group, idx) => {
      const nextDisplayIndex = getMaskGroupDisplayIndex(group, idx + 1);
      if (group?.displayIndex !== nextDisplayIndex) shouldPatchGroups = true;
      maxDisplayIndex = Math.max(maxDisplayIndex, nextDisplayIndex);
      return shouldPatchGroups
        ? { ...group, displayIndex: nextDisplayIndex }
        : group;
    });

    if (shouldPatchGroups) {
      setMaskGroups(patchedGroups);
      return;
    }

    setNextMaskGroupDisplayIndex((prev) => Math.max(prev, maxDisplayIndex + 1));
  }, [maskGroups, setMaskGroups]);

  useEffect(() => {
    if (!selectedMaskSegmentId) return;
    const exists = maskSegments.some(
      (segment) => segment.id === selectedMaskSegmentId,
    );
    if (!exists) setSelectedMaskSegmentId(null);
  }, [maskSegments, selectedMaskSegmentId]);

  const removeSelectedMaskSegment = useCallback(() => {
    if (!selectedMaskSegmentId) return;
    setMaskSegments((prev) =>
      prev.filter((segment) => segment.id !== selectedMaskSegmentId),
    );
    setSelectedMaskSegmentId(null);
  }, [selectedMaskSegmentId, setMaskSegments]);

  const clearMask = useCallback(() => {
    setMaskSegments(() => []);
    setSelectedMaskSegmentId(null);
  }, [setMaskSegments]);

  const addMaskGroup = useCallback(() => {
    const nextGroup = createMaskGroup(nextMaskGroupDisplayIndex);
    setMaskGroups((prev) => [...prev, nextGroup]);
    setSelectedMaskGroupId(nextGroup.id);
    setNextMaskGroupDisplayIndex((prev) => prev + 1);
  }, [nextMaskGroupDisplayIndex]);

  const removeSelectedMaskGroup = useCallback(
    (groupIdArg) => {
      const groupId = groupIdArg || selectedMaskGroupId;
      if (!groupId || maskGroups.length <= 1) return;

      const removeIndex = maskGroups.findIndex((group) => group.id === groupId);
      if (removeIndex < 0) return;

      const nextSelectedGroup =
        maskGroups[removeIndex === 0 ? 1 : removeIndex - 1] ||
        maskGroups[removeIndex + 1] ||
        null;
      const currentDefaultGroupId = maskGroups[0]?.id || null;

      setMaskGroups((prev) => prev.filter((group) => group.id !== groupId));
      setSelectedMaskGroupId(nextSelectedGroup?.id || null);
      setMaskSegments((prev) =>
        prev.filter(
          (segment) =>
            normalizeSegmentGroupId(segment, currentDefaultGroupId) !== groupId,
        ),
      );
    },
    [selectedMaskGroupId, maskGroups, setMaskSegments],
  );

  const toggleMaskGroupEnabled = useCallback((groupId) => {
    if (!groupId) return;
    setMaskGroups((prev) =>
      prev.map((group) =>
        group.id === groupId ? { ...group, enabled: !group.enabled } : group,
      ),
    );
  }, []);

  const toggleMaskGroupInvert = useCallback((groupId) => {
    if (!groupId) return;
    setMaskGroups((prev) =>
      prev.map((group) =>
        group.id === groupId ? { ...group, invert: !group.invert } : group,
      ),
    );
  }, []);

  const assignSelectedSegmentToActiveGroup = useCallback(() => {
    if (!selectedMaskSegmentId || !selectedMaskGroupId) return;
    setMaskSegments((prev) =>
      prev.map((segment) =>
        segment.id === selectedMaskSegmentId
          ? { ...segment, groupId: selectedMaskGroupId }
          : segment,
      ),
    );
  }, [selectedMaskSegmentId, selectedMaskGroupId, setMaskSegments]);

  return {
    showMaskSettings,
    setShowMaskSettings,
    maskEnabled,
    setMaskEnabled,
    maskInvert,
    setMaskInvert,
    pipelineMode,
    setPipelineMode,
    maskGroups,
    setMaskGroups,
    selectedMaskGroupId,
    setSelectedMaskGroupId,
    addMaskGroup,
    removeSelectedMaskGroup,
    toggleMaskGroupEnabled,
    toggleMaskGroupInvert,
    assignSelectedSegmentToActiveGroup,
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
    canUndoMask,
    canRedoMask,
    undoMask,
    redoMask,
    startMaskInteraction,
    endMaskInteraction,
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

function useMaskMenuDismiss(
  showMaskSettings,
  setShowMaskSettings,
  maskMenuRef,
) {
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
  maskGroupCanvasesRef,
  maskEnabled,
  maskSegments,
  maskGroupIds,
  pipelineMode,
  contentSize,
  setMaskVersion,
) {
  useEffect(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const groupCanvases = maskGroupCanvasesRef.current;
    if (!(groupCanvases instanceof Map)) return;

    const targetWidth = Math.max(1, contentSize.width || 1);
    const targetHeight = Math.max(1, contentSize.height || 1);

    if (maskCanvas.width !== targetWidth) maskCanvas.width = targetWidth;
    if (maskCanvas.height !== targetHeight) maskCanvas.height = targetHeight;

    const clearMaskCanvas = (canvas) => {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    if (maskEnabled && maskSegments.length) {
      rasterizeMask(maskCanvas, maskSegments);
    } else {
      clearMaskCanvas(maskCanvas);
    }

    if (pipelineMode === PIPELINE_MODE_PER_MASK) {
      const ids = maskGroupIds;
      const aliveIds = new Set(ids);

      for (const [groupId] of groupCanvases.entries()) {
        if (!aliveIds.has(groupId)) {
          groupCanvases.delete(groupId);
        }
      }

      if (!maskEnabled || !maskSegments.length) {
        groupCanvases.clear();
      } else {
        const defaultGroupId = ids[0] || null;
        for (let i = 0; i < ids.length; i += 1) {
          const groupId = ids[i];
          let groupCanvas = groupCanvases.get(groupId);
          if (!groupCanvas) {
            groupCanvas = createOffscreenMaskCanvas();
            if (!groupCanvas) continue;
            groupCanvases.set(groupId, groupCanvas);
          }

          if (groupCanvas.width !== targetWidth)
            groupCanvas.width = targetWidth;
          if (groupCanvas.height !== targetHeight)
            groupCanvas.height = targetHeight;

          rasterizeMask(
            groupCanvas,
            maskSegments,
            (segment) =>
              normalizeSegmentGroupId(segment, defaultGroupId) === groupId,
          );
        }
      }
    } else {
      groupCanvases.clear();
    }

    setMaskVersion((v) => v + 1);
  }, [
    maskCanvasRef,
    maskGroupCanvasesRef,
    maskEnabled,
    maskSegments,
    maskGroupIds,
    pipelineMode,
    contentSize.width,
    contentSize.height,
    setMaskVersion,
  ]);
}

export default function PixelPass({ windowRuntime }) {
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const imageSurfaceRef = useRef(null);
  const maskMenuRef = useRef(null);
  const maskCanvasRef = useRef(createOffscreenMaskCanvas());
  const maskGroupCanvasesRef = useRef(new Map());

  const [fonts, setFonts] = useState([]);
  const [canExport, setCanExport] = useState(false);
  const [fileURL, setFileURL] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [globalFilters, setGlobalFilters] = useState([]);

  useEffect(() => {
    loadFonts().then(setFonts);
  }, []);

  const defs = useMemo(() => getFilterDefs(fonts), [fonts]);
  const {
    showMaskSettings,
    setShowMaskSettings,
    maskEnabled,
    setMaskEnabled,
    maskInvert,
    setMaskInvert,
    pipelineMode,
    setPipelineMode,
    maskGroups,
    setMaskGroups,
    selectedMaskGroupId,
    setSelectedMaskGroupId,
    addMaskGroup,
    removeSelectedMaskGroup,
    toggleMaskGroupEnabled,
    toggleMaskGroupInvert,
    assignSelectedSegmentToActiveGroup,
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
    canUndoMask,
    canRedoMask,
    undoMask,
    redoMask,
    startMaskInteraction,
    endMaskInteraction,
    removeSelectedMaskSegment,
    clearMask,
  } = useMaskState();

  const perMaskEnabled = pipelineMode === PIPELINE_MODE_PER_MASK;
  const defaultMaskGroupId = maskGroups[0]?.id || null;
  const activeMaskGroup =
    maskGroups.find((group) => group.id === selectedMaskGroupId) ||
    maskGroups[0] ||
    null;
  const maskContextBadgeLabel = useMemo(() => {
    if (!perMaskEnabled) return "GLOBAL";
    if (!activeMaskGroup) return "G?";
    return getMaskGroupLabel(activeMaskGroup, 1);
  }, [perMaskEnabled, activeMaskGroup]);
  const cycleMaskContext = useCallback(
    (direction) => {
      if (!direction) return;
      const contexts = [
        { mode: PIPELINE_MODE_GLOBAL, groupId: null },
        ...maskGroups.map((group) => ({
          mode: PIPELINE_MODE_PER_MASK,
          groupId: group.id,
        })),
      ];

      const currentPerMaskGroupId =
        activeMaskGroup?.id || selectedMaskGroupId || null;
      const currentIndex =
        pipelineMode === PIPELINE_MODE_GLOBAL
          ? 0
          : Math.max(
              1,
              contexts.findIndex(
                (context) =>
                  context.mode === PIPELINE_MODE_PER_MASK &&
                  context.groupId === currentPerMaskGroupId,
              ),
            );
      const nextIndex =
        (currentIndex + direction + contexts.length) % contexts.length;
      const nextContext = contexts[nextIndex];
      if (!nextContext) return;

      if (nextContext.mode === PIPELINE_MODE_GLOBAL) {
        setPipelineMode(PIPELINE_MODE_GLOBAL);
        return;
      }

      setPipelineMode(PIPELINE_MODE_PER_MASK);
      setSelectedMaskGroupId(nextContext.groupId);
    },
    [
      maskGroups,
      pipelineMode,
      activeMaskGroup?.id,
      selectedMaskGroupId,
      setPipelineMode,
      setSelectedMaskGroupId,
    ],
  );
  const handleMaskContextBookmarkWheel = useCallback(
    (event) => {
      if (!event.deltaY) return;
      event.preventDefault();
      event.stopPropagation();
      cycleMaskContext(event.deltaY > 0 ? 1 : -1);
    },
    [cycleMaskContext],
  );
  const selectedSegmentGroupId = useMemo(() => {
    if (!selectedMaskSegmentId) return null;
    const segment = maskSegments.find(
      (item) => item.id === selectedMaskSegmentId,
    );
    return normalizeSegmentGroupId(segment, defaultMaskGroupId);
  }, [selectedMaskSegmentId, maskSegments, defaultMaskGroupId]);
  const canMoveSelectedToActiveGroup =
    !!selectedMaskSegmentId &&
    !!activeMaskGroup &&
    !!selectedSegmentGroupId &&
    selectedSegmentGroupId !== activeMaskGroup.id;
  const allMaskGroupsInverted = useMemo(
    () => maskGroups.length > 0 && maskGroups.every((group) => group.invert),
    [maskGroups],
  );
  const invertAllMaskGroups = useCallback(() => {
    setMaskGroups((prev) => {
      if (prev.length === 0) return prev;
      const shouldInvert = !prev.every((group) => group.invert);
      return prev.map((group) => ({ ...group, invert: shouldInvert }));
    });
  }, [setMaskGroups]);
  const autoSyncSelectionRef = useRef({
    segmentId: null,
    groupId: null,
  });
  useEffect(() => {
    const prev = autoSyncSelectionRef.current;
    const selectionChanged = prev.segmentId !== selectedMaskSegmentId;
    const selectedSegmentGroupChanged =
      prev.segmentId === selectedMaskSegmentId &&
      prev.groupId !== selectedSegmentGroupId;
    autoSyncSelectionRef.current = {
      segmentId: selectedMaskSegmentId,
      groupId: selectedSegmentGroupId,
    };

    if (!perMaskEnabled) return;
    if (!selectionChanged && !selectedSegmentGroupChanged) return;
    if (!selectedMaskSegmentId || !selectedSegmentGroupId) return;
    if (selectedMaskGroupId === selectedSegmentGroupId) return;

    const groupExists = maskGroups.some(
      (group) => group.id === selectedSegmentGroupId,
    );
    if (!groupExists) return;

    setSelectedMaskGroupId(selectedSegmentGroupId);
  }, [
    perMaskEnabled,
    selectedMaskSegmentId,
    selectedSegmentGroupId,
    selectedMaskGroupId,
    maskGroups,
    setSelectedMaskGroupId,
  ]);
  const activeFilters = perMaskEnabled
    ? activeMaskGroup?.filters || []
    : globalFilters;
  const setActiveFilters = useCallback(
    (next) => {
      if (!perMaskEnabled) {
        setGlobalFilters((prev) =>
          typeof next === "function" ? next(prev) : next,
        );
        return;
      }

      const activeGroupId = activeMaskGroup?.id;
      if (!activeGroupId) return;

      setMaskGroups((prev) =>
        prev.map((group) => {
          if (group.id !== activeGroupId) return group;
          const current = group.filters || [];
          const updated = typeof next === "function" ? next(current) : next;
          return { ...group, filters: updated };
        }),
      );
    },
    [perMaskEnabled, activeMaskGroup?.id, setMaskGroups],
  );

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
  } = useFilterStackState(defs, activeFilters, setActiveFilters);
  const maskGroupStrokeById = useMemo(
    () =>
      Object.fromEntries(
        maskGroups.map((group) => {
          const colorIdx =
            hashString(group.id) % MASK_GROUP_STROKE_PALETTE.length;
          return [group.id, MASK_GROUP_STROKE_PALETTE[colorIdx]];
        }),
      ),
    [maskGroups],
  );
  const segmentCountByGroup = useMemo(() => {
    const counts = Object.create(null);
    const fallbackGroupId = defaultMaskGroupId;
    for (let i = 0; i < maskSegments.length; i += 1) {
      const groupId = normalizeSegmentGroupId(maskSegments[i], fallbackGroupId);
      if (!groupId) continue;
      counts[groupId] = (counts[groupId] || 0) + 1;
    }
    return counts;
  }, [maskSegments, defaultMaskGroupId]);
  const maskGroupMeta = useMemo(
    () =>
      maskGroups.map((group, idx) => ({
        id: group.id,
        label: getMaskGroupLabel(group, idx + 1),
        enabled: group.enabled,
        invert: group.invert,
        count: Number(segmentCountByGroup[group.id] || 0),
      })),
    [maskGroups, segmentCountByGroup],
  );
  const removeGroupPlan = useMemo(
    () =>
      getMaskGroupRemovalPlan(
        maskGroups,
        selectedMaskGroupId,
        maskSegments,
        defaultMaskGroupId,
      ),
    [maskGroups, selectedMaskGroupId, maskSegments, defaultMaskGroupId],
  );
  const defaultMaskGroupStroke =
    (defaultMaskGroupId && maskGroupStrokeById[defaultMaskGroupId]) ||
    "#1f4b9a";
  const maskGroupIds = useMemo(
    () => maskGroups.map((group) => group.id).filter(Boolean),
    [maskGroups],
  );
  const { surfaceSize, contentSize } = useViewportSizing(
    imageSurfaceRef,
    canvasRef,
  );
  useMaskRasterization(
    maskCanvasRef,
    maskGroupCanvasesRef,
    maskEnabled,
    maskSegments,
    maskGroupIds,
    pipelineMode,
    contentSize,
    setMaskVersion,
  );

  const globalProcessingFilters = useMemo(
    () => toProcessingFilters(globalFilters),
    [globalFilters],
  );
  const perMaskGroupsConfig = useMemo(
    () =>
      maskGroups.map((group) => ({
        id: group.id,
        enabled: !!group.enabled,
        invert: !!group.invert,
        filters: toProcessingFilters(group.filters || []),
        canvas: maskGroupCanvasesRef.current.get(group.id) || null,
        version: maskVersion,
      })),
    [maskGroups, maskVersion],
  );
  const maskConfig = useMemo(
    () => ({
      enabled: maskEnabled,
      invert: maskInvert,
      canvas: maskCanvasRef.current,
      version: maskVersion,
      pipelineMode,
      groups: perMaskGroupsConfig,
      groupCanvases: maskGroupCanvasesRef.current,
    }),
    [
      maskEnabled,
      maskInvert,
      maskVersion,
      pipelineMode,
      perMaskGroupsConfig,
      maskGroupCanvasesRef,
    ],
  );
  const mediaConfig = useMemo(() => {
    return {
      defs,
      filters: perMaskEnabled ? globalProcessingFilters : processingFilters,
      mask: maskConfig,
    };
  }, [
    defs,
    perMaskEnabled,
    globalProcessingFilters,
    processingFilters,
    maskConfig,
  ]);

  const { loadFile, exportResult } = useProcessMedia(canvasRef, mediaConfig, {
    cameraOn,
    videoRef,
  });
  const requestRemoveGroup = useCallback(async () => {
    if (!maskEnabled || !removeGroupPlan || !selectedMaskGroupId) return;
    const groupId = selectedMaskGroupId;
    const { selectedGroupLabel = "Selected Group", deletedCount = 0 } =
      removeGroupPlan;
    const deleteLabel = `${deletedCount} segment${deletedCount === 1 ? "" : "s"} in this group will be deleted.`;

    let confirmed = false;
    if (windowRuntime?.openDialog) {
      const result = await windowRuntime.openDialog("system-confirm-dialog", {
        titleOverride: "Confirm Group Removal",
        parentWindowId: windowRuntime.windowId,
        windowDefaultsOverride: {
          width: 390,
          height: 198,
          minWidth: 350,
          minHeight: 190,
          resizable: false,
        },
        windowProps: {
          title: "Confirm Group Removal",
          message: [`Remove "${selectedGroupLabel}"?`, deleteLabel],
          confirmLabel: "Delete Group",
          cancelLabel: "Cancel",
        },
      });
      confirmed = result === true;
    } else if (typeof window !== "undefined" && window.confirm) {
      confirmed = window.confirm(
        `Remove "${selectedGroupLabel}"?\n${deleteLabel}`,
      );
    }

    if (confirmed) {
      removeSelectedMaskGroup(groupId);
    }
  }, [
    maskEnabled,
    removeGroupPlan,
    selectedMaskGroupId,
    windowRuntime,
    removeSelectedMaskGroup,
  ]);

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

  useEffect(() => {
    const handleMaskHistoryKeydown = (event) => {
      if (!maskEnabled) return;
      if (!(event.ctrlKey || event.metaKey)) return;
      if (isEditableEventTarget(event.target)) return;

      const key = event.key.toLowerCase();
      const isUndo = key === "z" && !event.shiftKey;
      const isRedo = key === "y" || (key === "z" && event.shiftKey);
      if (!isUndo && !isRedo) return;

      event.preventDefault();
      if (isUndo) undoMask();
      else redoMask();
    };

    window.addEventListener("keydown", handleMaskHistoryKeydown);
    return () =>
      window.removeEventListener("keydown", handleMaskHistoryKeydown);
  }, [maskEnabled, undoMask, redoMask]);

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
          <span
            className={styles.maskContextBookmark}
            onWheel={handleMaskContextBookmarkWheel}
          >
            {maskContextBadgeLabel}
          </span>

          {showMaskSettings && (
            <div className={styles.maskMenuDropdown}>
              <div className={styles.maskStatusLine}>
                Editing: {maskContextBadgeLabel}
              </div>

              <div className={styles.maskSection}>
                <div className={styles.maskSectionLabel}>Context</div>
                <div className={styles.maskButtonsRow}>
                  <button
                    type="button"
                    className={`xpButton ${!perMaskEnabled ? styles.maskButtonActive : ""}`}
                    onClick={() => setPipelineMode(PIPELINE_MODE_GLOBAL)}
                  >
                    Global
                  </button>
                  <button
                    type="button"
                    className={`xpButton ${perMaskEnabled ? styles.maskButtonActive : ""}`}
                    onClick={() => setPipelineMode(PIPELINE_MODE_PER_MASK)}
                  >
                    Per Group
                  </button>
                </div>
              </div>

              <div className={styles.maskSection}>
                <div className={styles.maskSectionLabel}>State</div>
                <div className={styles.maskButtonsRow}>
                  <button
                    type="button"
                    className={`xpButton ${maskEnabled ? styles.maskButtonActive : ""}`}
                    onClick={() => setMaskEnabled((v) => !v)}
                  >
                    Mask {maskEnabled ? "On" : "Off"}
                  </button>

                  <button
                    type="button"
                    className={`xpButton ${maskShowOutlines ? styles.maskButtonActive : ""}`}
                    disabled={!maskEnabled}
                    onClick={() => setMaskShowOutlines((v) => !v)}
                  >
                    Outlines {maskShowOutlines ? "On" : "Off"}
                  </button>

                  {!perMaskEnabled && (
                    <button
                      type="button"
                      className={`xpButton ${maskInvert ? styles.maskButtonActive : ""}`}
                      disabled={!maskEnabled}
                      onClick={() => setMaskInvert((v) => !v)}
                    >
                      Invert {maskInvert ? "On" : "Off"}
                    </button>
                  )}

                  {perMaskEnabled && (
                    <button
                      type="button"
                      className={`xpButton ${allMaskGroupsInverted ? styles.maskButtonActive : ""}`}
                      disabled={!maskEnabled || maskGroups.length === 0}
                      onClick={invertAllMaskGroups}
                    >
                      Invert All Groups
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.maskSection}>
                <div className={styles.maskSectionLabel}>Draw</div>
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

                {maskTool === "eraser" && (
                  <label className={styles.maskBrushSize}>
                    Eraser Size
                    <input
                      type="range"
                      min={4}
                      max={96}
                      step={1}
                      value={maskBrushSize}
                      disabled={!maskEnabled}
                      onChange={(e) => setMaskBrushSize(Number(e.target.value))}
                    />
                  </label>
                )}
              </div>

              {perMaskEnabled && (
                <div className={styles.maskSection}>
                  <div className={styles.maskSectionLabel}>Group</div>
                  <div className={styles.maskGroupCompactRow}>
                    <select
                      className={styles.maskGroupCompactSelect}
                      value={activeMaskGroup?.id || ""}
                      disabled={!maskEnabled}
                      onChange={(e) => setSelectedMaskGroupId(e.target.value)}
                    >
                      {maskGroupMeta.map((group) => (
                        <option key={group.id} value={group.id}>
                          {`${group.label} (${group.count})`}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      className={`xpButton ${styles.maskIconButton}`}
                      disabled={!maskEnabled}
                      onClick={addMaskGroup}
                      title="Add Group"
                      aria-label="Add Group"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className={`xpButton ${styles.maskIconButton}`}
                      disabled={!maskEnabled || maskGroupMeta.length <= 1}
                      onClick={requestRemoveGroup}
                      title="Remove Group"
                      aria-label="Remove Group"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className={`xpButton ${styles.maskIconButton} ${activeMaskGroup?.enabled ? styles.maskButtonActive : ""}`}
                      disabled={!maskEnabled || !activeMaskGroup}
                      onClick={() =>
                        toggleMaskGroupEnabled(activeMaskGroup?.id)
                      }
                      title={
                        activeMaskGroup?.enabled
                          ? "Group Visible"
                          : "Group Hidden"
                      }
                      aria-label={
                        activeMaskGroup?.enabled ? "Hide Group" : "Show Group"
                      }
                    >
                      <MaskEyeIcon />
                    </button>
                    <button
                      type="button"
                      className={`xpButton ${styles.maskIconButton} ${activeMaskGroup?.invert ? styles.maskButtonActive : ""}`}
                      disabled={!maskEnabled || !activeMaskGroup}
                      onClick={() => toggleMaskGroupInvert(activeMaskGroup?.id)}
                      title="Group Invert"
                      aria-label="Group Invert"
                    >
                      Inv
                    </button>
                  </div>

                  {canMoveSelectedToActiveGroup && (
                    <button
                      type="button"
                      className={`xpButton ${styles.maskInlineAction}`}
                      disabled={!maskEnabled}
                      onClick={assignSelectedSegmentToActiveGroup}
                    >
                      Move Selected Here
                    </button>
                  )}
                </div>
              )}

              <div className={styles.maskSection}>
                <div className={styles.maskSectionLabel}>History / Reset</div>
                <div className={styles.maskButtonsRow}>
                  <button
                    type="button"
                    className="xpButton"
                    disabled={!maskEnabled || !canUndoMask}
                    onClick={undoMask}
                  >
                    Undo
                  </button>
                  <button
                    type="button"
                    className="xpButton"
                    disabled={!maskEnabled || !canRedoMask}
                    onClick={redoMask}
                  >
                    Redo
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

              {selectedMaskSegmentId && (
                <div className={styles.maskSection}>
                  <div className={styles.maskSectionLabel}>More</div>
                  <div className={styles.maskButtonsRow}>
                    <button
                      type="button"
                      className="xpButton"
                      disabled={!maskEnabled}
                      onClick={removeSelectedMaskSegment}
                    >
                      Delete Selected
                    </button>
                  </div>
                </div>
              )}
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
              disabled={perMaskEnabled && !activeMaskGroup}
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
                  activeGroupId={perMaskEnabled ? activeMaskGroup?.id : null}
                  defaultGroupId={defaultMaskGroupId}
                  groupStrokeById={maskGroupStrokeById}
                  defaultGroupStroke={defaultMaskGroupStroke}
                  onSegmentsChange={setMaskSegments}
                  onInteractionStart={startMaskInteraction}
                  onInteractionEnd={endMaskInteraction}
                  onSelectSegment={setSelectedMaskSegmentId}
                  className={styles.maskOverlay}
                  enabledClassName={styles.maskOverlayEnabled}
                />
              </div>
            </div>
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ display: "none" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
