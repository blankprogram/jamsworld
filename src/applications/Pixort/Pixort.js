import React, { useRef, useState, useCallback, useMemo } from "react";
import { useProcessMedia } from "../../hooks/useProcessMedia";
import { PIXEL_SORT_FILTER_DEFINITION } from "../../utils/filterDefinitions";
import startIcon from "../../assets/Icons/start.png";
import { createAppManifest } from "../createAppManifest";
import { createPixortIcon } from "../../utils/appIconFactory";
import XpButton from "../../components/XpButton/XpButton";
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
      [PIXEL_SORT_FILTER_DEFINITION.type]: {
        ...PIXEL_SORT_FILTER_DEFINITION,
      },
    }),
    [],
  );
  const filters = useMemo(
    () => [
      {
        id: "pixort-main",
        type: PIXEL_SORT_FILTER_DEFINITION.type,
        enabled: true,
        opts: { direction, sortBy, mode, low, high },
      },
    ],
    [direction, sortBy, mode, low, high],
  );
  const mediaConfig = useMemo(() => ({ defs, filters }), [defs, filters]);
  const { loadFile, exportResult, mediaError, webgpuSupported } = useProcessMedia(
    canvasRef,
    mediaConfig,
  );

  const handleFileChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const url = await loadFile(file);
      if (!url) {
        e.target.value = "";
        setCanExport(false);
        return;
      }
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
          <XpButton
            disabled={!webgpuSupported}
            onClick={() => fileInputRef.current.click()}
          >
            Choose File
          </XpButton>
          <input
            type="file"
            accept="image/*,image/gif"
            ref={fileInputRef}
            className={styles.hiddenFileInput}
            onChange={handleFileChange}
            disabled={!webgpuSupported}
          />
          {mediaError && (
            <div role="alert" className={styles.formGroup}>
              {mediaError}
            </div>
          )}

          <XpButton
            onClick={handleExport}
            disabled={!canExport}
          >
            Export
          </XpButton>
        </div>
        <div className={styles.formBottom}>
          <div className={styles.formGroup}>
            <label>Sort By:</label>
            <select
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
