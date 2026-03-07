import { useRef, useState, useEffect, useCallback } from "react";
import GLPipeline from "../utils/GL/GLPipeline";
import { decodeGIF, encodeGIF } from "../utils/gifUtils";

function readImageDataFromWebGL(gl, width, height) {
  const pixels = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  const flipped = new Uint8ClampedArray(width * height * 4);
  const rowSize = width * 4;
  for (let row = 0; row < height; row++) {
    flipped.set(
      pixels.subarray(row * rowSize, (row + 1) * rowSize),
      (height - 1 - row) * rowSize,
    );
  }
  return new ImageData(flipped, width, height);
}

const isPlainObject = (v) =>
  v != null && typeof v === "object" && v.constructor === Object;

function deepEqual(a, b) {
  if (a === b) return true;
  if (Number.isNaN(a) && Number.isNaN(b)) return true;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }

  if (isPlainObject(a) && isPlainObject(b)) {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (const k of ak) if (!deepEqual(a[k], b[k])) return false;
    return true;
  }

  return false;
}

function diffKeys(prev = {}, next = {}) {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const changed = [];
  for (const k of keys) {
    if (!deepEqual(prev[k], next[k])) changed.push(k);
  }
  return changed;
}

function waitForEvent(target, eventName) {
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

function getSupportedVideoMimeType() {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || null;
}

export function useProcessMedia(canvasRef, config, camera) {
  const pipelineRef = useRef(null);

  const gifCanvas = useRef(document.createElement("canvas"));
  const gifCtx = useRef(gifCanvas.current.getContext("2d"));

  const [frames, setFrames] = useState(null);
  const frameIdx = useRef(0);

  const gifRafRef = useRef(0);
  const liveVideoRafRef = useRef(0);

  const lastSource = useRef(null);
  const sourceKindRef = useRef(null); // "image" | "gif" | "video" | "camera" | null
  const uploadedVideoUrlRef = useRef(null);

  const lastTime = useRef(0);
  const acc = useRef(0);

  const passCacheRef = useRef(new Map());

  const cameraReadyRef = useRef(false);

  const stopGifLoop = useCallback(() => {
    cancelAnimationFrame(gifRafRef.current);
    gifRafRef.current = 0;
  }, []);

  const stopLiveVideoLoop = useCallback(() => {
    cancelAnimationFrame(liveVideoRafRef.current);
    liveVideoRafRef.current = 0;
  }, []);

  const cleanupVideoElement = useCallback(() => {
    const video = camera?.videoRef?.current;
    if (!video) return;

    stopLiveVideoLoop();

    try {
      video.pause();
    } catch {}

    if (video.srcObject) {
      video.srcObject.getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }

    if (video.src) {
      video.removeAttribute("src");
      video.load();
    }
  }, [camera?.videoRef, stopLiveVideoLoop]);

  const revokeUploadedVideoUrl = useCallback(() => {
    if (uploadedVideoUrlRef.current) {
      URL.revokeObjectURL(uploadedVideoUrlRef.current);
      uploadedVideoUrlRef.current = null;
    }
  }, []);

  const clearOutputAndInput = useCallback(() => {
    const p = pipelineRef.current;
    if (!p) return;

    cameraReadyRef.current = false;
    p.clearInputTexture();
    lastSource.current = null;
    p.clearToTransparent();
  }, []);

  const invalidate = useCallback(() => {
    const p = pipelineRef.current;
    if (!p) return;
    p.renderFrame();
  }, []);

  const prepare = useCallback((src) => {
    const p = pipelineRef.current;
    if (!p) return;

    if (src?.imgData) {
      gifCanvas.current.width = src.imgData.width;
      gifCanvas.current.height = src.imgData.height;
      gifCtx.current.putImageData(src.imgData, 0, 0);
      p.prepareImage(gifCanvas.current);
    } else {
      lastSource.current = src;
      p.prepareImage(src);
    }

    p.renderFrame();
  }, []);

  const startLiveVideoLoop = useCallback(() => {
    const p = pipelineRef.current;
    const video = camera?.videoRef?.current;
    if (!p || !video) return;

    stopLiveVideoLoop();

    const loop = () => {
      if (!pipelineRef.current || !camera?.videoRef?.current) return;
      pipelineRef.current.updateVideoFrame(camera.videoRef.current);
      pipelineRef.current.renderFrame();
      liveVideoRafRef.current = requestAnimationFrame(loop);
    };

    liveVideoRafRef.current = requestAnimationFrame(loop);
  }, [camera?.videoRef, stopLiveVideoLoop]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const p = GLPipeline.for(canvas);
    pipelineRef.current = p;

    const passCache = passCacheRef.current;

    return () => {
      stopGifLoop();
      stopLiveVideoLoop();

      cleanupVideoElement();
      revokeUploadedVideoUrl();

      for (const rec of passCache.values()) rec.pass?.destroy?.();
      passCache.clear();

      p.destroy();
      pipelineRef.current = null;
    };
  }, [
    canvasRef,
    cleanupVideoElement,
    revokeUploadedVideoUrl,
    stopGifLoop,
    stopLiveVideoLoop,
  ]);

  useEffect(() => {
    const onVis = () => {
      if (!document.hidden) {
        lastTime.current = performance.now();
        acc.current = 0;
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    const p = pipelineRef.current;
    if (!p) return;

    const defs = config?.defs || {};
    const filters = Array.isArray(config?.filters) ? config.filters : [];

    const aliveIds = new Set(filters.map((f) => f?.id).filter(Boolean));
    for (const [id, rec] of passCacheRef.current.entries()) {
      if (!aliveIds.has(id)) {
        rec.pass?.destroy?.();
        passCacheRef.current.delete(id);
      }
    }

    const enabled = filters.filter((f) => f && f.enabled);
    const nextPassChain = [];

    for (const f of enabled) {
      const def = defs[f.type];
      if (!def || !def.Pass) continue;

      const prevRec = passCacheRef.current.get(f.id) || {
        type: f.type,
        pass: null,
        optsSnapshot: null,
      };

      const prevOpts = prevRec.optsSnapshot || {};
      const nextOpts = f.opts || {};
      const changed = diffKeys(prevOpts, nextOpts);

      const structuralKeys = Array.isArray(def.structuralKeys)
        ? def.structuralKeys
        : [];

      const typeChanged = prevRec.type !== f.type;
      const needsRebuild =
        !prevRec.pass ||
        typeChanged ||
        changed.some((k) => structuralKeys.includes(k));

      if (needsRebuild) {
        prevRec.pass?.destroy?.();
        const pass = new def.Pass(p.gl, { ...nextOpts, invalidate });
        passCacheRef.current.set(f.id, {
          type: f.type,
          pass,
          optsSnapshot: nextOpts,
        });
        nextPassChain.push(pass);
        continue;
      }

      if (prevRec.pass && changed.length) {
        for (const k of changed) {
          try {
            prevRec.pass.setOption?.(k, nextOpts[k]);
          } catch {}
        }
        passCacheRef.current.set(f.id, { ...prevRec, optsSnapshot: nextOpts });
      }

      nextPassChain.push(passCacheRef.current.get(f.id).pass);
    }

    p.passes = nextPassChain;

    const hasSource =
      !!lastSource.current ||
      !!frames ||
      cameraReadyRef.current ||
      sourceKindRef.current === "video";

    if (hasSource) p.renderFrame();
  }, [config, invalidate, frames, camera?.cameraOn]);

  const loadFile = useCallback(
    async (file) => {
      const p = pipelineRef.current;
      const video = camera?.videoRef?.current;
      if (!p) return null;

      stopGifLoop();
      stopLiveVideoLoop();

      cameraReadyRef.current = false;

      setFrames(null);
      frameIdx.current = 0;
      lastTime.current = performance.now();
      acc.current = 0;

      clearOutputAndInput();
      cleanupVideoElement();
      revokeUploadedVideoUrl();

      const url = URL.createObjectURL(file);

      if (file.type === "image/gif") {
        sourceKindRef.current = "gif";

        const { frames: decoded } = decodeGIF(await file.arrayBuffer());
        setFrames(decoded);
        prepare(decoded[0]);
        return url;
      }

      if (file.type.startsWith("video/")) {
        if (!video) {
          URL.revokeObjectURL(url);
          throw new Error("Video element not available");
        }

        sourceKindRef.current = "video";
        uploadedVideoUrlRef.current = url;

        video.srcObject = null;
        video.src = url;
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.currentTime = 0;

        await waitForEvent(video, "loadedmetadata");
        await video.play();

        if (!p.prepareVideo(video)) {
          const wait = () =>
            new Promise((r) => requestAnimationFrame(() => r()));
          while (!p.prepareVideo(video)) {
            await wait();
          }
        }

        p.updateVideoFrame(video);
        p.renderFrame();

        startLiveVideoLoop();
        return url;
      }

      if (file.type.startsWith("image/")) {
        sourceKindRef.current = "image";

        const img = new Image();
        img.src = url;
        await new Promise((r, reject) => {
          img.onload = r;
          img.onerror = reject;
        });

        lastSource.current = img;
        prepare(img);
        return url;
      }

      URL.revokeObjectURL(url);
      throw new Error(`Unsupported file type: ${file.type}`);
    },
    [
      camera?.videoRef,
      cleanupVideoElement,
      clearOutputAndInput,
      prepare,
      revokeUploadedVideoUrl,
      startLiveVideoLoop,
      stopGifLoop,
      stopLiveVideoLoop,
    ],
  );

  useEffect(() => {
    if (!frames) return;
    if (camera?.cameraOn) return;
    if (sourceKindRef.current !== "gif") return;

    lastTime.current = performance.now();
    acc.current = 0;

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

      prepare(frames[frameIdx.current]);
      gifRafRef.current = requestAnimationFrame(loop);
    };

    gifRafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      stopGifLoop();
    };
  }, [frames, prepare, camera?.cameraOn, stopGifLoop]);

  const exportVideo = useCallback(
    async (name) => {
      const p = pipelineRef.current;
      const canvas = canvasRef.current;
      const video = camera?.videoRef?.current;

      if (!p || !canvas || !video) return;

      const mimeType = getSupportedVideoMimeType();
      if (!mimeType) {
        throw new Error("No supported video export mime type found");
      }

      const wasLooping = video.loop;
      const wasPaused = video.paused;
      const prevTime = video.currentTime;

      stopLiveVideoLoop();

      video.pause();
      video.loop = false;
      video.currentTime = 0;

      await waitForEvent(video, "seeked").catch(() => {});

      p.updateVideoFrame(video);
      p.renderFrame();

      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks = [];

      const stopped = new Promise((resolve, reject) => {
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        recorder.onerror = (e) => reject(e.error || e);
        recorder.onstop = () =>
          resolve(new Blob(chunks, { type: recorder.mimeType }));
      });

      let done = false;
      const renderLoop = () => {
        if (done) return;
        p.updateVideoFrame(video);
        p.renderFrame();
        liveVideoRafRef.current = requestAnimationFrame(renderLoop);
      };

      recorder.start();
      liveVideoRafRef.current = requestAnimationFrame(renderLoop);

      await video.play();

      await new Promise((resolve) => {
        const onEnded = () => {
          video.removeEventListener("ended", onEnded);
          resolve();
        };
        video.addEventListener("ended", onEnded);
      });

      done = true;
      stopLiveVideoLoop();

      recorder.stop();

      const blob = await stopped;
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.webm`;
      a.click();

      setTimeout(() => URL.revokeObjectURL(url), 1000);

      video.loop = wasLooping;
      video.currentTime = prevTime;

      await waitForEvent(video, "seeked").catch(() => {});

      if (!wasPaused) {
        await video.play().catch(() => {});
      }

      if (
        sourceKindRef.current === "video" ||
        sourceKindRef.current === "camera"
      ) {
        startLiveVideoLoop();
      }
    },
    [camera?.videoRef, canvasRef, startLiveVideoLoop, stopLiveVideoLoop],
  );

  const exportResult = useCallback(
    async (name) => {
      const live = pipelineRef.current;
      if (!live) return;

      const defs = config?.defs || {};
      const filters = Array.isArray(config?.filters) ? config.filters : [];
      const enabled = filters.filter((f) => f && f.enabled);

      if (
        sourceKindRef.current === "video" ||
        sourceKindRef.current === "camera"
      ) {
        await exportVideo(name);
        return;
      }

      if (!frames) {
        const can = canvasRef.current;
        if (!can) return;

        can.toBlob((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${name}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        });
        return;
      }

      const { width: w, height: h } = live.canvas;
      const off = document.createElement("canvas");
      off.width = w;
      off.height = h;

      const exp = GLPipeline.for(off);

      exp.passes = enabled
        .map((f) => {
          const def = defs[f.type];
          if (!def?.Pass) return null;
          return new def.Pass(exp.gl, { ...f.opts, invalidate: () => {} });
        })
        .filter(Boolean);

      const out = frames.map(({ imgData, frameInfo }) => {
        gifCanvas.current.width = imgData.width;
        gifCanvas.current.height = imgData.height;
        gifCtx.current.putImageData(imgData, 0, 0);

        exp.prepareImage(gifCanvas.current);
        const st = exp.renderFrame();

        return {
          imgData: readImageDataFromWebGL(exp.gl, st.width, st.height),
          frameInfo,
        };
      });

      exp.destroy();

      const blobUrl = await encodeGIF(out, w, h);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${name}.gif`;
      a.click();
    },
    [frames, canvasRef, config, exportVideo],
  );

  useEffect(() => {
    const p = pipelineRef.current;
    const video = camera?.videoRef?.current;
    if (!p || !video) return;

    if (!camera?.cameraOn) {
      if (sourceKindRef.current === "camera") {
        cleanupVideoElement();
        cameraReadyRef.current = false;
        clearOutputAndInput();
        sourceKindRef.current = null;
      }
      return;
    }

    stopGifLoop();
    stopLiveVideoLoop();
    setFrames(null);
    frameIdx.current = 0;
    acc.current = 0;
    lastSource.current = null;

    let cancelled = false;

    (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      cleanupVideoElement();
      revokeUploadedVideoUrl();

      sourceKindRef.current = "camera";

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      await video.play();

      if (!p.prepareVideo(video)) {
        const wait = () => new Promise((r) => requestAnimationFrame(() => r()));
        while (!cancelled && !p.prepareVideo(video)) {
          await wait();
        }
      }

      p.updateVideoFrame(video);
      p.renderFrame();
      cameraReadyRef.current = true;

      startLiveVideoLoop();
    })().catch(() => {
      cameraReadyRef.current = false;
    });

    return () => {
      cancelled = true;
      if (sourceKindRef.current === "camera") {
        cleanupVideoElement();
        cameraReadyRef.current = false;
      }
    };
  }, [
    camera?.cameraOn,
    camera?.videoRef,
    cleanupVideoElement,
    clearOutputAndInput,
    revokeUploadedVideoUrl,
    startLiveVideoLoop,
    stopGifLoop,
    stopLiveVideoLoop,
  ]);

  return { loadFile, exportResult, frames };
}
