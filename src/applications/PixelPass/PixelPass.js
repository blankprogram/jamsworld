import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  processMediaWithFilters,
  processGIFWithFilters,
} from "../../utils/processMediaWithFilters";
import {
  invertColors,
  grayscale,
  blur,
  sharpen,
  dithering,
  applyPaletteFilter,
  edgeDetection,
  posterize,
  asciiFilter,
  pixelSortFilter
} from "../../utils/filters";
import { loadFonts } from "../../utils/fontUtils";
import styles from "./PixelPass.module.css";


const FILTER_FUNCTIONS = {
  ASCII: asciiFilter,
  PIXEL: pixelSortFilter,
  INVERT: invertColors,
  GRAYSCALE: grayscale,
  BLUR: blur,
  SHARPEN: sharpen,
  DITHERING: dithering,
  PALETTE: applyPaletteFilter,
  EDGE: edgeDetection,
  POSTERIZE: posterize,
};

const getFilterOptions = (fonts, intervalType) => ({
  ASCII: {
    title: "ASCII Filter",
    options: [
      { label: "Width", type: "number", name: "newWidth", defaultValue: 50 },
      { label: "Characters", type: "text", name: "chars", defaultValue: ".:-=+*#%@" },
      { label: "Font", type: "select", name: "font", options: fonts, defaultValue: fonts[0] || "Arial" },
      { label: "Fill", type: "color", name: "fill", defaultValue: "#000000" },
    ],
  },
  PIXEL: {
    title: "Pixel Sort Filter",
    options: [
      { label: "Direction", type: "select", name: "direction", options: ["Right", "Left", "Down", "Up"], defaultValue: "Right" },
      { label: "Sort Method", type: "select", name: "sortMethod", options: ["rgb", "hue", "sat", "laplace", "luminance"], defaultValue: "hue" },
      { label: "Interval Type", type: "select", name: "intervalType", options: ["none", "threshold"], defaultValue: "none" },
      { label: "Lower Threshold", type: "range", name: "lowerThreshold", showIf: () => intervalType === "threshold", props: { min: 0, max: 100 }, defaultValue: 27 },
      { label: "Upper Threshold", type: "range", name: "upperThreshold", showIf: () => intervalType === "threshold", props: { min: 0, max: 100 }, defaultValue: 81 },
    ],
  },
  INVERT: { title: "Invert Colors", options: [] },
  GRAYSCALE: { title: "Grayscale", options: [] },
  BLUR: { title: "Blur", options: [{ label: "Strength", type: "range", name: "strength", props: { min: 0, max: 20 }, defaultValue: 1 }] },
  SHARPEN: { title: "Sharpen", options: [{ label: "Strength", type: "range", name: "strength", props: { min: 0, max: 20 }, defaultValue: 1 }] },
  DITHERING: { title: "Dithering", options: [] },
  PALETTE: {
    title: "Palette Filter",
    options: [],
    defaultPalette: ["#000000", "#FFFFFF"],
  },
  EDGE: { title: "Edge Detection", options: [] },
  POSTERIZE: { title: "Posterize", options: [{ label: "Levels", type: "range", name: "levels", props: { min: 0, max: 20 }, defaultValue: 5 }] },
});

const FilterControl = ({ label, type, name, value, options, onChange, props }) => (
  <label className={styles.filterLabel}>
    {label}:
    {type === "select" ? (
      <select name={name} value={value} onChange={onChange}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    ) : (
      <input type={type} name={name} value={value} onChange={onChange} {...props} />
    )}
  </label>
);

const PaletteOptions = ({ filter, index, handleOptionChange }) => (
  <div className={styles.paletteOptionsContainer}>
    {filter.options.palette.map((color, colorIndex) => (
      <div key={colorIndex} className={styles.paletteColorRow}>
        <input
          type="color"
          value={color}
          onChange={(e) =>
            handleOptionChange(index, "palette", [
              ...filter.options.palette.slice(0, colorIndex),
              e.target.value,
              ...filter.options.palette.slice(colorIndex + 1),
            ])
          }
          className={styles.paletteColorInput}
        />
        <button
          onClick={() =>
            handleOptionChange(index, "palette", [
              ...filter.options.palette.slice(0, colorIndex),
              ...filter.options.palette.slice(colorIndex + 1),
            ])
          }
          className={`${styles.removeButton} xpButton`}
        >
          Remove
        </button>
      </div>
    ))}
    <button
      onClick={() =>
        handleOptionChange(index, "palette", [...filter.options.palette, "#000000"])
      }
      className={`${styles.addButton} xpButton`}
    >
      Add Color
    </button>
  </div>
);


