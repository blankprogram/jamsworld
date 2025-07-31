import { decodeGIF, encodeGIF } from "./gifUtils";

export async function processMediaWithFilters(img, filters) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  let { width, height } = img;
  canvas.width = width;
  canvas.height = height;

  context.drawImage(img, 0, 0, width, height);

  for (const filter of filters) {
    const result = await filter(context, width, height);

    width = result.width;
    height = result.height;
    canvas.width = width;
    canvas.height = height;
    context.putImageData(result, 0, 0);
  }
  const image = canvas.toDataURL("image/svg+xml");
  return image;
}

export async function processGIFWithFilters(gifURL, filters) {
  const response = await fetch(gifURL);
  const buffer = await response.arrayBuffer();
  const { frames, width, height } = decodeGIF(buffer);

  const processedFrames = await Promise.all(
    frames.map(async ({ img, frameInfo }) => {
      const imgBitmap = await createImageBitmap(img);
      const imgDataUrl = await processMediaWithFilters(imgBitmap, filters);
      return { imgDataUrl, frameInfo };
    }),
  );

  return encodeGIF(processedFrames, width, height);
}
