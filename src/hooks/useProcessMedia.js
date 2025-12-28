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

export function useProcessMedia(canvasRef, makePasses, opts) {
  const pipelineRef = useRef(null);
  const gifCanvas = useRef(document.createElement("canvas"));
  const gifCtx = useRef(gifCanvas.current.getContext("2d"));
  const [frames, setFrames] = useState(null);
  const frameIdx = useRef(0);
  const animRef = useRef(0);
  const lastSource = useRef(null);
  const lastTime = useRef(0);
  const acc = useRef(0);

  const invalidate = useCallback(() => {
  const p = pipelineRef.current;
  if (!p) return;
  p.renderFrame();
  }, []);

  const prepare = useCallback((src) => {
    const p = pipelineRef.current;
    if (!p) return;

    if (src.imgData) {
      gifCanvas.current.width = src.imgData.width;
      gifCanvas.current.height = src.imgData.height;
      gifCtx.current.putImageData(src.imgData, 0, 0);
      p.prepareImage(gifCanvas.current, true);
    } else {
      lastSource.current = src;
      p.prepareImage(src, true);
    }

    p.renderFrame();
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    pipelineRef.current = GLPipeline.for(canvasRef.current);
    return () => {
      cancelAnimationFrame(animRef.current);
      pipelineRef.current.destroy();
    };
  }, [canvasRef]);

  useEffect(() => {
  const p = pipelineRef.current;
  if (!p) return;
  p.clearPasses();
  makePasses(p.gl, { ...opts, invalidate }).forEach((pass) => p.use(pass));

  if (!frames && lastSource.current) {
      prepare(lastSource.current);
  }
  }, [makePasses, opts, frames, prepare, invalidate]);

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

  const loadFile = useCallback(
    async (file) => {
      cancelAnimationFrame(animRef.current);
      setFrames(null);
      lastTime.current = performance.now();
      acc.current = 0;
      frameIdx.current = 0;

      const url = URL.createObjectURL(file);
      if (file.type === "image/gif") {
        const { frames: decoded } = decodeGIF(await file.arrayBuffer());
        setFrames(decoded);
        prepare(decoded[0]);
      } else {
        const img = new Image();
        img.src = url;
        await new Promise((r) => (img.onload = r));
        prepare(img);
      }
      return url;
    },
    [prepare],
  );

  useEffect(() => {
    if (!frames) return;
    lastTime.current = performance.now();
    acc.current = 0;
    let cancelled = false;

    const loop = (now) => {
      if (cancelled) return;

      let dt = now - lastTime.current;
      lastTime.current = now;
      const delay = frames[frameIdx.current].frameInfo.delay * 10;
      if (dt > delay) dt = delay;
      acc.current += dt;

      if (acc.current >= delay) {
        acc.current -= delay;
        frameIdx.current = (frameIdx.current + 1) % frames.length;
      }

      prepare(frames[frameIdx.current]);
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(animRef.current);
    };
  }, [frames, prepare]);

  const exportResult = useCallback(
    async (name) => {
      const live = pipelineRef.current;
      if (!live) return;

      if (!frames) {
        const can = canvasRef.current;
        if (!can) return;
        can.toBlob((blob) => {
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
      exp.clearPasses();
      makePasses(exp.gl, { ...opts, invalidate: () => {} }).forEach((pass) => exp.use(pass));

      const out = frames.map(({ imgData, frameInfo }) => {
        gifCanvas.current.width = imgData.width;
        gifCanvas.current.height = imgData.height;
        gifCtx.current.putImageData(imgData, 0, 0);
        exp.prepareImage(gifCanvas.current, true);
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
    [frames, makePasses, opts, canvasRef],
  );

  return { loadFile, exportResult, frames };
}
