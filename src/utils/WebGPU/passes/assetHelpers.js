import { GPU_TEXTURE_USAGE } from "../constants";

const imageCache = new Map();

export function loadImage(url) {
  if (imageCache.has(url)) return imageCache.get(url);

  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

  imageCache.set(url, promise);
  return promise;
}

export function uploadImageTexture(device, source) {
  const width = source.naturalWidth || source.width;
  const height = source.naturalHeight || source.height;
  const texture = device.createTexture({
    size: { width, height },
    format: "rgba8unorm",
    usage: GPU_TEXTURE_USAGE.TEXTURE_BINDING | GPU_TEXTURE_USAGE.COPY_DST,
  });
  device.queue.copyExternalImageToTexture(
    { source },
    { texture },
    { width, height },
  );
  return { texture, width, height };
}

export function generateFontAtlasCanvas(chars, size, fontFamily) {
  const text = chars?.length ? chars : " ";
  const tileSize = Math.max(1, Number(size) || 1);
  const canvas = document.createElement("canvas");
  canvas.width = tileSize * text.length;
  canvas.height = tileSize;
  const ctx = canvas.getContext("2d", { alpha: true });

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = `bold ${tileSize}px ${fontFamily || "Arial"}`;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#fff";

  for (let i = 0; i < text.length; i += 1) {
    ctx.fillText(text[i], i * tileSize, 0);
  }

  return { canvas, charCount: text.length };
}

export function hexToRgb(hex, fallback = [0, 0, 0]) {
  if (Array.isArray(hex)) return hex;
  if (!/^#([0-9A-F]{6})$/i.test(hex || "")) return fallback;
  const clean = hex.slice(1);
  const value = parseInt(clean, 16);
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ];
}
