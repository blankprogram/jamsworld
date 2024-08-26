export function invertColors(context) {
    const imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    const pixels = imageData.data;

    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 255 - pixels[i];       // Red
        pixels[i + 1] = 255 - pixels[i + 1]; // Green
        pixels[i + 2] = 255 - pixels[i + 2]; // Blue
    }

    context.putImageData(imageData, 0, 0);
    return imageData;
}

export function grayscale(context) {
    const imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    const pixels = imageData.data;

    for (let i = 0; i < pixels.length; i += 4) {
        const avg = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
        pixels[i] = pixels[i + 1] = pixels[i + 2] = avg;
    }

    context.putImageData(imageData, 0, 0);
    return imageData;
}

export function blur(context, { strength }) {
    if (strength <= 0) return context.getImageData(0, 0, context.canvas.width, context.canvas.height);

    const imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    const kernelSize = Math.max(3, Math.floor(strength) * 2 + 1);
    const sigma = strength / 2;
    const kernel = generateGaussianKernel(kernelSize, sigma);

    applySeparableConvolution(imageData, kernel);
    context.putImageData(imageData, 0, 0);
    return imageData;
}

function generateGaussianKernel(size, sigma) {
    const kernel = [];
    const mean = size / 2;
    const twoSigmaSquare = 2 * sigma * sigma;
    let sum = 0;

    for (let x = 0; x < size; x++) {
        const value = Math.exp(-((x - mean) ** 2) / twoSigmaSquare);
        kernel.push(value);
        sum += value;
    }

    return kernel.map(value => value / sum);
}

function applySeparableConvolution(imageData, kernel) {
    const { data: pixels, width, height } = imageData;
    const output = new Uint8ClampedArray(pixels.length);
    const half = Math.floor(kernel.length / 2);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let rTotal = 0, gTotal = 0, bTotal = 0;

            for (let k = -half; k <= half; k++) {
                const ix = Math.min(width - 1, Math.max(0, x + k));
                const index = (y * width + ix) * 4;
                const weight = kernel[k + half];
                rTotal += pixels[index] * weight;
                gTotal += pixels[index + 1] * weight;
                bTotal += pixels[index + 2] * weight;
            }

            const outputIndex = (y * width + x) * 4;
            output[outputIndex] = rTotal;
            output[outputIndex + 1] = gTotal;
            output[outputIndex + 2] = bTotal;
            output[outputIndex + 3] = pixels[outputIndex + 3];
        }
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let rTotal = 0, gTotal = 0, bTotal = 0;

            for (let k = -half; k <= half; k++) {
                const iy = Math.min(height - 1, Math.max(0, y + k));
                const index = (iy * width + x) * 4;
                const weight = kernel[k + half];
                rTotal += output[index] * weight;
                gTotal += output[index + 1] * weight;
                bTotal += output[index + 2] * weight;
            }

            const outputIndex = (y * width + x) * 4;
            pixels[outputIndex] = clamp(rTotal);
            pixels[outputIndex + 1] = clamp(gTotal);
            pixels[outputIndex + 2] = clamp(bTotal);
            pixels[outputIndex + 3] = output[outputIndex + 3];
        }
    }
}

export function sharpen(context, { strength }) {
    if (strength <= 0) return context.getImageData(0, 0, context.canvas.width, context.canvas.height);

    const imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    const weights = [
        0, -strength, 0,
        -strength, 4 * strength + 1, -strength,
        0, -strength, 0,
    ];

    applyConvolution(imageData, weights);
    context.putImageData(imageData, 0, 0);
    return imageData;
}

function applyConvolution(imageData, weights) {
    const { data: pixels, width, height } = imageData;
    const output = new Uint8ClampedArray(pixels.length);
    const size = Math.sqrt(weights.length);
    const half = Math.floor(size / 2);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let rTotal = 0, gTotal = 0, bTotal = 0;

            for (let wy = -half; wy <= half; wy++) {
                for (let wx = -half; wx <= half; wx++) {
                    const ix = Math.min(width - 1, Math.max(0, x + wx));
                    const iy = Math.min(height - 1, Math.max(0, y + wy));
                    const index = (iy * width + ix) * 4;
                    const weight = weights[(wy + half) * size + (wx + half)];

                    rTotal += pixels[index] * weight;
                    gTotal += pixels[index + 1] * weight;
                    bTotal += pixels[index + 2] * weight;
                }
            }

            const outputIndex = (y * width + x) * 4;
            output[outputIndex] = clamp(rTotal);
            output[outputIndex + 1] = clamp(gTotal);
            output[outputIndex + 2] = clamp(bTotal);
            output[outputIndex + 3] = pixels[outputIndex + 3];
        }
    }

    imageData.data.set(output);
    return imageData;
}

