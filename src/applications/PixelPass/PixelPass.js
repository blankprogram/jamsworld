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
  DownsamplePass,
  DitherPass,
  PalettePass,
  EmbossPass,
  ChromaticAberrationPass,
  PixelSortPass,
  BloomPass,
  FilmGrainPass,
  XDoGPass,
} from "../../utils/GLPipeline";

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
];

function getFilterDefs(fonts) {
  const defs = {};
  ALL_PASSES.forEach((PassClass) => {
    const def = { ...PassClass.def };
    if (def.type === "ASCII") {
      def.options = def.options.map((opt) =>
        opt.name === "font"
          ? { ...opt, type: "select", options: fonts, defaultValue: fonts[0] }
          : opt,
      );
    }
    defs[def.type] = { Pass: PassClass, ...def };
  });
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
  const ref = useRef();

  useEffect(() => {
    if (!ref.current) return;
    let cleanup;
    cleanup = dropTargetForElements({
      element: ref.current,
      getData: () => ({ dropZoneIdx: idx }),
      canDrop: () => true,
      onDrop: ({ source }) => onDrop(idx),
      onDragEnter: () => onDragEnter && onDragEnter(idx),
      onDragLeave: () => onDragLeave && onDragLeave(idx),
    });
    return () => cleanup && cleanup();
  }, [onDrop, onDragEnter, onDragLeave, idx]);

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
  fonts,
  toggleFilter,
  handleOptionChange,
  removeFilter,
  setDraggedIndex,
  toggleEnabled,
  addCustomColor,
  removeCustomColor,
  swapActive,
  onSwapDrop,
  onSwapEnter,
  onSwapLeave,
}) {
  const ref = useRef();
  const defs = useMemo(() => getFilterDefs(fonts), [fonts]);
  const cfg = filter ? defs[filter.type] : null;

  useEffect(() => {
    if (!ref.current) return;
    if (!ref.current.dataset.dragInit) {
      draggable({
        element: ref.current,
        dragHandle: ref.current.querySelector(`.${styles.filterTitle}`),
        data: { index },
        onDragStart: () => setDraggedIndex(index),
        onDragEnd: () => setDraggedIndex(null),
      });
      ref.current.dataset.dragInit = "1";
    }
  }, [filter, index, setDraggedIndex]);

  useEffect(() => {
    if (!ref.current) return;
    let cleanup;
    cleanup = dropTargetForElements({
      element: ref.current,
      getData: () => ({ swapIdx: index }),
      canDrop: () => true,
      onDrop: ({ source }) => onSwapDrop(index),
      onDragEnter: () => onSwapEnter(index),
      onDragLeave: () => onSwapLeave(index),
    });
    return () => cleanup && cleanup();
  }, [index, onSwapDrop, onSwapEnter, onSwapLeave]);

  return (
    <div
      ref={ref}
      className={`${styles.filterOptions} ${filter.enabled ? styles.enabled : ""} ${swapActive ? styles.swapActive : ""}`}
      data-filter-index={index}
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
          >
            {filter.enabled ? "👁️" : "🚫"}
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.delete}`}
            onClick={() => removeFilter(index)}
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
                <div key="cc" className={styles.customColors}>
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
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addCustomColor(index)}>
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
  const fileInputRef = useRef();
  const canvasRef = useRef();
  const [fonts, setFonts] = useState([]);
  const [filters, setFilters] = useState([]);
  const [canExport, setCanExport] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [dropZoneActive, setDropZoneActive] = useState(-1);
  const [swapIdx, setSwapIdx] = useState(-1);
  const [showAdd, setShowAdd] = useState(false);
  const [fileURL, setFileURL] = useState(null);

  useEffect(() => {
    loadFonts().then(setFonts);
  }, []);

  useEffect(() => {
    setDragIdx(null);
  }, [filters.length]);

  const defs = useMemo(() => getFilterDefs(fonts), [fonts]);
  const makePasses = useCallback(
    (gl, { filters: fArr }) =>
      fArr
        .filter((f) => f && f.enabled)
        .map((f) => new defs[f.type].Pass(gl, f.opts)),
    [defs],
  );

  const { loadFile, exportResult } = useProcessMedia(canvasRef, makePasses, {
    filters,
  });

  // Handler for "drop between" (DropZone)
  const handleDropBetween = useCallback(
    (idx) => {
      setFilters((fs) => {
        if (
          dragIdx == null ||
          dragIdx === idx ||
          dragIdx < 0 ||
          idx < 0 ||
          dragIdx >= fs.length ||
          idx > fs.length
        )
          return fs;
        const arr = [...fs];
        const [dragged] = arr.splice(dragIdx, 1);
        arr.splice(idx > dragIdx ? idx - 1 : idx, 0, dragged);
        return arr;
      });
      setDragIdx(null);
      setDropZoneActive(-1);
      setSwapIdx(-1);
    },
    [dragIdx],
  );

  const handleSwapDrop = useCallback(
    (idx) => {
      setFilters((fs) => {
        if (
          dragIdx == null ||
          dragIdx === idx ||
          dragIdx < 0 ||
          idx < 0 ||
          dragIdx >= fs.length ||
          idx >= fs.length
        )
          return fs;
        const arr = [...fs];
        [arr[dragIdx], arr[idx]] = [arr[idx], arr[dragIdx]];
        return arr;
      });
      setDragIdx(null);
      setDropZoneActive(-1);
      setSwapIdx(-1);
    },
    [dragIdx],
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
      const opts = {};
      def.options.forEach((o) => {
        opts[o.name === "customColors" ? "customColors" : o.name] =
          o.name === "customColors"
            ? ["#FF0000", "#00FF00", "#0000FF", "#FFFFFF", "#000000"]
            : o.defaultValue;
      });
      setFilters((fs) => [...fs, { type, opts, open: false, enabled: true }]);
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
                customColors: f.opts.customColors.filter(
                  (_, idx) => idx !== ci,
                ),
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
              onClick={() => fileInputRef.current.click()}
            >
              Choose File
            </button>
          </div>
          <button
            type="button"
            className="xpButton"
            disabled={!canExport}
            onClick={handleExport}
          >
            Export
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
              <React.Fragment key={i}>
                <FilterOptions
                  filter={f}
                  index={i}
                  fonts={fonts}
                  toggleFilter={toggleFilter}
                  handleOptionChange={handleOptionChange}
                  removeFilter={removeFilter}
                  setDraggedIndex={setDragIdx}
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
        </div>
      </div>
    </div>
  );
}
