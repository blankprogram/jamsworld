import { useCallback } from "react";
import { loadImageFromUrl } from "./mediaHelpers";

export function useImageSource({
  ensurePipeline,
  setMediaError,
  setSource,
  syncPipeline,
}) {
  const loadImageFile = useCallback(
    async (url) => {
      const pipeline = await ensurePipeline();
      const image = await loadImageFromUrl(url);

      setSource({
        kind: "image",
        source: image,
        url,
        frames: null,
        ready: true,
      });
      syncPipeline(pipeline);
      pipeline.prepareImage(image);
      pipeline.renderFrame();
      setMediaError(null);
      return url;
    },
    [ensurePipeline, setMediaError, setSource, syncPipeline],
  );

  return { loadImageFile };
}
