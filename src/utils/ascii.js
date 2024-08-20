import { decodeGIF, encodeGIF } from './gifUtils';

export function convertImageToASCII(img, width, chars, font, fill) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });

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
                const asciiChar = chars[Math.floor(brightness * scaleFactor)];

                asciiStr += `<rect x="${x * 10}" y="${y * 20}" width="11" height="21" fill="${fill}" stroke="none"></rect>`;
                asciiStr += `<text x="${x * 10}" y="${y * 20 + 15}" fill="rgb(${r},${g},${b})">${asciiChar}</text>`;
            }
        }
    }

    asciiStr += '</svg>';
    const svgBlob = new Blob([asciiStr], { type: 'image/svg+xml' });
    const svgURL = URL.createObjectURL(svgBlob);

    return Promise.resolve(svgURL);
}

export async function convertGIFtoASCII(gifURL, width, chars, font, fill) {
    const response = await fetch(gifURL);
    const buffer = await response.arrayBuffer();
    const { frames, width: gifWidth, height: gifHeight } = decodeGIF(buffer);

    const asciiFrameData = await Promise.all(
        frames.map(async ({ img, frameInfo }) => {
            const asciiDataUrl = await convertImageToASCII(img, width, chars, font, fill);
            return { imgDataUrl: asciiDataUrl, frameInfo };
        })
    );

    return encodeGIF(asciiFrameData, gifWidth, gifHeight);
}
