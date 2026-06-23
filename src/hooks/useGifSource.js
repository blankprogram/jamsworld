import { useCallback, useEffect, useRef } from "react";
import { decodeGIF } from "../utils/gifUtils";

export function useGifSource({
  cameraOn,
  ensurePipeline,
  pipelineRef,
  source,
  setSource,
  sourceRef,
  syncPipeline,
}) {
  const gifCanvas = useRef(document.createElement("canvas"));
  const gifCtx = useRef(gifCanvas.current.getContext("2d"));
  const frameIdx = useRef(0);
  const gifRafRef = useRef(0);
  const lastTime = useRef(0);
  const acc = useRef(0);

  const stopGifLoop = useCallback(() => {
    cancelAnimationFrame(gifRafRef.current);
    gifRafRef.current = 0;
  }, []);

  const resetGifClock = useCallback((resetFrame = true) => {
    if (resetFrame) frameIdx.current = 0;
    lastTime.current = performance.now();
    acc.current = 0;
  }, []);

  const drawImageDataToGifCanvas = useCallback((imgData) => {
    if (!imgData) return null;
    gifCanvas.current.width = imgData.width;
    gifCanvas.current.height = imgData.height;
    gifCtx.current.putImageData(imgData, 0, 0);
    return gifCanvas.current;
  }, []);

  const prepareGifFrame = useCallback(
    (pipeline, frame) => {
      const canvas = drawImageDataToGifCanvas(frame?.imgData);
      if (!canvas) return false;
      return pipeline.prepareImage(canvas);
    },
    [drawImageDataToGifCanvas],
  );

  const renderGifFrame = useCallback(
    (pipeline, frame) => {
      if (!prepareGifFrame(pipeline, frame)) return false;
      pipeline.renderFrame();
      return true;
    },
    [prepareGifFrame],
  );

  const loadGifFile = useCallback(
    async (file, url) => {
      const pipeline = await ensurePipeline();
      syncPipeline(pipeline);

      const { frames } = decodeGIF(await file.arrayBuffer());
      const firstFrame = frames[0] || null;
      setSource({
        kind: "gif",
        source: firstFrame,
        url,
        frames,
        ready: !!firstFrame,
      });
      resetGifClock();
      if (firstFrame) renderGifFrame(pipeline, firstFrame);
      return url;
    },
    [ensurePipeline, renderGifFrame, resetGifClock, setSource, syncPipeline],
  );

  useEffect(() => {
    const frames = sourceRef.current.frames;
    if (!frames?.length) return undefined;
    if (cameraOn) return undefined;
    if (sourceRef.current.kind !== "gif") return undefined;

    resetGifClock(false);

    let cancelled = false;

    const loop = (now) => {
      if (cancelled) return;

      let dt = now - lastTime.current;
      lastTime.current = now;

      const delay = (frames[frameIdx.current].frameInfo.delay || 1) * 10;
      if (dt > delay) dt = delay;
      acc.current += dt;

      if (acc.current >= delay) {
        acc.current -= delay;
        frameIdx.current = (frameIdx.current + 1) % frames.length;
      }

      const pipeline = pipelineRef.current;
      if (pipeline) renderGifFrame(pipeline, frames[frameIdx.current]);
      gifRafRef.current = requestAnimationFrame(loop);
    };

    gifRafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      stopGifLoop();
    };
  }, [
    cameraOn,
    pipelineRef,
    renderGifFrame,
    resetGifClock,
    source,
    sourceRef,
    stopGifLoop,
  ]);

  return {
    frameIdx,
    stopGifLoop,
    resetGifClock,
    prepareGifFrame,
    renderGifFrame,
    loadGifFile,
  };
}
