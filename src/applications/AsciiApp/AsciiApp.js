import React, { useState, useRef, useEffect } from 'react';
import { SketchPicker } from 'react-color';
import { convertImageToASCII, convertGIFtoASCII } from '../../utils/ascii';
import { svgToPng } from '../../utils/svgConverter';
import { handleFileChange } from '../../utils/FileUtils';
import { loadFonts } from '../../utils/fontUtils';
import './AsciiApp.css';

const AsciiApp = () => {
    const [file, setFile] = useState(null);
    const [fileURL, setFileURL] = useState(null);
    const [width, setWidth] = useState(50);
    const [chars, setChars] = useState(".:-=+*#%@");
    const [font, setFont] = useState("");
    const [fill, setFill] = useState("#000000");
    const [outputPath, setOutputPath] = useState("");
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [fonts, setFonts] = useState([]);
    const colorPickerRef = useRef(null);

    useEffect(() => {
        const fetchFonts = async () => {
            const loadedFonts = await loadFonts();
            setFonts(loadedFonts);
        };
        fetchFonts();
    }, []);

    const handleColorChange = (color) => {
        setFill(color.hex);
        setShowColorPicker(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            console.error("No file selected!");
            return;
        }
        setOutputPath("");
        if (file.type === 'image/gif') {
            convertGIFtoASCII(fileURL, width, chars, font, fill, setOutputPath);
        } else {
            const img = new Image();
            img.onload = async () => {
                const asciiStr = convertImageToASCII(img, width, chars, font, fill);
                const pngDataUrl = await svgToPng(asciiStr);
                setOutputPath(pngDataUrl);
            };
            img.src = fileURL;
        }
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (colorPickerRef.current && !colorPickerRef.current.contains(event.target) && !event.target.closest('.color-select-icon')) {
                setShowColorPicker(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <>
            <div className="form-container">
                <form onSubmit={handleSubmit} className="form">
                    <div className="form-group field-row">
                        <div className="rainbow-text-container">
                            <div className="rainbow-text">
                                {'ASCIIFY'.split('').map((char, index) => (
                                    <span key={index} style={{ animationDelay: `${index * 0.1}s, ${index * 0.7}s` }}>
                                        {char}
                                    </span>
                                ))}
                                <span>&nbsp;</span>
                                {':)'.split('').map((char, index) => (
                                    <span key={index + 7} style={{ animationDelay: `${(index + 7) * 0.1}s, ${(index + 7) * 0.7}s` }}>
                                        {char}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="form-group field-row">
                        <label>Select file:</label>
                        <input type="file" id="file" onChange={(e) => handleFileChange(e, setFile, setFileURL)} className="field" />
                        <button type="button" className="button" onClick={() => document.getElementById('file').click()}>Choose File</button>
                    </div>
                    <div className="form-group field-row">
                        <label>Width:</label>
                        <input type="text" value={width} onChange={(e) => setWidth(e.target.value)} className="field" />
                    </div>
                    <div className="form-group field-row">
                        <label>Characters:</label>
                        <input type="text" value={chars} onChange={(e) => setChars(e.target.value)} className="field" />
                    </div>
                    <div className="form-group field-row">
                        <label>Font:</label>
                        <select value={font} onChange={(e) => setFont(e.target.value)} className="field">
                            <option value="">Select a font</option>
                            {fonts.map((font, index) => (
                                <option key={index} value={font}>{font}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-group field-row">
                        <label>Fill Color:</label>
                        <div className="color-select-icon" style={{ backgroundColor: fill }} onClick={() => setShowColorPicker(!showColorPicker)}></div>
                        {showColorPicker && (
                            <div className="color-picker-popover" ref={colorPickerRef}>
                                <SketchPicker color={fill} onChangeComplete={handleColorChange} presetColors={['#000', '#fff', 'transparent', '#f44336', '#e91e63', '#9c27b0', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4', '#009688', '#4caf50', '#8bc34a', '#cddc39', '#ffeb3b', '#ffc107', '#ff9800', '#ff5722']} />
                            </div>
                        )}
                    </div>
                    <button type="submit" className="button">Upload and Convert</button>
                </form>
            </div>
            <div className="main-container">
                <div className="images-container">
                    <div className="image-box">
                        {fileURL && <img src={fileURL} alt="Uploaded" className="image" />}
                    </div>
                    <div className="image-box">
                        {outputPath && <img src={outputPath} alt="Converted" className="image" />}
                    </div>
                </div>
            </div>
        </>
    );
};

export default AsciiApp;
