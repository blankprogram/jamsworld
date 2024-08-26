import React, { useState, useRef } from 'react';
import { processMediaWithFilters, processGIFWithFilters } from '../../utils/processMediaWithFilters';
import { pixelSortFilter } from '../../utils/filters';

const Pixort = () => {
    const [file, setFile] = useState(null);
    const [fileURL, setFileURL] = useState(null);
    const [outputPath, setOutputPath] = useState('');
    const [direction, setDirection] = useState('Right');
    const [intervalType, setIntervalType] = useState('none');
    const [sortMethod, setSortMethod] = useState('hue');
    const [lowerThreshold, setLowerThreshold] = useState(28);
    const [upperThreshold, setUpperThreshold] = useState(81);

    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const uploadedFile = e.target.files[0];
        if (uploadedFile) {
            setFile(uploadedFile);
            setFileURL(URL.createObjectURL(uploadedFile));
        } else {
            console.error("No file selected!");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) return;
    
        const filters = [
            (context) => pixelSortFilter(context, { direction, sortMethod, lowerThreshold, upperThreshold, intervalType }),
        ];
    
        let result;
        if (file.type === 'image/gif') {
            result = await processGIFWithFilters(fileURL, filters);
        } else {
            const img = new Image();
            img.src = fileURL;
            result = await processMediaWithFilters(img, filters);
        }
        setOutputPath(result);
    };
    

    return (
        <>
            <div className="form-container">
                <form onSubmit={handleSubmit} className="form">
                    <div className="form-group field-row">
                        <label>Select file:</label>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="field" />
                        <button type="button" className="button" onClick={() => fileInputRef.current.click()}>Choose File</button>
                    </div>
                    <div className="form-group field-row">
                        <label>Direction:</label>
                        <select value={direction} onChange={(e) => setDirection(e.target.value)} className="field">
                            <option value="Right">Right</option>
                            <option value="Down">Down</option>
                            <option value="Left">Left</option>
                            <option value="Up">Up</option>
                        </select>
                    </div>
                    <div className="form-group field-row">
                        <label>Interval Type:</label>
                        <select value={intervalType} onChange={(e) => setIntervalType(e.target.value)} className="field">
                            <option value="none">None</option>
                            <option value="threshold">Threshold</option>
                        </select>
                    </div>
                    {intervalType === 'threshold' && (
                        <div className="form-group field-row">
                            <label>Lower Threshold:</label>
                            <input type="range" min="0" max="100" value={lowerThreshold} onChange={(e) => setLowerThreshold(parseInt(e.target.value))} />
                            <label>Upper Threshold:</label>
                            <input type="range" min="0" max="100" value={upperThreshold} onChange={(e) => setUpperThreshold(parseInt(e.target.value))} />
                        </div>
                    )}
                    <div className="form-group field-row">
                        <label>Sort Method:</label>
                        <select value={sortMethod} onChange={(e) => setSortMethod(e.target.value)} className="field">
                            <option value="rgb">RGB</option>
                            <option value="hue">Hue</option>
                            <option value="sat">Saturation</option>
                            <option value="laplace">Laplace</option>
                            <option value="luminance">Luminance</option>
                        </select>
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

export default Pixort;
