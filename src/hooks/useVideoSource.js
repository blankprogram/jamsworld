import { useCallback, useRef } from "react";
import {
  waitForEvent,
  waitForVideoMetadata,
  waitUntilVideoPrepared,
} from "./mediaHelpers";

export function useVideoSource({
  videoRef,
  pipelineRef,
  ensurePipeline,
  syncPipeline,
  setSource,
  setMediaError,
}) {
  const liveVideoRafRef = useRef(0);

  const stopLiveVideoLoop = useCallback(() => {
    cancelAnimationFrame(liveVideoRafRef.current);
    liveVideoRafRef.current = 0;
  }, []);

  const cleanupVideoElement = useCallback(() => {
    const video = videoRef?.current;
    if (!video) return;

    stopLiveVideoLoop();

    try {
      video.pause();
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[useProcessMedia] video.pause() failed during cleanup", err);
      }
    }

    if (video.srcObject) {
      video.srcObject.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }

    if (video.src) {
      video.removeAttribute("src");
      video.load();
    }
  }, [stopLiveVideoLoop, videoRef]);

  const renderVideoFrame = useCallback(
    (video = videoRef?.current) => {
      const pipeline = pipelineRef.current;
      if (!pipeline || !video) return false;
      if (!pipeline.updateVideoFrame(video)) return false;
      pipeline.renderFrame();
      return true;
    },
    [pipelineRef, videoRef],
  );

  const startLiveVideoLoop = useCallback(() => {
    const video = videoRef?.current;
    if (!pipelineRef.current || !video) return;

    stopLiveVideoLoop();

    const loop = () => {
      if (!pipelineRef.current || !videoRef?.current) return;
      renderVideoFrame(videoRef.current);
      liveVideoRafRef.current = requestAnimationFrame(loop);
    };

    liveVideoRafRef.current = requestAnimationFrame(loop);
  }, [pipelineRef, renderVideoFrame, stopLiveVideoLoop, videoRef]);

  const loadVideoFile = useCallback(
    async (url) => {
      const pipeline = await ensurePipeline();
      const video = videoRef?.current;
      if (!video) {
        URL.revokeObjectURL(url);
        throw new Error("Video element not available");
      }

      video.srcObject = null;
      video.src = url;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.currentTime = 0;

      await waitForVideoMetadata(video);
      await video.play();
      await waitUntilVideoPrepared(pipeline, video);

      setSource({
        kind: "video",
        source: video,
        url,
        frames: null,
        ready: true,
      });
      syncPipeline(pipeline);
      renderVideoFrame(video);
      startLiveVideoLoop();
      setMediaError(null);
      return url;
    },
    [
      ensurePipeline,
      renderVideoFrame,
      setMediaError,
      setSource,
      startLiveVideoLoop,
      syncPipeline,
      videoRef,
    ],
  );

  const waitForEnded = useCallback((video) => {
    return new Promise((resolve) => {
      const onEnded = () => {
        video.removeEventListener("ended", onEnded);
        resolve();
      };
      video.addEventListener("ended", onEnded);
    });
  }, []);

  const restoreVideoPlayback = useCallback(
    async (video, { wasLooping, wasPaused, prevTime }) => {
      video.loop = wasLooping;
      video.currentTime = prevTime;
      await waitForEvent(video, "seeked").catch(() => {});
      if (!wasPaused) await video.play().catch(() => {});
    },
    [],
  );

  return {
    liveVideoRafRef,
    stopLiveVideoLoop,
    cleanupVideoElement,
    renderVideoFrame,
    startLiveVideoLoop,
    loadVideoFile,
    waitForEnded,
    restoreVideoPlayback,
  };
}
