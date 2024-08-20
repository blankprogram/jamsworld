import React, { useEffect, useRef, useState } from "react";

import { convertGIFtoASCII, convertImageToASCII } from "../../utils/ascii";
import { loadFonts } from "../../utils/fontUtils";
import { convertGIFtoPIXEL, convertImageToPIXEL } from "../../utils/pixel";

import styles from "./PixelPass.module.css";

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

  const handleFileChange = (e) => {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
      const objectURL = URL.createObjectURL(uploadedFile);
      setFileURL(objectURL);
      setFileType(uploadedFile.type);
      resetFilters();
    } else {
      console.error("No file selected!");
    }
  };

  const resetFilters = () => {
    setOutputURL(null);
    setFilterStack([]);
  };

  const addFilterToStack = (filterType, options) => {
    const filterFunc = getFilterFunction(filterType);
    setFilterStack([...filterStack, { filterFunc, options, isOpen: false }]);
    setShowFilterOptions(false);
  };

  const getFilterFunction = (filterType) => {
    const isGIF = fileType === "image/gif";
    return {
      ASCII: isGIF ? convertGIFtoASCII : convertImageToASCII,
      PIXEL: isGIF ? convertGIFtoPIXEL : convertImageToPIXEL,
    }[filterType];
  };

  const toggleFilter = (index) => {
    setFilterStack(
      filterStack.map((filter, i) =>
        i === index ? { ...filter, isOpen: !filter.isOpen } : filter
      )
    );
  };

  const removeFilterFromStack = (index) => {
    setFilterStack(filterStack.filter((_, i) => i !== index));
  };

  const applyFilters = async () => {
    if (!fileURL) return;

    let imgSrc = fileURL;

    for (const { filterFunc, options } of filterStack) {
      imgSrc = await applyFilter(imgSrc, filterFunc, options);
    }

    setOutputURL(imgSrc);
  };

  const applyFilter = (imgSrc, filterFunc, options) => {
    return new Promise((resolve, reject) => {
      if (fileType === "image/gif") {
        filterFunc(imgSrc, ...Object.values(options))
          .then(resolve)
          .catch(reject);
      } else {
        const img = new Image();
        img.onload = () => {
          filterFunc(img, ...Object.values(options))
            .then(resolve)
            .catch(reject);
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = imgSrc;
      }
    });
  };

  const renderFilterOptions = (filter, index) => {
    const handleOptionChange = (e, optionName) => {
      const updatedStack = [...filterStack];
      updatedStack[index].options[optionName] = e.target.value;
      setFilterStack(updatedStack);
    };

    const filterOptions = {
      ASCII: {
        title: "ASCII Filter",
        options: [
          { label: "Width", type: "number", name: "width" },
          { label: "Characters", type: "text", name: "chars" },
          { label: "Font", type: "select", name: "font", options: fonts },
          { label: "Fill", type: "color", name: "fill" },
        ],
      },
      PIXEL: {
        title: "Pixel Sort Filter",
        options: [
          {
            label: "Direction",
            type: "select",
            name: "direction",
            options: ["Right", "Left", "Down", "Up"],
          },
          {
            label: "Sort Method",
            type: "select",
            name: "sortMethod",
            options: ["rgb", "hue", "sat", "laplace", "luminance"],
          },
          {
            label: "Interval Type",
            type: "select",
            name: "intervalType",
            options: ["none", "threshold"],
          },
          {
            label: "Lower Threshold",
            type: "range",
            name: "lowerThreshold",
            showIf: () => filter.options.intervalType === "threshold",
            props: { min: 0, max: 100 },
          },
          {
            label: "Upper Threshold",
            type: "range",
            name: "upperThreshold",
            showIf: () => filter.options.intervalType === "threshold",
            props: { min: 0, max: 100 },
          },
        ],
      },
    };

    const filterType =
      filter.filterFunc === convertImageToASCII ||
      filter.filterFunc === convertGIFtoASCII
        ? "ASCII"
        : "PIXEL";
    const { title, options } = filterOptions[filterType];

    return (
      <div key={index} className={styles.filterOptions}>
        <h4 className={styles.filterTitle} onClick={() => toggleFilter(index)}>
          {title}
        </h4>
        {filter.isOpen && (
          <div className={styles.filterContent}>
            {options.map(
              ({ label, type, name, options: opt, showIf, props }) => {
                if (showIf && !showIf()) return null;
                return (
                  <label key={name}>
                    {label}:
                    {type === "select" ? (
                      <select
                        name={name}
                        value={filter.options[name]}
                        onChange={(e) => handleOptionChange(e, name)}
                      >
                        {opt.map((option, i) => (
                          <option key={i} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={type}
                        name={name}
                        value={filter.options[name]}
                        onChange={(e) => handleOptionChange(e, name)}
                        {...props}
                      />
                    )}
                  </label>
                );
              }
            )}
            <button
              onClick={() => removeFilterFromStack(index)}
              className={styles.removeFilterButton}
            >
              X
            </button>
          </div>
        )}
      </div>
    );
  };
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
          {filterStack.map((filter, index) =>
            renderFilterOptions(filter, index)
          )}
          <button
            onClick={() => setShowFilterOptions(!showFilterOptions)}
            className="xpButton"
          >
            + Add Filter
          </button>{" "}
          {showFilterOptions && (
            <div className={styles.filterSelection}>
              <button
                onClick={() =>
                  addFilterToStack("ASCII", {
                    width: 50,
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
