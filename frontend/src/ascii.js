import { parseGIF, decompressFrames } from 'gifuct-js';

export function convertImageToASCII(img, width, chars, font, fill) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    const aspectRatio = img.height / img.width;
    const newHeight = Math.floor(aspectRatio * width * 0.5);
    canvas.width = width;
    canvas.height = newHeight;

    context.drawImage(img, 0, 0, width, newHeight);
    const imageData = context.getImageData(0, 0, width, newHeight).data;

    let asciiStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 10}" height="${newHeight * 20}" font-family="${font}" font-size="10">`;

    const scaleFactor = chars.length / 256;
    for (let y = 0; y < newHeight; y++) {
        for (let x = 0; x < width; x++) {
            const offset = (y * width + x) * 4;
            const r = imageData[offset];
            const g = imageData[offset + 1];
            const b = imageData[offset + 2];
            const alpha = imageData[offset + 3];

            if (alpha > 128) {
                const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
                const charIndex = Math.floor(brightness * scaleFactor);
                const asciiChar = chars[charIndex];
                asciiStr += `<rect x="${x * 10}" y="${y * 20}" width="11" height="21" fill="${fill}" stroke="none"></rect>`;
                asciiStr += `<text x="${x * 10}" y="${y * 20 + 15}" fill="rgb(${r},${g},${b})">${asciiChar}</text>`;
            }
        }
    }
    asciiStr += '</svg>';

    return asciiStr;
}

export function handleFileChange(e, setFile, setFileURL, setImageDimensions) {
    const uploadedFile = e.target.files[0];
    if (uploadedFile) {
        setFile(uploadedFile);
        setFileURL(URL.createObjectURL(uploadedFile));

        const img = new Image();
        img.onload = () => {
            setImageDimensions({ width: img.width, height: img.height });
        };
        img.src = URL.createObjectURL(uploadedFile);
    } else {
        console.error("No file selected!");
    }
}

export function convertGIFToASCII(gifURL, width, chars, font, fill, callback) {
    fetch(gifURL)
        .then(resp => resp.arrayBuffer())
        .then(buff => {
            const gif = parseGIF(buff);
            const frames = decompressFrames(gif, true);

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = gif.lsd.width;
            canvas.height = gif.lsd.height;

            let previousFrameImageData = context.createImageData(canvas.width, canvas.height);

            const asciiFrames = frames.map((frame) => {
                context.putImageData(previousFrameImageData, 0, 0);
                context.clearRect(0, 0, canvas.width, canvas.height);

                const imageData = new ImageData(new Uint8ClampedArray(frame.patch), frame.dims.width, frame.dims.height);
                context.putImageData(imageData, frame.dims.left, frame.dims.top);

                const asciiStr = convertImageToASCII(canvas, width, chars, font, fill);
                previousFrameImageData = context.getImageData(0, 0, canvas.width, canvas.height);
                return { asciiStr, delay: frame.delay };
            });

            callback(asciiFrames);
        });
}
