import { GifReader } from 'omggif';
import GIFEncoder from 'gif-encoder-2-browser';

export function decodeGIF(buffer) {
    const gifReader = new GifReader(new Uint8Array(buffer));
    const frames = [];
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

        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = gifReader.width;
        frameCanvas.height = gifReader.height;
        frameCanvas.getContext('2d').putImageData(imgData, 0, 0);

        frames.push({ img: frameCanvas, frameInfo });
    }

    return { frames, width: gifReader.width, height: gifReader.height };
}

export function encodeGIF(frames, width, height) {
    return new Promise((resolve, reject) => {
        const encoder = new GIFEncoder(width, height, 'neuquant', true);
        encoder.setRepeat(0);
        encoder.setQuality(30);
        encoder.start();

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;

        let frameCounter = 0;

        frames.forEach((frame, index) => {
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
                    resolve(URL.createObjectURL(blob));
                }
            };

            img.onerror = (err) => {
                reject(err);
            };
        });
    });
}
