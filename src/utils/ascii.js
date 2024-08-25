export function asciiFilter(context, newWidth, chars, font, fill) {
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
