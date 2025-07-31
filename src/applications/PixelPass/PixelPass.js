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
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { useProcessMedia } from "../../hooks/useProcessMedia";
import {
  InvertPass,
  GrayscalePass,
  GaussianBlurPass,
  SharpenPass,
  EdgePass,
  PosterizePass,
  AsciiPass,
  DownsamplePass,
  DitherPass,
  PalettePass,
  EmbossPass,
  ChromaticAberrationPass,
} from "../../utils/GLPipeline";

const ALL_PASSES = [
  InvertPass,
  GrayscalePass,
  GaussianBlurPass,
  SharpenPass,
  EdgePass,
  PosterizePass,
  AsciiPass,
  DitherPass,
  DownsamplePass,
  PalettePass,
  EmbossPass,
  ChromaticAberrationPass,
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

const FilterOptions = ({
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
}) => {
  const ref = useRef();
  const defs = useMemo(() => getFilterDefs(fonts), [fonts]);
  const cfg = defs[filter.type];

  useEffect(() => {
    if (!ref.current.dataset.dragInit) {
      draggable({
        element: ref.current,
        dragHandle: ref.current.querySelector(`.${styles.filterTitle}`),
        data: { index },
        onDragStart: () => setDraggedIndex(index),
        onDragEnd: () => setDraggedIndex(null),
      });
      dropTargetForElements({
        element: ref.current,
        getData: () => ({ index }),
      });
      ref.current.dataset.dragInit = "1";
    }
  }, [index, setDraggedIndex]);

  return (
    <div
      ref={ref}
      className={`${styles.filterOptions} ${
        filter.enabled ? styles.enabled : ""
      }`}
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
};

export default function PixelPass() {
  const fileInputRef = useRef();
  const canvasRef = useRef();
  const [fonts, setFonts] = useState([]);
  const [filters, setFilters] = useState([]);
  const [canExport, setCanExport] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [fileURL, setFileURL] = useState(null);

  useEffect(() => {
    loadFonts().then(setFonts);
  }, []);

  const defs = useMemo(() => getFilterDefs(fonts), [fonts]);
  const makePasses = useCallback(
    (gl, { filters: fArr }) =>
      fArr
        .filter((f) => f.enabled)
        .map((f) => new defs[f.type].Pass(gl, f.opts)),
    [defs],
  );

  const { loadFile, exportResult } = useProcessMedia(canvasRef, makePasses, {
    filters,
  });

  useEffect(() => {
    monitorForElements({
      onDrop({ location }) {
        const to = location.current.dropTargets[0]?.data.index;
        if (dragIdx != null && to != null && dragIdx !== to) {
          setFilters((fs) => {
            const a = [...fs];
            [a[dragIdx], a[to]] = [a[to], a[dragIdx]];
            return a;
          });
        }
        setDragIdx(null);
      },
    });
  }, [dragIdx]);

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
          {filters.map((f, i) => (
            <FilterOptions
              key={i}
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
            />
          ))}

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
