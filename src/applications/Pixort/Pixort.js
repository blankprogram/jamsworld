import React, { useRef, useState, useCallback } from "react";
import GLPipeline, { PixelSortPass } from "../../utils/GLPipeline";
import { useProcessMedia } from "../../hooks/useProcessMedia";
import "./Pixort.css";
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

  const makePixortPasses = useCallback(
    (gl, opts) => [
      new PixelSortPass(gl, {
        direction: opts.direction,
        sortBy: opts.sortBy,
        mode: opts.mode,
        low: opts.low,
        high: opts.high,
      }),
    ],
    [],
  );

  const pixortOpts = { direction, sortBy, mode, low, high };
  const { loadFile, exportResult } = useProcessMedia(
    canvasRef,
    makePixortPasses,
    pixortOpts,
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
      <div className="form-container">
        <div className="form-top">
          <button
            className="button"
            onClick={() => fileInputRef.current.click()}
          >
            Choose File
          </button>
          <input
            type="file"
            accept="image/*,image/gif"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          <button
            className="button export-button"
            onClick={handleExport}
            disabled={!canExport}
          >
            Export
          </button>
        </div>
        <div className="form-bottom">
          <div className="form-group">
            <label>Sort By:</label>
            <select
              className="field"
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
          <div className="form-group">
            <label>Direction:</label>
            <select
              className="field"
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
          <div className="form-group">
            <label>Mode:</label>
            <select
              className="field"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="Fully Sorted">Fully Sorted</option>
              <option value="Threshold">Threshold</option>
            </select>
          </div>

          {mode === "Threshold" && (
            <div className="form-group range-row">
              <div className="range-col">
                <label>Low Threshold:</label>
                <div className="range-inline">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={low}
                    onChange={(e) => setLow(+e.target.value)}
                  />
                  <span className="value-box">{low}</span>
                </div>
              </div>
              <div className="range-col">
                <label>High Threshold:</label>
                <div className="range-inline">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={high}
                    onChange={(e) => setHigh(+e.target.value)}
                  />
                  <span className="value-box">{high}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="main-container">
        <div className="images-container">
          {fileURL && (
            <div className="image-box">
              <img src={fileURL} alt="uploaded" />
            </div>
          )}
          <div className="image-box">
            <canvas ref={canvasRef} />
          </div>
        </div>
      </div>
    </>
  );
}
