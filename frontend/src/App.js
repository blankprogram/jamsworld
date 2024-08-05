import React, { useState, useRef, useEffect } from 'react';
import { SketchPicker } from 'react-color';
import './App.css';
import 'xp.css/dist/XP.css';
import { convertImageToASCII, handleFileChange, convertGIFToASCII } from './ascii';

function App() {
    const [file, setFile] = useState(null);
    const [fileURL, setFileURL] = useState(null);
    const [width, setWidth] = useState(50);
    const [chars, setChars] = useState(".:-=+*#%@");
    const [font, setFont] = useState("");
    const [fill, setFill] = useState("#000000");
    const [outputPath, setOutputPath] = useState("");
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [fonts, setFonts] = useState([]);
    const [_, setImageDimensions] = useState({ width: 0, height: 0 });
    const windowRef = useRef(null);
    const colorPickerRef = useRef(null);
    const gifRef = useRef(null);
    const [gifFrames, setGifFrames] = useState([]);
    const [gifFrameIndex, setGifFrameIndex] = useState(0);
    const [intervalId, setIntervalId] = useState(null);

    useEffect(() => {
        fetch('http://localhost:5000/fonts')
            .then((response) => response.json())
            .then((data) => setFonts(data))
            .catch((error) => console.error('Error fetching fonts:', error));
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

        if (file.type === 'image/gif') {
            convertGIFToASCII(fileURL, width, chars, font, fill, (asciiFrames) => {
                setGifFrames(asciiFrames);
                setGifFrameIndex(0);
                if (intervalId) clearInterval(intervalId);
                const newIntervalId = playGif(asciiFrames);
                setIntervalId(newIntervalId);
            });
        } else {
            const img = new Image();
            img.onload = () => {
                const asciiStr = convertImageToASCII(img, width, chars, font, fill);
                const asciiDataURL = `data:image/svg+xml;base64,${btoa(asciiStr)}`;
                setOutputPath(asciiDataURL);
            };
            img.src = fileURL;
        }
    };

    const playGif = (frames) => {
        return setInterval(() => {
            setGifFrameIndex((prevIndex) => (prevIndex + 1) % frames.length);
        }, frames[gifFrameIndex].delay);
    };

    useEffect(() => {
        const windowElement = windowRef.current;
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let offsetX = 0;
        let offsetY = 0;

        const handleMouseEvents = (e) => {
            if (e.type === 'mousedown' && e.target.closest('.title-bar')) {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                const rect = windowElement.getBoundingClientRect();
                offsetX = startX - rect.left;
                offsetY = startY - rect.top;
            } else if (e.type === 'mousemove' && isDragging) {
                const left = e.clientX - offsetX;
                const top = e.clientY - offsetY;
                const rightBound = window.innerWidth - windowElement.offsetWidth;
                const bottomBound = window.innerHeight - windowElement.offsetHeight;
                windowElement.style.left = `${Math.min(Math.max(left, 0), rightBound)}px`;
                windowElement.style.top = `${Math.min(Math.max(top, 0), bottomBound)}px`;
            } else if (e.type === 'mouseup') {
                isDragging = false;
            }
        };

        document.addEventListener('mousedown', handleMouseEvents);
        document.addEventListener('mousemove', handleMouseEvents);
        document.addEventListener('mouseup', handleMouseEvents);

        return () => {
            document.removeEventListener('mousedown', handleMouseEvents);
            document.removeEventListener('mousemove', handleMouseEvents);
            document.removeEventListener('mouseup', handleMouseEvents);
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                colorPickerRef.current &&
                !colorPickerRef.current.contains(event.target) &&
                !event.target.closest('.color-select-icon')
            ) {
                setShowColorPicker(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className="App">
            <div className="window" ref={windowRef}>
                <div className="title-bar">
                    <div className="title-bar-text">Asciify</div>
                    <div className="title-bar-controls">
                        <button aria-label="Minimize"></button>
                        <button aria-label="Maximize"></button>
                        <button aria-label="Close"></button>
                    </div>
                </div>
                <div className="window-body">
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
                                <input type="file" id="file" onChange={(e) => handleFileChange(e, setFile, setFileURL, setImageDimensions)} className="field" />
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
                                        <option key={index} value={font.path}>{font.name}</option>
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
                                {gifFrames.length > 0 ? (
                                    <div ref={gifRef} dangerouslySetInnerHTML={{ __html: gifFrames[gifFrameIndex].asciiStr }} />
                                ) : (
                                    outputPath && <img src={outputPath} alt="ASCII Art" className="image" />
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default App;
