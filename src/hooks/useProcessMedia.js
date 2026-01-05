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

export function useProcessMedia(canvasRef, config, camera) {
  const pipelineRef = useRef(null);

  const gifCanvas = useRef(document.createElement("canvas"));
  const gifCtx = useRef(gifCanvas.current.getContext("2d"));

  const [frames, setFrames] = useState(null);
  const frameIdx = useRef(0);

  const gifRafRef = useRef(0);
  const camRafRef = useRef(0);

  const lastSource = useRef(null);

  const lastTime = useRef(0);
  const acc = useRef(0);

  const passCacheRef = useRef(new Map());

  const cameraReadyRef = useRef(false);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const p = GLPipeline.for(canvas);
    pipelineRef.current = p;

    const passCache = passCacheRef.current;

    return () => {
      cancelAnimationFrame(gifRafRef.current);
      cancelAnimationFrame(camRafRef.current);

      for (const rec of passCache.values()) rec.pass?.destroy?.();
      passCache.clear();

      p.destroy();
      pipelineRef.current = null;
    };
  }, [canvasRef]);

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
      !!lastSource.current || !!frames || cameraReadyRef.current;

    if (hasSource) p.renderFrame();
  }, [config, invalidate, frames, camera?.cameraOn]);

  const loadFile = useCallback(
    async (file) => {
      cancelAnimationFrame(gifRafRef.current);

      cameraReadyRef.current = false;

      setFrames(null);
      frameIdx.current = 0;
      lastTime.current = performance.now();
      acc.current = 0;

      const url = URL.createObjectURL(file);

      if (file.type === "image/gif") {
        const { frames: decoded } = decodeGIF(await file.arrayBuffer());
        setFrames(decoded);
        prepare(decoded[0]);
      } else {
        const img = new Image();
        img.src = url;
        await new Promise((r) => (img.onload = r));
        lastSource.current = img;
        prepare(img);
      }

      return url;
    },
    [prepare],
  );

  useEffect(() => {
    if (!frames) return;
    if (camera?.cameraOn) return;

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
      cancelAnimationFrame(gifRafRef.current);
    };
  }, [frames, prepare, camera?.cameraOn]);

  const exportResult = useCallback(
    async (name) => {
      const live = pipelineRef.current;
      if (!live) return;

      const defs = config?.defs || {};
      const filters = Array.isArray(config?.filters) ? config.filters : [];
      const enabled = filters.filter((f) => f && f.enabled);

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
    [frames, canvasRef, config],
  );

  useEffect(() => {
    const p = pipelineRef.current;
    const video = camera?.videoRef?.current;
    if (!p || !video) return;

    if (!camera?.cameraOn) {
      cancelAnimationFrame(camRafRef.current);

      if (video.srcObject) {
        video.srcObject.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      }

      cameraReadyRef.current = false;

      setFrames(null);
      lastSource.current = null;
      frameIdx.current = 0;
      acc.current = 0;

      clearOutputAndInput();
      return;
    }

    cancelAnimationFrame(gifRafRef.current);

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

      video.srcObject = stream;
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

      const loop = () => {
        if (cancelled) return;
        p.updateVideoFrame(video);
        p.renderFrame();
        camRafRef.current = requestAnimationFrame(loop);
      };

      camRafRef.current = requestAnimationFrame(loop);
    })().catch(() => {
      cameraReadyRef.current = false;
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(camRafRef.current);
      cameraReadyRef.current = false;

      if (video.srcObject) {
        video.srcObject.getTracks().forEach((t) => t.stop());
        video.srcObject = null;
      }
    };
  }, [camera?.cameraOn, camera?.videoRef, clearOutputAndInput]);

  return { loadFile, exportResult, frames };
}
