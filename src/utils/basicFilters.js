export function invertColors(context) {
    const imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
    const pixels = imageData.data;

    for (let i = 0; i < pixels.length; i += 4) {
        pixels[i] = 255 - pixels[i];
        pixels[i + 1] = 255 - pixels[i + 1];
        pixels[i + 2] = 255 - pixels[i + 2];
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

export function blur(context, strength) {
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

export function sharpen(context, strength) {
    if (strength <= 0) return context.getImageData(0, 0, context.canvas.width, context.canvas.height);

    const imageData = context.getImageData(0, 0, context.canvas.width, context.canvas.height);

    const weights = [
        0, -1 * strength, 0,
        -1 * strength, 4 * strength + 1, -1 * strength,
        0, -1 * strength, 0,
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
}

function clamp(value) {
    return Math.max(0, Math.min(255, value));
}

export function dithering(context) {
    const { width, height } = context.canvas;
    const imageData = context.getImageData(0, 0, width, height);
    const pixels = imageData.data;

    for (let i = 0; i < pixels.length; i += 4) {
        const oldPixel = pixels[i];
        const newPixel = oldPixel < 128 ? 0 : 255;
        const quantError = oldPixel - newPixel;
        pixels[i] = pixels[i + 1] = pixels[i + 2] = newPixel;

        distributeError(pixels, width, i, quantError, 7 / 16, 1);
        distributeError(pixels, width, i, quantError, 3 / 16, width - 1);
        distributeError(pixels, width, i, quantError, 5 / 16, width);
        distributeError(pixels, width, i, quantError, 1 / 16, width + 1);
    }

    context.putImageData(imageData, 0, 0);
    return imageData;
}

function distributeError(pixels, width, index, quantError, factor, offset) {
    const newIndex = index + offset * 4;
    if (newIndex < 0 || newIndex >= pixels.length) return;
    pixels[newIndex] = clamp(pixels[newIndex] + quantError * factor);
}
