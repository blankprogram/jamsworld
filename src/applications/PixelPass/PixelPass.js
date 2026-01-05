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
  DownsamplePass,
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
} from "../../utils/GL/passes";

const ALL_PASSES = [
  InvertPass,
  GrayscalePass,
  GaussianBlurPass,
  SharpenPass,
  SobelPass,
  PosterizePass,
  AsciiPass,
  DitherPass,
  DownsamplePass,
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

const makeId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

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
        <h4 className={styles.filterTitle} onClick={() => toggleFilter(index)}>
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

      {filter.open && (
        <div className={styles.filterContent}>
          {cfg.options.map((opt) => {
            if (
              filter.type === "PIXELSORT" &&
              (opt.name === "low" || opt.name === "high") &&
              filter.opts.mode !== "Threshold"
            ) {
              return null;
            }

            if (filter.type === "PALETTE" && opt.name === "customColors") {
              if (filter.opts.preset !== "Custom") return null;

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

export default function PixelPass() {
  const fileInputRef = useRef(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);

  const [fonts, setFonts] = useState([]);
  const [filters, setFilters] = useState([]);
  const [canExport, setCanExport] = useState(false);

  const [dropZoneActive, setDropZoneActive] = useState(-1);
  const [swapIdx, setSwapIdx] = useState(-1);

  const [showAdd, setShowAdd] = useState(false);
  const [fileURL, setFileURL] = useState(null);
  const [cameraOn, setCameraOn] = useState(false);

  useEffect(() => {
    loadFonts().then(setFonts);
  }, []);

  const defs = useMemo(() => getFilterDefs(fonts), [fonts]);
  const mediaConfig = useMemo(() => ({ defs, filters }), [defs, filters]);

  const { loadFile, exportResult } = useProcessMedia(canvasRef, mediaConfig, {
    cameraOn,
    videoRef,
  });

  const clearDnDUI = useCallback(() => {
    setDropZoneActive(-1);
    setSwapIdx(-1);
  }, []);

  const handleDropBetween = useCallback(
    (dropIdx, sourceIdx) => {
      setFilters((fs) => {
        const from = sourceIdx;
        const to = dropIdx;

        if (
          from == null ||
          to == null ||
          from === to ||
          from < 0 ||
          to < 0 ||
          from >= fs.length ||
          to > fs.length
        )
          return fs;

        const arr = [...fs];
        const [dragged] = arr.splice(from, 1);
        arr.splice(to > from ? to - 1 : to, 0, dragged);
        return arr;
      });

      clearDnDUI();
    },
    [clearDnDUI],
  );

  const handleSwapDrop = useCallback(
    (targetIdx, sourceIdx) => {
      setFilters((fs) => {
        const from = sourceIdx;
        const to = targetIdx;

        if (
          from == null ||
          to == null ||
          from === to ||
          from < 0 ||
          to < 0 ||
          from >= fs.length ||
          to >= fs.length
        )
          return fs;

        const arr = [...fs];
        [arr[from], arr[to]] = [arr[to], arr[from]];
        return arr;
      });

      clearDnDUI();
    },
    [clearDnDUI],
  );

  const handleDropZoneEnter = useCallback((idx) => setDropZoneActive(idx), []);
  const handleDropZoneLeave = useCallback(() => setDropZoneActive(-1), []);

  const handleSwapEnter = useCallback((idx) => setSwapIdx(idx), []);
  const handleSwapLeave = useCallback(() => setSwapIdx(-1), []);

  const handleFile = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (fileURL) URL.revokeObjectURL(fileURL);

      const url = await loadFile(file);
      setFileURL(url);
      setCanExport(true);
      setShowAdd(false);
    },
    [loadFile, fileURL],
  );

  const handleExport = useCallback(
    () => exportResult("pixelpass"),
    [exportResult],
  );

  const addFilter = useCallback(
    (type) => {
      const def = defs[type];
      if (!def) return;

      const opts = {};
      for (const o of def.options) {
        opts[o.name === "customColors" ? "customColors" : o.name] =
          o.name === "customColors"
            ? ["#FF0000", "#00FF00", "#0000FF", "#FFFFFF", "#000000"]
            : o.defaultValue;
      }

      setFilters((fs) => [
        ...fs,
        { id: makeId(), type, opts, open: false, enabled: true },
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

  return (
    <div className={styles.mainContainer}>
      <div className={styles.filterStack}>
        <div className={styles.filterStackFixed}>
          <h3>PixelPass</h3>

          <div className={styles.formContainer}>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFile}
              className={styles.field}
            />
            <button
              type="button"
              className="xpButton"
              disabled={cameraOn}
              onClick={() => fileInputRef.current?.click()}
            >
              Choose File
            </button>
          </div>

          <button
            type="button"
            className="xpButton"
            disabled={!canExport || cameraOn}
            onClick={handleExport}
          >
            Export
          </button>

          <button
            type="button"
            className="xpButton"
            onClick={() => setCameraOn((v) => !v)}
          >
            {cameraOn ? "Stop Camera" : "Use Camera"}
          </button>
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
            onClick={() => setShowAdd((v) => !v)}
          >
            + Add Filter
          </button>

          {showAdd && (
            <div className={styles.filterSelection}>
              {Object.keys(defs).map((type) => (
                <button
                  type="button"
                  key={type}
                  className="xpButton"
                  onClick={() => addFilter(type)}
                >
                  {defs[type].title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.imagesContainer}>
        <div className={styles.imageBox}>
          <canvas ref={canvasRef} className={styles.image} />
          <video ref={videoRef} playsInline muted style={{ display: "none" }} />
        </div>
      </div>
    </div>
  );
}
