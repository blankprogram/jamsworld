import './Pixort.css';
import React, { useState, useRef } from 'react';
import { convertGIFtoPIXEL, convertImageToPIXEL } from '../../utils/pixel';

const Pixort = () => {
    const [file, setFile] = useState(null);
    const [fileURL, setFileURL] = useState(null);
    const [outputPath, setOutputPath] = useState('');
    const [direction, setDirection] = useState('Right');
    const [intervalType, setIntervalType] = useState('none');
    const [sortMethod, setSortMethod] = useState('hue');
    const [lowerThreshold, setLowerThreshold] = useState(28);
    const [upperThreshold, setUpperThreshold] = useState(81);
    
    const fileInputRef = useRef(null); // Use ref to target the file input element

    const handleFileChange = (e) => {
        const uploadedFile = e.target.files[0];
        if (uploadedFile) {
            setFile(uploadedFile);
            const objectURL = URL.createObjectURL(uploadedFile);
            setFileURL(objectURL);
            console.log("File URL set:", objectURL);
        } else {
            console.error("No file selected!");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            console.error('No file selected!');
            return;
        }
        setOutputPath('');
        try {
            if (file.type === 'image/gif') {
                const gifPath = await convertGIFtoPIXEL(
                    fileURL, direction, intervalType, sortMethod, lowerThreshold,
                    upperThreshold);
                setOutputPath(gifPath);
            } else {
                const img = new Image();
                img.onload = async () => {
                    const pixelStr = await convertImageToPIXEL(
                        img, direction, intervalType, sortMethod, lowerThreshold,
                        upperThreshold);
                    setOutputPath(pixelStr);
                };
                img.onerror = (error) => {
                    console.error('Image load error:', error);
                };
                img.src = fileURL;
            }
        } catch (err) {
            console.error('Error converting file:', err);
        }
    };

    return (
        <>
            <div className='form-container'>
                <form onSubmit={handleSubmit} className='form'>
                    <div className='form-group field-row'>
                        <label>Select file:</label>
                        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="field" />
                        <button type='button' className='button' onClick={() => fileInputRef.current.click()}>Choose File</button>
                    </div>
                    <div className='form-group field-row'>
                        <label>Direction:</label>
                        <select value={direction} onChange={(e) => setDirection(e.target.value)} className="field">
                            <option value="Right">Right</option>
                            <option value='Down'>Down</option>
                            <option value="Left">Left</option>
                            <option value='Up'>Up</option>
                        </select>
                    </div>
                    <div className="form-group field-row">
                        <label>Interval Type:</label>
                        <select value={intervalType} onChange={(e) => setIntervalType(e.target.value)} className='field'>
                            <option value='none'>None</option>
                            <option value="threshold">Threshold</option>
                        </select>
                    </div>
                    {intervalType === 'threshold' && (
                        <div className='form-group field-row' style={{ width: '300px' }}>
                            <label>Lower Threshold:</label>
                            <input type='range' min='0' max='100' value={lowerThreshold} onChange={(e) => setLowerThreshold(parseInt(e.target.value))} />
                            <label>Upper Threshold:</label>
                            <input type='range' min='0' max='100' value={upperThreshold} onChange={(e) => setUpperThreshold(parseInt(e.target.value))} />
                        </div>
                    )}
                    <div className="form-group field-row">
                        <label>Sort Method:</label>
                        <select value={sortMethod} onChange={(e) => setSortMethod(e.target.value)} className='field'>
                            <option value='rgb'>RGB</option>
                            <option value='hue'>Hue</option>
                            <option value="sat">Saturation</option>
                            <option value='laplace'>Laplace</option>
                            <option value='luminance'>Luminance</option>
                        </select>
                    </div>
                    <button type="submit" className="button">Upload and Convert</button>
                </form>
            </div>
            <div className='main-container'>
                <div className='images-container'>
                    <div className='image-box'>
                        {fileURL && <img src={fileURL} alt='Uploaded' className='image' />}
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
