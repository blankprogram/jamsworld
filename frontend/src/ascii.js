import { GifReader } from 'omggif';
import GIFEncoder from 'gif-encoder-2-browser';

export function convertImageToASCII(img, width, chars, font, fill) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const aspectRatio = img.height / img.width;
    const newHeight = Math.floor(aspectRatio * width * 0.5);
    canvas.width = width;
    canvas.height = newHeight;
    context.drawImage(img, 0, 0, width, newHeight);
    const imageData = context.getImageData(0, 0, width, newHeight).data;
    const scaleFactor = chars.length / 256;
    let asciiStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 10}" height="${newHeight * 20}" font-family="${font}" font-size="10">`;

    for (let y = 0; y < newHeight; y++) {
        for (let x = 0; x < width; x++) {
            const offset = (y * width + x) * 4;
            const [r, g, b, alpha] = imageData.slice(offset, offset + 4);
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

export function convertGIFToASCII(gifURL, width, chars, font, fill, callback) {
    fetch(gifURL)
        .then(resp => resp.arrayBuffer())
        .then(buff => {
            const gifReader = new GifReader(new Uint8Array(buff));
            const asciiFrameData = [];
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = gifReader.width;
            canvas.height = gifReader.height;

            for (let i = 0; i < gifReader.numFrames(); i++) {
                const frameInfo = gifReader.frameInfo(i);
                const imageData = new Uint8Array(gifReader.width * gifReader.height * 4);
                gifReader.decodeAndBlitFrameRGBA(i, imageData);

                const imgData = context.createImageData(gifReader.width, gifReader.height);
                imgData.data.set(imageData);
                context.putImageData(imgData, 0, 0);
                const asciiStr = convertImageToASCII(canvas, width, chars, font, fill);

                asciiFrameData.push({ asciiStr, frameInfo });
            }

            encodeAsciiGIF(asciiFrameData, gifReader.width, gifReader.height, callback);
        });
}

export function encodeAsciiGIF(frames, width, height, callback) {
    const encoder = new GIFEncoder(width, height, 'neuquant', true);
    encoder.setRepeat(0);
    encoder.setQuality(30);
    encoder.start();

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;

    let frameCounter = 0;

    frames.forEach((frame) => {
        const { asciiStr, frameInfo } = frame;
        const img = new Image();
        img.src = `data:image/svg+xml;base64,${btoa(asciiStr)}`;
        img.onload = () => {
            context.clearRect(0, 0, width, height);
            context.drawImage(img, 0, 0, width, height);
            encoder.setDelay(frameInfo.delay * 10);
            encoder.setDispose(frameInfo.disposal);
            if (frameInfo.transparent_index !== undefined) {
                encoder.setTransparent(frameInfo.transparent_index);
            }
            encoder.addFrame(context);

            frameCounter++;

            if (frameCounter === frames.length) {
                encoder.finish();
                const binaryGif = encoder.out.getData();
                const blob = new Blob([binaryGif], { type: 'image/gif' });
                callback(URL.createObjectURL(blob));
            }
        };
    });
}