function clamp(value) {
    return Math.max(0, Math.min(255, value));
}

export function dithering(context) {
    const { width, height } = context.canvas;
    const imageData = context.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    for (let i = 0; i < pixels.length; i += 4) {
        const oldRed = pixels[i];
        const newRed = oldRed < 128 ? 0 : 255;
        const redError = oldRed - newRed;

        const oldGreen = pixels[i + 1];
        const newGreen = oldGreen < 128 ? 0 : 255;
        const greenError = oldGreen - newGreen;

        const oldBlue = pixels[i + 2];
        const newBlue = oldBlue < 128 ? 0 : 255;
        const blueError = oldBlue - newBlue;
        pixels[i] = newRed;
        pixels[i + 1] = newGreen;
        pixels[i + 2] = newBlue;

        distributeError(pixels, i, redError, greenError, blueError, 7 / 16, 1);
        distributeError(pixels, i, redError, greenError, blueError, 3 / 16, width - 1);
        distributeError(pixels, i, redError, greenError, blueError, 5 / 16, width);
        distributeError(pixels, i, redError, greenError, blueError, 1 / 16, width + 1);
    }

    context.putImageData(imageData, 0, 0);
    return imageData;
}

function distributeError(pixels, index, redError, greenError, blueError, factor, offset) {
    const newIndex = index + offset * 4;
    if (newIndex < 0 || newIndex >= pixels.length) return;

    pixels[newIndex] = clamp(pixels[newIndex] + redError * factor);
    pixels[newIndex + 1] = clamp(pixels[newIndex + 1] + greenError * factor);
    pixels[newIndex + 2] = clamp(pixels[newIndex + 2] + blueError * factor);
}

export function applyPaletteFilter(context, { palette }) {
    if (!palette || palette.length === 0) {
        console.error("Palette is empty or undefined.");
        return context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    }

    const imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    const pixels = imageData.data;

    for (let i = 0; i < pixels.length; i += 4) {
        const [closestR, closestG, closestB] = findClosestColor(
            pixels[i], pixels[i + 1], pixels[i + 2], palette
        );

        pixels[i] = closestR;
        pixels[i + 1] = closestG;
        pixels[i + 2] = closestB;
    }

    context.putImageData(imageData, 0, 0);
    return imageData;
}

function findClosestColor(r, g, b, palette) {
    let closestColor = palette[0];
    let closestDistance = Infinity;

    palette.forEach(color => {
        const [r2, g2, b2] = hexToRgb(color);
        const distance = Math.sqrt(
            Math.pow(r - r2, 2) +
            Math.pow(g - g2, 2) +
            Math.pow(b - b2, 2)
        );

        if (distance < closestDistance) {
            closestDistance = distance;
            closestColor = color;
        }
    });

    return hexToRgb(closestColor);
}

function hexToRgb(hex) {
    const bigint = parseInt(hex.slice(1), 16);
    return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

export function edgeDetection(context) {
    grayscale(context);

    const sobelX = [
        -1, 0, 1,
        -2, 0, 2,
        -1, 0, 1
    ];

    const sobelY = [
        -1, -2, -1,
        0, 0, 0,
        1, 2, 1
    ];

    const imageDataX = applyConvolution(context.getImageData(0, 0, context.canvas.width, context.canvas.height), sobelX);
    const imageDataY = applyConvolution(context.getImageData(0, 0, context.canvas.width, context.canvas.height), sobelY);

    const { data: pixelsX } = imageDataX;
    const { data: pixelsY } = imageDataY;

    const output = new Uint8ClampedArray(pixelsX.length);
    for (let i = 0; i < pixelsX.length; i += 4) {
        const magnitude = Math.sqrt(
            Math.pow(pixelsX[i], 2) + Math.pow(pixelsY[i], 2)
        );
        output[i] = output[i + 1] = output[i + 2] = clamp(magnitude);
        output[i + 3] = 255;
    }

    const resultImageData = new ImageData(output, context.canvas.width, context.canvas.height);
    context.putImageData(resultImageData, 0, 0);
    return resultImageData;
}

export function posterize(context, { levels }) {
    if (levels < 2) levels = 2;
    const numOfAreas = 256 / levels;
    const numOfValues = 255 / (levels - 1);

    const imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    const pixels = imageData.data;

    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = Math.floor(pixels[i] / numOfAreas) * numOfValues;
        pixels[i + 1] = Math.floor(pixels[i + 1] / numOfAreas) * numOfValues;
        pixels[i + 2] = Math.floor(pixels[i + 2] / numOfAreas) * numOfValues;
    }

    context.putImageData(imageData, 0, 0);
    return imageData;
}


