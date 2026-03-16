import React, { useRef, useState, useCallback, useMemo } from "react";
import { PixelSortPass } from "../../utils/GL/passes";
import { useProcessMedia } from "../../hooks/useProcessMedia";
import startIcon from "../../assets/Icons/start.png";
import { createAppManifest } from "../createAppManifest";
import { createPixortIcon } from "../../utils/appIconFactory";
import styles from "./Pixort.module.css";

export const appManifest = createAppManifest({
  id: "pixort",
  title: "Pixort",
  icon: createPixortIcon() || startIcon,
});

const SORT_METHODS = [
  { value: "Luminance", label: "Luminance" },
  { value: "Hue", label: "Hue" },
  { value: "Saturation", label: "Saturation" },
  { value: "RGB Average", label: "RGB Average" },
  { value: "Red", label: "Red" },
  { value: "Green", label: "Green" },
  { value: "Blue", label: "Blue" },
];

const DIRECTIONS = [
  { value: "Right", label: "Right" },
  { value: "Down", label: "Down" },
  { value: "Left", label: "Left" },
  { value: "Up", label: "Up" },
];

export default function Pixort() {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [fileURL, setFileURL] = useState(null);
  const [canExport, setCanExport] = useState(false);

  const [direction, setDirection] = useState("Right");
  const [sortBy, setSortBy] = useState("Luminance");
  const [mode, setMode] = useState("Fully Sorted");
  const [low, setLow] = useState(0.2);
  const [high, setHigh] = useState(0.8);

  const defs = useMemo(
    () => ({
      [PixelSortPass.def.type]: {
        ...PixelSortPass.def,
        Pass: PixelSortPass,
      },
    }),
    [],
  );
  const filters = useMemo(
    () => [
      {
        id: "pixort-main",
        type: PixelSortPass.def.type,
        enabled: true,
        opts: { direction, sortBy, mode, low, high },
      },
    ],
    [direction, sortBy, mode, low, high],
  );
  const mediaConfig = useMemo(() => ({ defs, filters }), [defs, filters]);
  const { loadFile, exportResult } = useProcessMedia(
    canvasRef,
    mediaConfig,
  );

  const handleFileChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = await loadFile(file);
      setFileURL(url);
      setCanExport(true);
    },
    [loadFile],
  );

  const handleExport = useCallback(() => {
    if (canExport) exportResult("pixorted");
  }, [canExport, exportResult]);

  return (
    <>
      <div className={styles.formContainer}>
        <div className={styles.formTop}>
          <button
            className={styles.button}
            onClick={() => fileInputRef.current.click()}
          >
            Choose File
          </button>
          <input
            type="file"
            accept="image/*,image/gif"
            ref={fileInputRef}
            className={styles.hiddenFileInput}
            onChange={handleFileChange}
          />

          <button
            className={`${styles.button} ${styles.exportButton}`}
            onClick={handleExport}
            disabled={!canExport}
          >
            Export
          </button>
        </div>
        <div className={styles.formBottom}>
          <div className={styles.formGroup}>
            <label>Sort By:</label>
            <select
              className={styles.field}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              {SORT_METHODS.map((m) => (
                <option value={m.value} key={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>Direction:</label>
            <select
              className={styles.field}
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              {DIRECTIONS.map((d) => (
                <option value={d.value} key={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.formGroup}>
            <label>Mode:</label>
            <select
              className={styles.field}
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="Fully Sorted">Fully Sorted</option>
              <option value="Threshold">Threshold</option>
            </select>
          </div>

          {mode === "Threshold" && (
            <div className={`${styles.formGroup} ${styles.rangeRow}`}>
              <div className={styles.rangeCol}>
                <label>Low Threshold:</label>
                <div className={styles.rangeInline}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={low}
                    onChange={(e) => setLow(+e.target.value)}
                  />
                  <span className={styles.valueBox}>{low}</span>
                </div>
              </div>
              <div className={styles.rangeCol}>
                <label>High Threshold:</label>
                <div className={styles.rangeInline}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={high}
                    onChange={(e) => setHigh(+e.target.value)}
                  />
                  <span className={styles.valueBox}>{high}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className={styles.mainContainer}>
        <div className={styles.imagesContainer}>
          {fileURL && (
            <div className={styles.imageBox}>
              <img src={fileURL} alt="uploaded" />
            </div>
          )}
          <div className={styles.imageBox}>
            <canvas ref={canvasRef} />
          </div>
        </div>
      </div>
    </>
  );
}