const FilterOptions = ({ filter, index, fonts, toggleFilter, handleOptionChange, removeFilterFromStack, getFilterFunction }) => {
  const filterOptions = useMemo(() => getFilterOptions(fonts, filter.options.intervalType), [fonts, filter.options.intervalType]);
  const filterType = useMemo(() => Object.keys(filterOptions).find((key) => filter.filterFunc === getFilterFunction(key)), [filter, getFilterFunction, filterOptions]);
  const { title, options } = filterOptions[filterType] || {};

  return (
    <div className={styles.filterOptions}>
      <h4 className={styles.filterTitle} onClick={() => toggleFilter(index)}>
        {title}
      </h4>
      {filter.isOpen && (
        <div className={styles.filterContent}>
          {filterType === "PALETTE" && (
            <PaletteOptions filter={filter} index={index} handleOptionChange={handleOptionChange} />
          )}
          {options.map(({ label, type, name, options: opt, showIf, props, defaultValue }) =>
            (!showIf || showIf(filter.options)) && (
              <FilterControl
                key={name}
                label={label}
                type={type}
                name={name}
                value={filter.options[name] ?? defaultValue}
                options={opt}
                onChange={(e) => handleOptionChange(index, name, e.target.value)}
                props={props}
              />
            )
          )}
          <button onClick={() => removeFilterFromStack(index)} className={styles.removeFilterButton}>
            X
          </button>
        </div>
      )}
    </div>
  );
};

const PixelPass = () => {
  const [fileType, setFileType] = useState(null);
  const [fileURL, setFileURL] = useState(null);
  const [outputURL, setOutputURL] = useState(null);
  const [filterStack, setFilterStack] = useState([]);
  const [showFilterOptions, setShowFilterOptions] = useState(false);
  const [fonts, setFonts] = useState([]);

  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchFonts = async () => {
      const loadedFonts = await loadFonts();
      setFonts(loadedFonts);
    };
    fetchFonts();
  }, []);

  const resetFilters = useCallback(() => {
    setOutputURL(null);
    setFilterStack([]);
  }, []);

  const handleFileChange = useCallback(
    (e) => {
      const uploadedFile = e.target.files[0];
      if (uploadedFile) {
        const objectURL = URL.createObjectURL(uploadedFile);
        setFileURL(objectURL);
        setFileType(uploadedFile.type);
        resetFilters();
      } else {
        console.error("No file selected!");
      }
    },
    [resetFilters]
  );

  const addFilterToStack = useCallback(
    (filterType) => {
      const filterFunc = FILTER_FUNCTIONS[filterType];
      const filterConfig = getFilterOptions(fonts)[filterType];
      const filterOptions = filterConfig.options.reduce((acc, opt) => {
        acc[opt.name] = opt.defaultValue;
        return acc;
      }, {});

      if (filterConfig.defaultPalette) {
        filterOptions.palette = filterConfig.defaultPalette;
      }

      setFilterStack((prevStack) => [
        ...prevStack,
        { filterFunc, options: filterOptions, isOpen: false },
      ]);
      setShowFilterOptions(false);
    },
    [fonts]
  );

  const toggleFilter = useCallback((index) => {
    setFilterStack((prevStack) =>
      prevStack.map((filter, i) =>
        i === index ? { ...filter, isOpen: !filter.isOpen } : filter
      )
    );
  }, []);

  const removeFilterFromStack = useCallback((index) => {
    setFilterStack((prevStack) => prevStack.filter((_, i) => i !== index));
  }, []);

  const processImage = useCallback(async (fileURL, filters) => {
    const img = new Image();
    img.src = fileURL;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = img.width;
    canvas.height = img.height;
    context.drawImage(img, 0, 0);

    return processMediaWithFilters(context.canvas, filters);
  }, []);

  const applyFilters = useCallback(async () => {
    if (!fileURL) return;

    const filters = filterStack.map(({ filterFunc, options }) => (context) => filterFunc(context, options));

    try {
      const result = fileType === "image/gif"
        ? await processGIFWithFilters(fileURL, filters)
        : await processImage(fileURL, filters);

      setOutputURL(result);
    } catch (error) {
      console.error("Error applying filters:", error);
    }
  }, [fileURL, fileType, filterStack, processImage]);

  const handleOptionChange = useCallback((index, optionName, value) => {
    setFilterStack((prevStack) => {
      const updatedStack = [...prevStack];
      updatedStack[index].options[optionName] = optionName === "strength" ? Number(value) : value;
      return updatedStack;
    });
  }, []);

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
                  onChange={handleFileChange}
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
          <button onClick={applyFilters} className="xpButton">
            Apply Filters
          </button>
        </div>
        <div className={styles.filterStackScrollable}>
          {filterStack.map((filter, index) => (
            <FilterOptions
              key={index}
              filter={filter}
              index={index}
              fonts={fonts}
              toggleFilter={toggleFilter}
              handleOptionChange={handleOptionChange}
              removeFilterFromStack={removeFilterFromStack}
              getFilterFunction={(key) => FILTER_FUNCTIONS[key]}
            />
          ))}
          <button
            onClick={() => setShowFilterOptions((prev) => !prev)}
            className="xpButton"
          >
            + Add Filter
          </button>
          {showFilterOptions && (
            <div className={styles.filterSelection}>
              {Object.keys(FILTER_FUNCTIONS).map((filterType) => (
                <button
                  key={filterType}
                  onClick={() => addFilterToStack(filterType)}
                  className="xpButton"
                >
                  {filterType.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className={styles.imagesContainer}>
        <div className={styles.imageBox}>
          {(outputURL || fileURL) && (
            <img src={outputURL || fileURL} alt="Preview" className={styles.image} />
          )}
        </div>
      </div>
    </div>
  );
};

export default PixelPass;
