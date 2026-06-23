import { useCallback, useEffect, useRef, useState } from "react";
import { WebGPUPipeline } from "../utils/WebGPU";
import { getErrorMessage } from "./mediaHelpers";
import { syncWebGPUPipelineForConfig } from "./webgpuPassSync";

const WEBGPU_UNSUPPORTED_MESSAGE = "WebGPU is not supported in this browser";

export function useWebGPUPipeline(canvasRef, config, invalidateRef, cleanupRef) {
  const pipelineRef = useRef(null);
  const passCacheRef = useRef(new Map());
  const pipelinePromiseRef = useRef(null);
  const pipelineCreateIdRef = useRef(0);
  const latestConfigRef = useRef(config);
  const [mediaError, setMediaError] = useState(null);

  const webgpuSupported = WebGPUPipeline.isSupported();

  useEffect(() => {
    latestConfigRef.current = config;
  }, [config]);

  const syncPipeline = useCallback(
    (
      pipeline = pipelineRef.current,
      nextConfig = latestConfigRef.current,
      invalidate = invalidateRef.current,
    ) => {
      if (!pipeline) return;
      syncWebGPUPipelineForConfig(
        pipeline,
        passCacheRef.current,
        nextConfig,
        invalidate,
      );
    },
    [invalidateRef],
  );

  const ensurePipeline = useCallback(async () => {
    if (pipelineRef.current) return pipelineRef.current;
    if (pipelinePromiseRef.current) {
      const pendingPipeline = await pipelinePromiseRef.current;
      if (pendingPipeline && pipelineRef.current) return pendingPipeline;
      pipelinePromiseRef.current = null;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      throw new Error("WebGPU canvas is not mounted");
    }
    if (!WebGPUPipeline.isSupported()) {
      throw new Error(WEBGPU_UNSUPPORTED_MESSAGE);
    }

    const createId = pipelineCreateIdRef.current + 1;
    pipelineCreateIdRef.current = createId;
    const promise = WebGPUPipeline.create(canvas)
      .then((pipeline) => {
        if (pipelineCreateIdRef.current !== createId) {
          pipeline.destroy();
          return pipelineRef.current;
        }

        setMediaError(null);
        pipelineRef.current = pipeline;
        syncPipeline(pipeline);
        return pipeline;
      })
      .catch((err) => {
        if (pipelinePromiseRef.current === promise) {
          pipelinePromiseRef.current = null;
        }
        setMediaError(getErrorMessage(err));
        throw err;
      });

    pipelinePromiseRef.current = promise;
    return promise;
  }, [canvasRef, syncPipeline]);

  useEffect(() => {
    let cancelled = false;
    const passCache = passCacheRef.current;
    const cleanupMedia = () => cleanupRef.current?.();

    ensurePipeline()
      .then((pipeline) => {
        if (cancelled && pipelineRef.current === pipeline) {
          pipelineRef.current = null;
          pipeline.passes = [];
          pipeline.destroy();
          return;
        }
        syncPipeline(pipeline);
      })
      .catch((err) => {
        setMediaError(getErrorMessage(err));
        if (!cancelled && process.env.NODE_ENV !== "production") {
          console.warn("[useProcessMedia] WebGPU initialization failed", err);
        }
      });

    return () => {
      cancelled = true;
      cleanupMedia();

      pipelineCreateIdRef.current += 1;
      for (const rec of passCache.values()) rec.pass?.destroy?.();
      passCache.clear();
      const pipeline = pipelineRef.current;
      if (pipeline) {
        pipeline.passes = [];
        pipeline.destroy();
        pipelineRef.current = null;
      }
      pipelinePromiseRef.current = null;
    };
  }, [cleanupRef, ensurePipeline, syncPipeline]);

  return {
    pipelineRef,
    ensurePipeline,
    syncPipeline,
    mediaError,
    setMediaError,
    webgpuSupported,
  };
}
