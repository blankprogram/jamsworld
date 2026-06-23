import { useEffect } from "react";
import { getErrorMessage, waitUntilVideoPrepared } from "./mediaHelpers";

export function useCameraSource({
  cameraOn,
  videoRef,
  cleanupVideoElement,
  clearSource,
  ensurePipeline,
  renderVideoFrame,
  revokeObjectUrl,
  setMediaError,
  setSource,
  startLiveVideoLoop,
  stopGifLoop,
  stopLiveVideoLoop,
  syncPipeline,
}) {
  useEffect(() => {
    const video = videoRef?.current;
    if (!video) return undefined;

    if (!cameraOn) {
      if (clearSource("camera")) {
        cleanupVideoElement();
      }
      return undefined;
    }

    stopGifLoop();
    stopLiveVideoLoop();
    clearSource();

    let cancelled = false;

    (async () => {
      const pipeline = await ensurePipeline();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      cleanupVideoElement();
      revokeObjectUrl();

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      await video.play();
      await waitUntilVideoPrepared(pipeline, video, () => cancelled);
      if (cancelled) return;

      setSource({
        kind: "camera",
        source: video,
        url: null,
        frames: null,
        ready: true,
      });
      syncPipeline(pipeline);
      renderVideoFrame(video);
      setMediaError(null);
      startLiveVideoLoop();
    })().catch((err) => {
      setMediaError(getErrorMessage(err));
      if (process.env.NODE_ENV !== "production") {
        console.warn("[useProcessMedia] camera start failed", err);
      }
    });

    return () => {
      cancelled = true;
      if (clearSource("camera")) {
        cleanupVideoElement();
      }
    };
  }, [
    cameraOn,
    cleanupVideoElement,
    clearSource,
    ensurePipeline,
    renderVideoFrame,
    revokeObjectUrl,
    setMediaError,
    setSource,
    startLiveVideoLoop,
    stopGifLoop,
    stopLiveVideoLoop,
    syncPipeline,
    videoRef,
  ]);
}
