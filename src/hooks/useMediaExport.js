import { useCallback } from "react";
import { encodeGIF } from "../utils/gifUtils";
import {
  downloadBlob,
  downloadUrl,
  getSupportedVideoMimeType,
  isLiveSourceKind,
  waitForEvent,
} from "./mediaHelpers";

export function useMediaExport({
  canvasRef,
  ensurePipeline,
  prepareGifFrame,
  renderVideoFrame,
  restoreVideoPlayback,
  liveVideoRafRef,
  sourceRef,
  startLiveVideoLoop,
  stopLiveVideoLoop,
  videoRef,
  waitForEnded,
}) {
  const exportVideo = useCallback(
    async (name) => {
      await ensurePipeline();
      const canvas = canvasRef.current;
      const video = videoRef?.current;

      if (!canvas || !video) return;

      const mimeType = getSupportedVideoMimeType();
      if (!mimeType) {
        throw new Error("No supported video export mime type found");
      }

      const playbackState = {
        wasLooping: video.loop,
        wasPaused: video.paused,
        prevTime: video.currentTime,
      };

      stopLiveVideoLoop();

      video.pause();
      video.loop = false;
      video.currentTime = 0;

      await waitForEvent(video, "seeked").catch(() => {});

      renderVideoFrame(video);

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];

      const stopped = new Promise((resolve, reject) => {
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = (event) => reject(event.error || event);
        recorder.onstop = () =>
          resolve(new Blob(chunks, { type: recorder.mimeType }));
      });

      let done = false;
      const renderLoop = () => {
        if (done) return;
        renderVideoFrame(video);
        liveVideoRafRef.current = requestAnimationFrame(renderLoop);
      };

      recorder.start();
      liveVideoRafRef.current = requestAnimationFrame(renderLoop);

      await video.play();
      await waitForEnded(video);

      done = true;
      stopLiveVideoLoop();
      recorder.stop();

      const blob = await stopped;
      downloadBlob(blob, `${name}.webm`);

      await restoreVideoPlayback(video, playbackState);

      if (isLiveSourceKind(sourceRef.current.kind)) {
        startLiveVideoLoop();
      }
    },
    [
      canvasRef,
      ensurePipeline,
      renderVideoFrame,
      restoreVideoPlayback,
      liveVideoRafRef,
      sourceRef,
      startLiveVideoLoop,
      stopLiveVideoLoop,
      videoRef,
      waitForEnded,
    ],
  );

  const exportResult = useCallback(
    async (name) => {
      const pipeline = await ensurePipeline();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const source = sourceRef.current;
      if (isLiveSourceKind(source.kind)) {
        await exportVideo(name);
        return;
      }

      if (!source.frames?.length) {
        canvas.toBlob((blob) => {
          if (!blob) return;
          downloadBlob(blob, `${name}.png`);
        });
        return;
      }

      const out = [];
      for (const { imgData, frameInfo } of source.frames) {
        prepareGifFrame(pipeline, { imgData });
        const nextImgData = await pipeline.renderFrameToImageData();
        out.push({ imgData: nextImgData, frameInfo });
      }

      const width = out[0]?.imgData?.width || pipeline.canvas.width;
      const height = out[0]?.imgData?.height || pipeline.canvas.height;
      const blobUrl = await encodeGIF(out, width, height);
      downloadUrl(blobUrl, `${name}.gif`);
    },
    [canvasRef, ensurePipeline, exportVideo, prepareGifFrame, sourceRef],
  );

  return { exportResult, exportVideo };
}
