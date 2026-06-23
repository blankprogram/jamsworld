export function waitForEvent(target, eventName) {
  return new Promise((resolve, reject) => {
    const onOk = () => {
      cleanup();
      resolve();
    };
    const onErr = (e) => {
      cleanup();
      reject(e);
    };
    const cleanup = () => {
      target.removeEventListener(eventName, onOk);
      target.removeEventListener("error", onErr);
    };
    target.addEventListener(eventName, onOk, { once: true });
    target.addEventListener("error", onErr, { once: true });
  });
}

export function waitForAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export function hasVideoDimensions(video) {
  return !!(video?.videoWidth > 0 && video?.videoHeight > 0);
}

export async function waitForVideoMetadata(video) {
  if (hasVideoDimensions(video)) return;
  await waitForEvent(video, "loadedmetadata");
}

export async function waitUntilVideoPrepared(
  pipeline,
  video,
  isCancelled = () => false,
) {
  while (!isCancelled()) {
    if (pipeline.prepareVideo(video)) return true;
    await waitForAnimationFrame();
  }
  return false;
}

export function isLiveSourceKind(sourceKind) {
  return sourceKind === "video" || sourceKind === "camera";
}

export function getSupportedVideoMimeType() {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || null;
}

export function getErrorMessage(err) {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string") return err;
  return "Media processing failed";
}

export function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export function downloadUrl(url, filename) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  downloadUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
