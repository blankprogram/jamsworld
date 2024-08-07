// src/utils/svgConverter.js

export const svgToPng = (svgString) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const pngDataUrl = canvas.toDataURL('image/png');
            resolve(pngDataUrl);
        };
        img.onerror = reject;
        img.src = 'data:image/svg+xml;base64,' + btoa(svgString);
    });
};
