import React, { useEffect, useRef, useState, useCallback } from "react";
import { processMediaWithFilters, processGIFWithFilters } from "../../utils/processMediaWithFilters";
import { pixelSortFilter } from "../../utils/pixel";
import { asciiFilter } from "../../utils/ascii";
import { loadFonts } from "../../utils/fontUtils";
import styles from "./PixelPass.module.css";

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

const FilterOptions = ({ filter, index, fonts, toggleFilter, handleOptionChange, removeFilterFromStack }) => {
  const filterOptions = {
    ASCII: {
      title: "ASCII Filter",
      options: [
        { label: "Width", type: "number", name: "newWidth" },
        { label: "Characters", type: "text", name: "chars" },
        { label: "Font", type: "select", name: "font", options: fonts },
        { label: "Fill", type: "color", name: "fill" },
      ],
    },
    PIXEL: {
      title: "Pixel Sort Filter",
      options: [
        { label: "Direction", type: "select", name: "direction", options: ["Right", "Left", "Down", "Up"] },
        { label: "Sort Method", type: "select", name: "sortMethod", options: ["rgb", "hue", "sat", "laplace", "luminance"] },
        { label: "Interval Type", type: "select", name: "intervalType", options: ["none", "threshold"] },
        {
          label: "Lower Threshold", type: "range", name: "lowerThreshold",
          showIf: () => filter.options.intervalType === "threshold", props: { min: 0, max: 100 }
        },
        {
          label: "Upper Threshold", type: "range", name: "upperThreshold",
          showIf: () => filter.options.intervalType === "threshold", props: { min: 0, max: 100 }
        },
      ],
    },
  };

  const filterType = filter.filterFunc === asciiFilter ? "ASCII" : "PIXEL";
  const { title, options } = filterOptions[filterType];

  return (
    <div className={styles.filterOptions}>
      <h4 className={styles.filterTitle} onClick={() => toggleFilter(index)}>
        {title}
      </h4>
      {filter.isOpen && (
        <div className={styles.filterContent}>
          {options.map(({ label, type, name, options: opt, showIf, props }) =>
            (!showIf || showIf(filter.options)) && (
              <FilterControl
                key={name}
                label={label}
                type={type}
                name={name}
                value={filter.options[name]}
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

  const handleFileChange = useCallback((e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      const objectURL = URL.createObjectURL(uploadedFile);
      setFileURL(objectURL);
      setFileType(uploadedFile.type);
      resetFilters();
    } else {
      console.error("No file selected!");
    }
  }, []);

  const resetFilters = useCallback(() => {
    setOutputURL(null);
    setFilterStack([]);
  }, []);

  const addFilterToStack = useCallback((filterType, options) => {
    const filterFunc = getFilterFunction(filterType);
    setFilterStack((prevStack) => [
      ...prevStack,
      { filterFunc, options, isOpen: false },
    ]);
    setShowFilterOptions(false);
  }, []);

  const getFilterFunction = (filterType) => {
    return {
      ASCII: asciiFilter,
      PIXEL: pixelSortFilter,
    }[filterType];
  };

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

  const argumentOrder = {
    pixelSortFilter: ['direction', 'sortMethod', 'lowerThreshold', 'upperThreshold', 'intervalType'],
    asciiFilter: ['newWidth', 'chars', 'font', 'fill'],
  };

  const orderOptions = (filterName, options) => {
    return argumentOrder[filterName].map(key => options[key]);
  };

  const applyFilters = useCallback(async () => {
    if (!fileURL) return;

    const filters = filterStack.map(({ filterFunc, options }) => {
      const orderedOptions = orderOptions(filterFunc.name, options);
      return (context) => filterFunc(context, ...orderedOptions);
    });

    let result;
    if (fileType === "image/gif") {
      result = await processGIFWithFilters(fileURL, filters);
    } else {
      const img = new Image();
      img.src = fileURL;
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      console.log("Image loaded for PixelPass:", img);
      result = await processMediaWithFilters(img, filters);
    }
    setOutputURL(result);
  }, [fileURL, fileType, filterStack]);

  const handleOptionChange = useCallback((index, optionName, value) => {
    setFilterStack((prevStack) => {
      const updatedStack = [...prevStack];
      updatedStack[index].options[optionName] = value;
      return updatedStack;
    });
  }, []);

  return (
    <div className={styles.mainContainer}>
      <div className={styles.filterStack}>
        <div className={styles.filterStackFixed}>
          <h3>Filter Stack</h3>
          <div className={styles.formContainer}>
            <form className={styles.form}>
              <div className={styles.formGroup}>
                <label>Select file:</label>
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
              <button
                onClick={() =>
                  addFilterToStack("ASCII", {
                    newWidth: 50,
                    chars: ".:-=+*#%@",
                    font: fonts[0] || "Arial",
                    fill: "#000000",
                  })
                }
                className="xpButton"
              >
                ASCII Filter
              </button>
              <button
                onClick={() =>
                  addFilterToStack("PIXEL", {
                    direction: "Right",
                    intervalType: "none",
                    sortMethod: "hue",
                    lowerThreshold: 27,
                    upperThreshold: 81,
                  })
                }
                className="xpButton"
              >
                Pixel Sort Filter
              </button>
            </div>
          )}
        </div>
      </div>
      <div className={styles.imagesContainer}>
        <div className={styles.imageBox}>
          <img
            src={outputURL || fileURL}
            alt="Preview"
            className={styles.image}
          />
        </div>
      </div>
    </div>
  );
};

export default PixelPass;
