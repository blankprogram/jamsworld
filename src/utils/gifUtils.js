import { GifReader } from "omggif";
import GIFEncoder from "gif-encoder-2-browser";

export function decodeGIF(buffer) {
  const gifReader = new GifReader(new Uint8Array(buffer));
  const frames = [];
  const width = gifReader.width;
  const height = gifReader.height;

  let previousFrame = new Uint8ClampedArray(width * height * 4);
  let backupFrame = null;

  for (let i = 0; i < gifReader.numFrames(); i++) {
    const frameInfo = gifReader.frameInfo(i);
    const rgba = new Uint8Array(width * height * 4);

    rgba.set(previousFrame);

    gifReader.decodeAndBlitFrameRGBA(i, rgba);

    const imgData = new ImageData(new Uint8ClampedArray(rgba), width, height);
    frames.push({ imgData, frameInfo });

    switch (frameInfo.disposal) {
      case 0:
      case 1:
        previousFrame = rgba;
        break;
      case 2:
        previousFrame = new Uint8ClampedArray(width * height * 4);
        break;
      case 3:
        if (backupFrame) {
          previousFrame = backupFrame.slice();
        }
        break;
      default:
        previousFrame = rgba;
        break;
    }

    if (frameInfo.disposal === 3) {
      backupFrame = previousFrame.slice();
    }
  }

  return { frames, width, height };
}

export async function encodeGIF(frames, width, height) {
  const encoder = new GIFEncoder(width, height, "neuquant", true);
  encoder.setRepeat(0);
  encoder.setQuality(1);
  encoder.setTransparent(0x00ff00);
  encoder.start();

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;

  for (const { imgData, frameInfo } of frames) {
    ctx.putImageData(imgData, 0, 0);
    encoder.setDelay(frameInfo.delay * 10);
    encoder.setDispose(frameInfo.disposal);
    encoder.addFrame(ctx);
  }

  encoder.finish();
  const binaryGif = encoder.out.getData();
  return URL.createObjectURL(new Blob([binaryGif], { type: "image/gif" }));
}
