export function pixelSortFilter(context, direction, sortMethod, lowerThreshold, upperThreshold, intervalType) {
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

    // Adjust direction to correct orientation
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
