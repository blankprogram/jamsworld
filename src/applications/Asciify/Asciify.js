import React, { useState, useRef, useEffect } from "react";
import { SketchPicker } from "react-color";
import GLPipeline, { AsciiPass } from "../../utils/GLPipeline";
import { loadFonts } from "../../utils/fontUtils";
import "./Asciify.css";

const Asciify = () => {
  const canvasRef = useRef(null);
  const pipelineRef = useRef(null);
  const imageRef = useRef(null);

  const [file, setFile] = useState(null);
  const [fileURL, setFileURL] = useState(null);
  const [chars, setChars] = useState(".:-=+*#%@");
  const [font, setFont] = useState("Arial");
  const [fill, setFill] = useState("#000000");
  const [density, setDensity] = useState(1);
  const [blockSize, setBlockSize] = useState(16);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [fonts, setFonts] = useState([]);
  const colorPickerRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadFonts().then(setFonts);
    pipelineRef.current = new GLPipeline(canvasRef.current);
  }, []);

  const processImage = async (img) => {
    if (!pipelineRef.current) return;
    const pipeline = new GLPipeline(canvasRef.current);
    pipeline.addPass(
      new AsciiPass({
        chars,
        fontFamily: font,
        blockSize,
        bgColor: [
          parseInt(fill.slice(1, 3), 16) / 255,
          parseInt(fill.slice(3, 5), 16) / 255,
          parseInt(fill.slice(5, 7), 16) / 255,
        ],
        density,
      }),
    );
    pipelineRef.current = pipeline;
    await pipeline.process(img);
  };

  const handleFileChange = async (e) => {
    const uploadedFile = e.target.files[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);
    const objectURL = URL.createObjectURL(uploadedFile);
    setFileURL(objectURL);
    const img = await createImageBitmap(uploadedFile);
    imageRef.current = img;
    processImage(img);
  };

  useEffect(() => {
    if (imageRef.current) processImage(imageRef.current);
  }, [chars, font, fill, density, blockSize]);

  const handleColorChange = (color) => {
    setFill(color.hex);
    setShowColorPicker(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        colorPickerRef.current &&
        !colorPickerRef.current.contains(event.target) &&
        !event.target.closest(".color-select-icon")
      ) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div className="form-container">
        <div className="form">
          <div className="form-group field-row">
            <div className="rainbow-text-container">
              <div className="rainbow-text">
                {"ASCIIFY".split("").map((char, i) => (
                  <span
                    key={i}
                    style={{ animationDelay: `${i * 0.1}s, ${i * 0.7}s` }}
                  >
                    {char}
                  </span>
                ))}
                <span>&nbsp;</span>
                {":)".split("").map((char, i) => (
                  <span
                    key={i + 7}
                    style={{
                      animationDelay: `${(i + 7) * 0.1}s, ${(i + 7) * 0.7}s`,
                    }}
                  >
                    {char}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="form-group field-row">
            <label>Select file:</label>
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
              {fonts.map((font, index) => (
                <option key={index} value={font}>
                  {font}
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
      </div>

      <div className="main-container">
        <div className="images-container">
          <div className="image-box">
            {fileURL && <img src={fileURL} alt="Uploaded" className="image" />}
          </div>
          <div className="image-box">
            <canvas
              ref={canvasRef}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                backgroundColor: "transparent",
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default Asciify;
