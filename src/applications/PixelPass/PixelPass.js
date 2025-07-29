import React, {
  useEffect,
  useRef,
  useState,
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
import GLPipeline, {
  InvertPass,
  GrayscalePass,
  GaussianBlurPass,
  SharpenPass,
  EdgePass,
  PosterizePass,
  AsciiPass,
} from "../../utils/GLPipeline";

const FILTERS = {
  INVERT: InvertPass,
  GRAYSCALE: GrayscalePass,
  BLUR: GaussianBlurPass,
  SHARPEN: SharpenPass,
  EDGE: EdgePass,
  POSTERIZE: PosterizePass,
  ASCII: AsciiPass,
};

const getFilterOptions = (fonts) => ({
  INVERT: { title: "Invert Colors", options: [] },
  GRAYSCALE: { title: "Grayscale", options: [] },
  BLUR: {
    title: "Blur",
    options: [
      {
        label: "Strength",
        type: "range",
        name: "strength",
        props: { min: 0, max: 10, step: 0.01 },
        defaultValue: 0.5,
      },
    ],
  },
  SHARPEN: {
    title: "Sharpen",
    options: [
      {
        label: "Amount",
        type: "range",
        name: "amount",
        props: { min: 0, max: 10, step: 0.1 },
        defaultValue: 1.0,
      },
      {
        label: "Radius",
        type: "range",
        name: "radius",
        props: { min: 0, max: 10, step: 0.5 },
        defaultValue: 1.0,
      },
    ],
  },
  EDGE: { title: "Edge Detection", options: [] },
  POSTERIZE: {
    title: "Posterize",
    options: [
      {
        label: "Levels",
        type: "range",
        name: "levels",
        props: { min: 2, max: 20 },
        defaultValue: 5,
      },
    ],
  },
  ASCII: {
    title: "ASCII Filter",
    options: [
      {
        label: "Block Size",
        type: "range",
        name: "blockSize",
        props: { min: 1, max: 64, step: 1 },
        defaultValue: 16,
      },
      {
        label: "Density",
        type: "range",
        name: "density",
        props: { min: 0.25, max: 5, step: 0.25 },
        defaultValue: 1,
      },
      {
        label: "Chars",
        type: "text",
        name: "chars",
        defaultValue: ".:-=+*#%@",
      },
      {
        label: "Font",
        type: "select",
        name: "font",
        options: fonts,
        defaultValue: "Arial",
      },
      {
        label: "Fill",
        type: "color",
        name: "fill",
        defaultValue: "#000000",
      },
    ],
  },
});

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
          className={styles.rangeInput}
          type="range"
          name={name}
          value={value}
          onChange={onChange}
          {...props}
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
}) => {
  const ref = useRef();
  const configs = useMemo(() => getFilterOptions(fonts), [fonts]);
  const cfg = configs[filter.type];

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
      dropTargetForElements({
        element: ref.current,
        getData: () => ({ index }),
      });
      ref.current.dataset.dragInit = "1";
    }
  }, [index, setDraggedIndex]);

  return (
    <div ref={ref} className={styles.filterOptions} data-filter-index={index}>
      <h4 className={styles.filterTitle} onClick={() => toggleFilter(index)}>
        {cfg.title}
      </h4>
      {filter.open && (
        <div className={styles.filterContent}>
          {cfg.options.map((opt) => (
            <FilterControl
              key={opt.name}
              label={opt.label}
              type={opt.type}
              name={opt.name}
              value={filter.opts[opt.name] ?? opt.defaultValue}
              options={opt.options}
              props={opt.props}
              onChange={(e) =>
                handleOptionChange(index, opt.name, e.target.value)
              }
            />
          ))}
          <button
            onClick={() => removeFilter(index)}
            className={styles.removeFilterButton}
          >
            X
          </button>
        </div>
      )}
    </div>
  );
};

export default function PixelPass() {
  const [fileURL, setFileURL] = useState(null);
  const [outputURL, setOutputURL] = useState(null);
  const [filters, setFilters] = useState([]);
  const [fonts, setFonts] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const fileInputRef = useRef();

  useEffect(() => {
    loadFonts().then(setFonts);
  }, []);

  useEffect(() => {
    return monitorForElements({
      onDrop({ location }) {
        const to = location.current.dropTargets[0]?.data.index;
        const from = dragIdx;
        if (from != null && to != null && from !== to) {
          setFilters((f) => {
            const a = [...f];
            [a[from], a[to]] = [a[to], a[from]];
            return a;
          });
        }
        setDragIdx(null);
      },
    });
  }, [dragIdx]);

  const onFile = useCallback((e) => {
    const f = e.target.files[0];
    if (!f) return;
    setOutputURL(null);
    setFileURL(URL.createObjectURL(f));
  }, []);

  const addFilter = useCallback(
    (type) => {
      const cfg = getFilterOptions(fonts)[type];
      const opts = {};
      cfg.options.forEach((o) => (opts[o.name] = o.defaultValue));
      setFilters((f) => [...f, { type, opts, open: false }]);
      setShowAdd(false);
    },
    [fonts],
  );
  const toggleFilter = (i) =>
    setFilters((f) =>
      f.map((x, idx) => (idx === i ? { ...x, open: !x.open } : x)),
    );
  const removeFilter = (i) =>
    setFilters((f) => f.filter((_, idx) => idx !== i));
  const handleOptionChange = (i, name, val) => {
    setFilters((f) => {
      const a = [...f];
      a[i].opts = {
        ...a[i].opts,
        [name]: ["amount", "radius", "strength", "levels"].includes(name)
          ? +val
          : val,
      };
      return a;
    });
  };

  useEffect(() => {
    if (!fileURL) {
      setOutputURL(null);
      return;
    }
    (async () => {
      const img = new Image();
      img.src = fileURL;
      await new Promise((r) => (img.onload = r));
      const off = document.createElement("canvas");
      const p = GLPipeline.for(off);

      for (let f of filters) {
        p.useFilter(f.type, f.opts, img);
      }

      await p.run(img);
      setOutputURL(off.toDataURL("image/png"));
      p.destroy();
    })();
  }, [fileURL, filters]);

  return (
    <div className={styles.mainContainer}>
      <div className={styles.filterStack}>
        <div className={styles.filterStackFixed}>
          <h3>PixelPass</h3>
          <div className={styles.formContainer}>
            <form className={styles.form}>
              <div className={styles.formGroup}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={onFile}
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
            </form>
          </div>
          <button
            className="xpButton"
            disabled={!outputURL}
            onClick={() => {
              const a = document.createElement("a");
              a.href = outputURL;
              a.download = "pixelpass.png";
              a.click();
            }}
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
            />
          ))}

          <button onClick={() => setShowAdd((v) => !v)} className="xpButton">
            + Add Filter
          </button>
          {showAdd && (
            <div className={styles.filterSelection}>
              {Object.keys(FILTERS).map((type) => (
                <button
                  key={type}
                  onClick={() => addFilter(type)}
                  className="xpButton"
                >
                  {getFilterOptions(fonts)[type].title}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.imagesContainer}>
        <div className={styles.imageBox}>
          {(outputURL || fileURL) && (
            <img
              src={outputURL || fileURL}
              alt="Preview"
              className={styles.image}
            />
          )}
        </div>
      </div>
    </div>
  );
}
