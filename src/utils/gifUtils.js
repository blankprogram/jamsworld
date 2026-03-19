import { GifReader } from "omggif";
import GIFEncoder from "gif-encoder-2-browser";

const TRANSPARENT_KEY_CANDIDATES = [
  0xff00ff, 0x00ff00, 0x00ffff, 0xff0000, 0x0000ff, 0xffff00, 0x010203, 0xfefdfc,
];

function hasAnyFullyTransparentPixel(data) {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] === 0) return true;
  }
  return false;
}

function opaqueUsesColor(data, key) {
  const r = (key >> 16) & 0xff;
  const g = (key >> 8) & 0xff;
  const b = key & 0xff;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] !== 0 && data[i] === r && data[i + 1] === g && data[i + 2] === b) {
      return true;
    }
  }
  return false;
}

function prepareFrameForEncoding(imgData) {
  const src = imgData.data;
  if (!hasAnyFullyTransparentPixel(src)) {
    return { rgba: src, transparentKey: null };
  }

  let transparentKey = TRANSPARENT_KEY_CANDIDATES[0];
  for (let i = 0; i < TRANSPARENT_KEY_CANDIDATES.length; i += 1) {
    const candidate = TRANSPARENT_KEY_CANDIDATES[i];
    if (!opaqueUsesColor(src, candidate)) {
      transparentKey = candidate;
      break;
    }
  }

  const rgba = new Uint8ClampedArray(src);
  const r = (transparentKey >> 16) & 0xff;
  const g = (transparentKey >> 8) & 0xff;
  const b = transparentKey & 0xff;

  for (let i = 0; i < rgba.length; i += 4) {
    if (rgba[i + 3] === 0) {
      rgba[i] = r;
      rgba[i + 1] = g;
      rgba[i + 2] = b;
    }
  }

  return { rgba, transparentKey };
}

export function decodeGIF(buffer) {
  const gifReader = new GifReader(new Uint8Array(buffer));
  const frames = [];
  const width = gifReader.width;
  const height = gifReader.height;

  let composedFrame = new Uint8ClampedArray(width * height * 4);

  for (let i = 0; i < gifReader.numFrames(); i++) {
    const frameInfo = gifReader.frameInfo(i);
    const rgba = new Uint8Array(composedFrame);
    const backupFrame = frameInfo.disposal === 3 ? composedFrame.slice() : null;

    gifReader.decodeAndBlitFrameRGBA(i, rgba);

    const imgData = new ImageData(new Uint8ClampedArray(rgba), width, height);
    frames.push({ imgData, frameInfo });

    switch (frameInfo.disposal) {
      case 0:
      case 1:
        composedFrame = new Uint8ClampedArray(rgba);
        break;
      case 2:
        composedFrame = new Uint8ClampedArray(rgba);
        {
          const x0 = Math.max(0, frameInfo.x | 0);
          const y0 = Math.max(0, frameInfo.y | 0);
          const x1 = Math.min(width, x0 + (frameInfo.width | 0));
          const y1 = Math.min(height, y0 + (frameInfo.height | 0));
          for (let y = y0; y < y1; y += 1) {
            for (let x = x0; x < x1; x += 1) {
              const p = (y * width + x) * 4;
              composedFrame[p] = 0;
              composedFrame[p + 1] = 0;
              composedFrame[p + 2] = 0;
              composedFrame[p + 3] = 0;
            }
          }
        }
        break;
      case 3:
        composedFrame = backupFrame || new Uint8ClampedArray(rgba);
        break;
      default:
        composedFrame = new Uint8ClampedArray(rgba);
        break;
    }
  }

  return { frames, width, height };
}

export async function encodeGIF(frames, width, height) {
  const encoder = new GIFEncoder(width, height, "neuquant", true);
  encoder.setRepeat(0);
  encoder.setQuality(1);
  encoder.start();

  for (const { imgData, frameInfo } of frames) {
    const { rgba, transparentKey } = prepareFrameForEncoding(imgData);
    encoder.setTransparent(transparentKey);
    const delayCs = Math.max(1, Number(frameInfo?.delay ?? 1));
    encoder.setDelay(delayCs * 10);
    // Frames are exported as full reconstructed images; clear between frames to avoid trails.
    encoder.setDispose(2);
    encoder.addFrame(rgba);
  }

  encoder.finish();
  const binaryGif = encoder.out.getData();
  return URL.createObjectURL(new Blob([binaryGif], { type: "image/gif" }));
}
