import React, { useState, useRef, useEffect } from "react";
import { SketchPicker } from "react-color";
import GLPipeline from "../../utils/GLPipeline";
import { loadFonts } from "../../utils/fontUtils";
import "./Asciify.css";

export default function Asciify() {
  const canvasRef = useRef(null);
  const pipelineRef = useRef(null);
  const imageRef = useRef(null);
  const fileInputRef = useRef(null);
  const colorPickerRef = useRef(null);

  const [fileURL, setFileURL] = useState(null);
  const [chars, setChars] = useState(".:-=+*#%@");
  const [font, setFont] = useState("Arial");
  const [fill, setFill] = useState("#000000");
  const [density, setDensity] = useState(1);
  const [blockSize, setBlockSize] = useState(16);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [fonts, setFonts] = useState([]);
  const [canExport, setCanExport] = useState(false);

  useEffect(() => {
    loadFonts().then(setFonts);
    pipelineRef.current = new GLPipeline(canvasRef.current);
  }, []);

  const processImage = async (img) => {
    const pipeline = GLPipeline.for(canvasRef.current).useAscii({
      chars,
      fontFamily: font,
      blockSize,
      bgColor: [
        parseInt(fill.slice(1, 3), 16) / 255,
        parseInt(fill.slice(3, 5), 16) / 255,
        parseInt(fill.slice(5, 7), 16) / 255,
      ],
      density,
      originalSize: { width: img.width, height: img.height },
      alphaThreshold: 0.5,
    });
    pipelineRef.current = pipeline;
    await pipeline.run(img);
    setCanExport(true);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCanExport(false);
    const url = URL.createObjectURL(file);
    setFileURL(url);
    const img = await createImageBitmap(file);
    imageRef.current = img;
    await processImage(img);
  };

  useEffect(() => {
    if (imageRef.current) processImage(imageRef.current);
  }, [chars, font, fill, density, blockSize]);

  const handleExport = () => {
    if (!canvasRef.current) return;
    const dataURL = canvasRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataURL;
    a.download = "asciified.png";
    a.click();
  };

  const handleColorChange = (color) => {
    setFill(color.hex);
    setShowColorPicker(false);
  };

  useEffect(() => {
    const onClick = (e) => {
      if (
        colorPickerRef.current &&
        !colorPickerRef.current.contains(e.target) &&
        !e.target.closest(".color-select-icon")
      )
        setShowColorPicker(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <>
      <div className="form-container">
        <div className="form">
          <div className="form-group field-row">
            <div className="rainbow-text-container">
              <div className="rainbow-text">
                {Array.from("ASCIIFY").map((c, i) => (
                  <span
                    key={i}
                    style={{ animationDelay: `${i * 0.1}s, ${i * 0.7}s` }}
                  >
                    {c}
                  </span>
                ))}
                <span>&nbsp;</span>
                {Array.from(":)").map((c, i) => (
                  <span
                    key={i + 7}
                    style={{
                      animationDelay: `${(i + 7) * 0.1}s, ${(i + 7) * 0.7}s`,
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="form__controls">
            <div className="form-group field-row">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="field"
              />
              <button
                type="button"
                className="button"
                onClick={() => fileInputRef.current.click()}
              >
                Choose File
              </button>
            </div>

            <div className="form-group field-row">
              <label>Characters:</label>
              <input
                type="text"
                value={chars}
                onChange={(e) => setChars(e.target.value)}
                className="field"
              />
            </div>

            <div className="form-group field-row">
              <label>Font:</label>
              <select
                value={font}
                onChange={(e) => setFont(e.target.value)}
                className="field"
              >
                {fonts.map((f, i) => (
                  <option key={i} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group field-row">
              <label>Fill Color:</label>
              <div
                className="color-select-icon"
                style={{ backgroundColor: fill }}
                onClick={() => setShowColorPicker(!showColorPicker)}
              />
              {showColorPicker && (
                <div className="color-picker-popover" ref={colorPickerRef}>
                  <SketchPicker
                    color={fill}
                    onChangeComplete={handleColorChange}
                  />
                </div>
              )}
            </div>

            <div className="form-group field-row">
              <label>Density:</label>
              <input
                type="range"
                min="0.25"
                max="5"
                step="0.25"
                value={density}
                onChange={(e) => setDensity(parseFloat(e.target.value))}
                className="field"
              />
              <span className="value-box">{density}</span>
            </div>

            <div className="form-group field-row">
              <label>Block Size:</label>
              <input
                type="range"
                min="4"
                max="64"
                step="1"
                value={blockSize}
                onChange={(e) => setBlockSize(parseInt(e.target.value))}
                className="field"
              />
              <span className="value-box">{blockSize}</span>
            </div>
          </div>

          <button
            className="button export-button"
            onClick={handleExport}
            disabled={!canExport}
          >
            Export
          </button>
        </div>
      </div>

      <div className="main-container">
        <div className="images-container">
          <div className="image-box">
            {fileURL && <img src={fileURL} alt="Uploaded" className="image" />}
          </div>
          <div className="image-box">
            <canvas ref={canvasRef} />
          </div>
        </div>
      </div>
    </>
  );
}
