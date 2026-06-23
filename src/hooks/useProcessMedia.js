import { useCallback, useEffect, useRef } from "react";
import { getErrorMessage, isLiveSourceKind } from "./mediaHelpers";
import { useCameraSource } from "./useCameraSource";
import { useGifSource } from "./useGifSource";
import { useImageSource } from "./useImageSource";
import { useMediaSourceState } from "./useMediaSourceState";
import { useMediaExport } from "./useMediaExport";
import { useVideoSource } from "./useVideoSource";
import { useWebGPUPipeline } from "./useWebGPUPipeline";

const isAnimatedSourceKind = (kind) => isLiveSourceKind(kind) || kind === "gif";

export function useProcessMedia(canvasRef, config, camera) {
  const latestInvalidateRef = useRef(() => {});
  const cleanupRef = useRef(() => {});
  const scheduledRenderRef = useRef(0);

  const {
    pipelineRef,
    ensurePipeline,
    syncPipeline,
    mediaError,
    setMediaError,
    webgpuSupported,
  } = useWebGPUPipeline(canvasRef, config, latestInvalidateRef, cleanupRef);

  const {
    source,
    sourceRef,
    setSource,
    clearSource,
    revokeObjectUrl,
    resetSourceRef,
  } = useMediaSourceState(pipelineRef);

  const {
    liveVideoRafRef,
    stopLiveVideoLoop,
    cleanupVideoElement,
    renderVideoFrame,
    startLiveVideoLoop,
    loadVideoFile,
    waitForEnded,
    restoreVideoPlayback,
  } = useVideoSource({
    videoRef: camera?.videoRef,
    pipelineRef,
    ensurePipeline,
    syncPipeline,
    setSource,
    setMediaError,
  });

  const {
    frameIdx,
    stopGifLoop,
    resetGifClock,
    prepareGifFrame,
    loadGifFile,
  } = useGifSource({
    cameraOn: camera?.cameraOn,
    ensurePipeline,
    pipelineRef,
    source,
    setSource,
    sourceRef,
    syncPipeline,
  });

  const { loadImageFile } = useImageSource({
    ensurePipeline,
    setMediaError,
    setSource,
    syncPipeline,
  });

  const renderActiveFrame = useCallback(() => {
    const pipeline = pipelineRef.current;
    if (!pipeline) return;

    const current = sourceRef.current;
    if (isLiveSourceKind(current.kind)) {
      renderVideoFrame(current.source || camera?.videoRef?.current);
      return;
    }

    if (current.kind === "gif" && current.frames?.length) {
      const frame = current.frames[frameIdx.current] || current.frames[0];
      prepareGifFrame(pipeline, frame);
    } else if (current.source) {
      pipeline.prepareImage(current.source);
    }

    pipeline.renderFrame();
  }, [
    camera?.videoRef,
    frameIdx,
    pipelineRef,
    prepareGifFrame,
    renderVideoFrame,
    sourceRef,
  ]);

  const cancelScheduledRender = useCallback(() => {
    cancelAnimationFrame(scheduledRenderRef.current);
    scheduledRenderRef.current = 0;
  }, []);

  const scheduleRenderActiveFrame = useCallback(() => {
    if (scheduledRenderRef.current) return;

    scheduledRenderRef.current = requestAnimationFrame(() => {
      scheduledRenderRef.current = 0;
      renderActiveFrame();
    });
  }, [renderActiveFrame]);

  const invalidate = useCallback(() => {
    const current = sourceRef.current;
    if (isAnimatedSourceKind(current.kind)) return;
    scheduleRenderActiveFrame();
  }, [scheduleRenderActiveFrame, sourceRef]);

  useEffect(() => {
    latestInvalidateRef.current = invalidate;
  }, [invalidate]);

  useEffect(() => {
    const pipeline = pipelineRef.current;
    if (!pipeline) return;

    syncPipeline(pipeline, config, invalidate);
    const current = sourceRef.current;
    const hasSource =
      current.ready || current.frames?.length || isAnimatedSourceKind(current.kind);

    if (hasSource && !isAnimatedSourceKind(current.kind)) {
      scheduleRenderActiveFrame();
    }
  }, [
    config,
    invalidate,
    pipelineRef,
    scheduleRenderActiveFrame,
    source,
    sourceRef,
    syncPipeline,
  ]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) resetGifClock(false);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [resetGifClock]);

  const resetForNewFile = useCallback(() => {
    cancelScheduledRender();
    stopGifLoop();
    stopLiveVideoLoop();
    cleanupVideoElement();
    clearSource();
  }, [
    cancelScheduledRender,
    cleanupVideoElement,
    clearSource,
    stopGifLoop,
    stopLiveVideoLoop,
  ]);

  const loadFile = useCallback(
    async (file) => {
      let url = null;

      try {
        await ensurePipeline();
        resetForNewFile();

        url = URL.createObjectURL(file);

        if (file.type === "image/gif") {
          return await loadGifFile(file, url);
        }

        if (file.type.startsWith("video/")) {
          return await loadVideoFile(url);
        }

        if (file.type.startsWith("image/")) {
          return await loadImageFile(url);
        }

        throw new Error(`Unsupported file type: ${file.type}`);
      } catch (err) {
        if (url && sourceRef.current.url !== url) {
          URL.revokeObjectURL(url);
        }

        const message = getErrorMessage(err);
        setMediaError(message);
        if (process.env.NODE_ENV !== "production") {
          console.warn("[useProcessMedia] loadFile failed", err);
        }
        return null;
      }
    },
    [
      ensurePipeline,
      loadGifFile,
      loadImageFile,
      loadVideoFile,
      resetForNewFile,
      setMediaError,
      sourceRef,
    ],
  );

  useCameraSource({
    cameraOn: camera?.cameraOn,
    videoRef: camera?.videoRef,
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
  });

  const { exportResult } = useMediaExport({
    canvasRef,
    ensurePipeline,
    prepareGifFrame,
    renderVideoFrame,
    restoreVideoPlayback,
    liveVideoRafRef,
    sourceRef,
    startLiveVideoLoop,
    stopLiveVideoLoop,
    videoRef: camera?.videoRef,
    waitForEnded,
  });

  useEffect(() => {
    cleanupRef.current = () => {
      cancelScheduledRender();
      stopGifLoop();
      stopLiveVideoLoop();
      cleanupVideoElement();

      const { url } = sourceRef.current;
      if (url) URL.revokeObjectURL(url);
      resetSourceRef();
    };
  }, [
    cancelScheduledRender,
    cleanupVideoElement,
    resetSourceRef,
    sourceRef,
    stopGifLoop,
    stopLiveVideoLoop,
  ]);

  return {
    loadFile,
    exportResult,
    frames: source.frames,
    mediaError,
    webgpuSupported,
  };
}
