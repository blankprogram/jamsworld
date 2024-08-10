import { decodeGIF, encodeGIF } from './gifUtils';

const RGBToHSL = (r, g, b) => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, l];
};

const getValue = (pixels, x, y, width, sortMethod) => {
    const index = (y * width + x) * 4;
    const [r, g, b] = [pixels[index], pixels[index + 1], pixels[index + 2]];
    switch (sortMethod) {
        case 'hue': return RGBToHSL(r, g, b)[0];
        case 'sat': return RGBToHSL(r, g, b)[1];
        case 'laplace': return getLaplace(pixels, width, x, y);
        case 'luminance': return RGBToHSL(r, g, b)[2];
        case 'rgb': return 0.298 * r + 0.587 * g + 0.114 * b;
        default: return 0;
    }
};

const createContrastMask = (pixels, lowerThreshold, upperThreshold) => {
    const mask = new Uint8ClampedArray(pixels.length / 4);
    lowerThreshold /= 100;
    upperThreshold /= 100;

    for (let i = 0; i < pixels.length; i += 4) {
        const luminance = RGBToHSL(pixels[i], pixels[i + 1], pixels[i + 2])[2];
        mask[i / 4] = luminance >= lowerThreshold && luminance <= upperThreshold ? 1 : 0;
    }
    return mask;
};

const sortSpan = (span, start, end, fixed, pixels, width, sortMethod, direction, vertical) => {
    for (let i = start; i <= end; i++) {
        const x = vertical ? fixed : i;
        const y = vertical ? i : fixed;
        const index = (y * width + x) * 4;
        span.push({
            r: pixels[index],
            g: pixels[index + 1],
            b: pixels[index + 2],
            a: pixels[index + 3],
            value: getValue(pixels, x, y, width, sortMethod),
        });
    }
    span.sort((a, b) => (direction === 'Left' || direction === 'Up' ? b.value - a.value : a.value - b.value));

    for (let i = 0; i < span.length; i++) {
        const x = vertical ? fixed : start + i;
        const y = vertical ? start + i : fixed;
        const index = (y * width + x) * 4;
        pixels[index] = span[i].r;
        pixels[index + 1] = span[i].g;
        pixels[index + 2] = span[i].b;
        pixels[index + 3] = span[i].a;
    }
};

const sortPixels = (imageData, width, height, direction, sortMethod, lowerThreshold, upperThreshold, intervalType) => {
    const pixels = new Uint8ClampedArray(imageData);
    const mask = intervalType === 'threshold' ? createContrastMask(pixels, lowerThreshold, upperThreshold) : new Uint8ClampedArray(pixels.length / 4).fill(1);

    const processRowOrCol = (rowOrColIndex, isRow) => {
        let start = -1;
        for (let i = 0; i < (isRow ? width : height); i++) {
            const maskIndex = isRow ? rowOrColIndex * width + i : i * width + rowOrColIndex;
            if (mask[maskIndex] === 1) {
                if (start === -1) start = i;
            } else if (start !== -1) {
                sortSpan([], start, i - 1, rowOrColIndex, pixels, width, sortMethod, direction, !isRow);
                start = -1;
            }
        }
        if (start !== -1) {
            sortSpan([], start, (isRow ? width : height) - 1, rowOrColIndex, pixels, width, sortMethod, direction, !isRow);
        }
    };

    for (let i = 0; i < (direction === 'Right' || direction === 'Left' ? height : width); i++) {
        processRowOrCol(i, direction === 'Right' || direction === 'Left');
    }

    return pixels;
};

const getLaplace = (pixels, width, x, y) => {
    const laplaceKernel = [
        [0, -1, 0],
        [-1, 4, -1],
        [0, -1, 0],
    ];
    let laplace = 0;
    for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
            const nx = x + kx;
            const ny = y + ky;
            if (nx >= 0 && nx < width && ny >= 0 && ny < width) {
                const index = (ny * width + nx) * 4;
                const r = pixels[index];
                const g = pixels[index + 1];
                const b = pixels[index + 2];
                const lightness = RGBToHSL(r, g, b)[2];

                laplace += lightness * laplaceKernel[ky + 1][kx + 1];
            }
        }
    }
    return laplace;
};

const convertImageToPIXEL = async (img, direction, intervalType, sortMethod, lowerThreshold, upperThreshold) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    const { width, height } = img;
    canvas.width = width;
    canvas.height = height;

    context.drawImage(img, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height).data;

    const sortedData = sortPixels(imageData, width, height, direction, sortMethod, lowerThreshold, upperThreshold, intervalType);
    context.putImageData(new ImageData(sortedData, width, height), 0, 0);

    return canvas.toDataURL('image/svg+xml');
};

const convertGIFtoPIXEL = async (gifURL, direction, intervalType, sortMethod, lowerThreshold, upperThreshold) => {
    const response = await fetch(gifURL);
    const buffer = await response.arrayBuffer();
    const { frames, width: gifWidth, height: gifHeight } = decodeGIF(buffer);

    const sortedFrames = await Promise.all(
        frames.map(async ({ img, frameInfo }) => {
            const imgBitmap = await createImageBitmap(img);
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = gifWidth;
            canvas.height = gifHeight;

            context.drawImage(imgBitmap, 0, 0, gifWidth, gifHeight);
            const imageData = context.getImageData(0, 0, gifWidth, gifHeight);

            const sortedData = sortPixels(imageData.data, gifWidth, gifHeight, direction, sortMethod, lowerThreshold, upperThreshold, intervalType);
            context.putImageData(new ImageData(sortedData, gifWidth, gifHeight), 0, 0);
            return { imgData: context.getImageData(0, 0, gifWidth, gifHeight), frameInfo };
        })
    );

    return encodeGIF(sortedFrames, gifWidth, gifHeight);
};

export { convertImageToPIXEL, convertGIFtoPIXEL };
