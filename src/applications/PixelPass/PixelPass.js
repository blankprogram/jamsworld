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
} from "../../utils/GLPipeline";

const ALL_PASSES = [
  InvertPass,
  GrayscalePass,
  GaussianBlurPass,
  SharpenPass,
  EdgePass,
  PosterizePass,
  AsciiPass,
  DownsamplePass,
];

function getFilterDefs(fonts) {
  const defs = {};
  ALL_PASSES.forEach((PassClass) => {
    const def = { ...PassClass.def };
    if (def.type === "ASCII") {
      def.options = def.options.map((o) =>
        o.name === "font"
          ? {
              ...o,
              type: "select",
              options: fonts,
              defaultValue: fonts[0],
            }
          : o,
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
      className={`${styles.filterOptions} ${filter.enabled ? styles.enabled : ""}`}
      data-filter-index={index}
    >
      <div className={styles.filterHeader}>
        <h4 className={styles.filterTitle} onClick={() => toggleFilter(index)}>
          {cfg.title}
        </h4>
        <div className={styles.filterIcons}>
          <button
            aria-label="Toggle filter visibility"
            className={styles.iconBtn}
            onClick={() => toggleEnabled(index)}
          >
            {filter.enabled ? "👁️" : "🚫"}
          </button>
          <button
            aria-label="Remove filter"
            className={`${styles.iconBtn} ${styles.delete}`}
            onClick={() => removeFilter(index)}
          />
        </div>
      </div>
      {filter.open && (
        <div className={styles.filterContent}>
          {cfg.options.map((opt) => (
            <FilterControl
              key={opt.name}
              {...opt}
              value={filter.opts[opt.name]}
              onChange={(e) =>
                handleOptionChange(index, opt.name, e.target.value)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function PixelPass() {
  const fileInputRef = useRef();
  const canvasRef = useRef(null);
  const [fonts, setFonts] = useState([]);
  const [filters, setFilters] = useState([]);
  const [canExport, setCanExport] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);

  const [showAdd, setShowAdd] = useState(false);

  const [fileURL, setFileURL] = useState(null);
  useEffect(() => {
    return () => {
      if (fileURL) URL.revokeObjectURL(fileURL);
    };
  }, [fileURL]);

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

  const handleExport = useCallback(() => {
    exportResult("pixelpass");
  }, [exportResult]);

  useEffect(() => {
    monitorForElements({
      onDrop({ location }) {
        const to = location.current.dropTargets[0]?.data.index;
        if (dragIdx != null && to != null && dragIdx !== to) {
          setFilters((f) => {
            const a = [...f];
            [a[dragIdx], a[to]] = [a[to], a[dragIdx]];
            return a;
          });
        }
        setDragIdx(null);
      },
    });
  }, [dragIdx]);

  const addFilter = useCallback(
    (type) => {
      const def = defs[type];
      const opts = {};
      def.options.forEach((o) => (opts[o.name] = o.defaultValue));
      setFilters((f) => [...f, { type, opts, open: false, enabled: true }]);
      setShowAdd(false);
    },
    [defs],
  );

  const handleOptionChange = (i, name, raw) => {
    const val = isNaN(raw) ? raw : +raw;
    setFilters((fs) => {
      const next = [...fs];
      next[i] = { ...next[i], opts: { ...next[i].opts, [name]: val } };
      return next;
    });
  };

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
              className="xpButton"
              onClick={() => fileInputRef.current.click()}
            >
              Choose File
            </button>
          </div>
          <button
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
              toggleFilter={(idx) =>
                setFilters((fs) =>
                  fs.map((x, j) => (j === idx ? { ...x, open: !x.open } : x)),
                )
              }
              handleOptionChange={handleOptionChange}
              removeFilter={(idx) =>
                setFilters((fs) => fs.filter((_, j) => j !== idx))
              }
              setDraggedIndex={setDragIdx}
              toggleEnabled={(idx) =>
                setFilters((fs) =>
                  fs.map((x, j) =>
                    j === idx ? { ...x, enabled: !x.enabled } : x,
                  ),
                )
              }
            />
          ))}

          <button onClick={() => setShowAdd((v) => !v)} className="xpButton">
            + Add Filter
          </button>
          {showAdd && (
            <div className={styles.filterSelection}>
              {Object.keys(defs).map((type) => (
                <button
                  key={type}
                  onClick={() => addFilter(type)}
                  className="xpButton"
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
