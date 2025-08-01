import React, { useState, useRef, useEffect, useCallback } from "react";
import { SketchPicker } from "react-color";
import { AsciiPass } from "../../utils/GLPipeline";
import { loadFonts } from "../../utils/fontUtils";
import { useProcessMedia } from "../../hooks/useProcessMedia";
import "./Asciify.css";

export default function Asciify() {
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const pickerRef = useRef(null);

  const [chars, setChars] = useState(".:-=+*#%@");
  const [fonts, setFonts] = useState(["Arial"]);
  const [font, setFont] = useState("Arial");
  const [density, setDensity] = useState(1);
  const [blockSize, setBlockSize] = useState(16);
  const [fill, setFill] = useState("#000000");
  const [showPicker, setShowPicker] = useState(false);

  const [fileURL, setFileURL] = useState(null);
  const [canExport, setCanExport] = useState(false);

  useEffect(() => {
    loadFonts().then((f) => {
      if (f && f.length) {
        setFonts(f);
        setFont(f[0]);
      } else {
        setFonts(["Arial"]);
        setFont("Arial");
      }
    });
  }, []);

  const makeAsciiPasses = useCallback(
    (gl, opts) => [new AsciiPass(gl, { ...opts, alphaThreshold: 0.5 })],
    [],
  );
  const asciiOpts = { chars, fontFamily: font, blockSize, fill, density };
  const { loadFile, exportResult } = useProcessMedia(
    canvasRef,
    makeAsciiPasses,
    asciiOpts,
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
    if (canExport) exportResult("asciified");
  }, [canExport, exportResult]);

  useEffect(() => {
    const onClick = (e) => {
      if (pickerRef.current?.contains(e.target)) return;
      setShowPicker(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <>
      <div className="form-container">
        <div className="form-top">
          <div className="form-left">
            <div className="rainbow-text-container">
              {"ASCIIFY :)".split("").map((c, i) => (
                <span
                  key={i}
                  style={{ animationDelay: `${i * 0.1}s, ${i * 0.7}s` }}
                >
                  {c}
                </span>
              ))}
            </div>
            <button
              className="button"
              onClick={() => fileInputRef.current.click()}
            >
              Choose File
            </button>
            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
          </div>

          <div className="form-right">
            <button
              className="button export-button"
              onClick={handleExport}
              disabled={!canExport}
            >
              Export
            </button>
          </div>
        </div>

        <div className="form-bottom">
          <div className="form-group">
            <label>Characters:</label>
            <input
              type="text"
              className="field"
              value={chars}
              onChange={(e) => setChars(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Font:</label>
            <select
              className="field"
              value={font}
              onChange={(e) => setFont(e.target.value)}
            >
              {fonts.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Fill Color:</label>
            <div
              className="color-select-icon"
              style={{ backgroundColor: fill }}
              onClick={() => setShowPicker((v) => !v)}
            />
            {showPicker && (
              <div className="color-picker-popover" ref={pickerRef}>
                <SketchPicker
                  color={fill}
                  onChangeComplete={(c) => {
                    setFill(c.hex);
                    setShowPicker(false);
                  }}
                />
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Density:</label>
            <input
              type="range"
              className="field"
              min={0.25}
              max={5}
              step={0.25}
              value={density}
              onChange={(e) => setDensity(+e.target.value)}
            />
            <span className="value-box">{density}</span>
          </div>

          <div className="form-group">
            <label>Block Size:</label>
            <input
              type="range"
              className="field"
              min={4}
              max={64}
              step={1}
              value={blockSize}
              onChange={(e) => setBlockSize(+e.target.value)}
            />
            <span className="value-box">{blockSize}</span>
          </div>
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