export function asciiFilter(context, { newWidth, chars, font, fill }) {
    return new Promise((resolve) => {
        const aspectRatio = context.canvas.height / context.canvas.width;
        const newHeight = Math.floor((newWidth * aspectRatio) / 2);

        const resizeCanvas = document.createElement('canvas');
        resizeCanvas.width = newWidth;
        resizeCanvas.height = newHeight;
        const resizeContext = resizeCanvas.getContext('2d');
        resizeContext.drawImage(context.canvas, 0, 0, newWidth, newHeight);

        const imageData = resizeContext.getImageData(0, 0, newWidth, newHeight).data;
        const scaleFactor = chars.length / 256;
        const charWidth = 10;
        const charHeight = charWidth * 2;

        context.canvas.width = newWidth * charWidth;
        context.canvas.height = newHeight * charHeight;

        context.font = `${charHeight * 0.55}px ${font}`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        for (let y = 0; y < newHeight; y++) {
            for (let x = 0; x < newWidth; x++) {
                const offset = (y * newWidth + x) * 4;
                const brightness = 0.299 * imageData[offset] + 0.587 * imageData[offset + 1] + 0.114 * imageData[offset + 2];
                const asciiChar = chars[Math.floor(brightness * scaleFactor)];

                if (imageData[offset + 3] > 128) {
                    const xPos = x * charWidth;
                    const yPos = y * charHeight;

                    context.fillStyle = fill;
                    context.fillRect(xPos, yPos, charWidth, charHeight);

                    context.fillStyle = `rgb(${imageData[offset]}, ${imageData[offset + 1]}, ${imageData[offset + 2]})`;
                    context.fillText(asciiChar, xPos + charWidth / 2, yPos + charHeight / 2);
                }
            }
        }

        resolve(context.getImageData(0, 0, context.canvas.width, context.canvas.height));
    });
}


export function pixelSortFilter(context, { direction, sortMethod, lowerThreshold, upperThreshold, intervalType }) {
    const { width, height } = context.canvas;
    const imageData = context.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    const mask = intervalType === 'threshold'
        ? createContrastMask(pixels, lowerThreshold / 100, upperThreshold / 100)
        : new Uint8ClampedArray(pixels.length / 4).fill(1);

    const sortSpan = (span, start, end, fixed, vertical) => {
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

        span.sort((a, b) => (direction === 'Right' || direction === 'Down' ? a.value - b.value : b.value - a.value));

        span.forEach((pixel, i) => {
            const x = vertical ? fixed : start + i;
            const y = vertical ? start + i : fixed;
            const index = (y * width + x) * 4;
            pixels[index] = pixel.r;
            pixels[index + 1] = pixel.g;
            pixels[index + 2] = pixel.b;
            pixels[index + 3] = pixel.a;
        });
    };

    const processSpan = (index, isRow) => {
        let start = -1;
        for (let i = 0; i < (isRow ? width : height); i++) {
            const maskIndex = isRow ? index * width + i : i * width + index;
            if (mask[maskIndex]) {
                if (start === -1) start = i;
            } else if (start !== -1) {
                sortSpan([], start, i - 1, index, !isRow);
                start = -1;
            }
        }
        if (start !== -1) sortSpan([], start, (isRow ? width : height) - 1, index, !isRow);
    };

    const isVertical = direction === 'Left' || direction === 'Right';
    for (let i = 0; i < (isVertical ? height : width); i++) {
        processSpan(i, isVertical);
    }

    context.putImageData(imageData, 0, 0);
    return context.getImageData(0, 0, width, height);
}

function createContrastMask(pixels, lowerThreshold, upperThreshold) {
    const mask = new Uint8ClampedArray(pixels.length / 4);
    for (let i = 0; i < pixels.length; i += 4) {
        const luminance = RGBToHSL(pixels[i], pixels[i + 1], pixels[i + 2])[2];
        mask[i / 4] = luminance >= lowerThreshold && luminance <= upperThreshold ? 1 : 0;
    }
    return mask;
}

function getValue(pixels, x, y, width, sortMethod) {
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
}

function RGBToHSL(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 :
        max === g ? ((b - r) / d + 2) / 6 :
            ((r - g) / d + 4) / 6;
    return [h, s, l];
}

function getLaplace(pixels, width, x, y) {
    const laplaceKernel = [0, -1, 0, -1, 4, -1, 0, -1, 0];
    let laplace = 0;
    for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
            const nx = x + kx, ny = y + ky;
            if (nx >= 0 && nx < width && ny >= 0 && ny < width) {
                const index = (ny * width + nx) * 4;
                const luminance = RGBToHSL(pixels[index], pixels[index + 1], pixels[index + 2])[2];
                laplace += luminance * laplaceKernel[(ky + 1) * 3 + (kx + 1)];
            }
        }
    }
    return laplace;
}

