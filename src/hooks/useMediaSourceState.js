import { useCallback, useRef, useState } from "react";

const createEmptySource = () => ({
  kind: "none",
  source: null,
  url: null,
  frames: null,
  ready: false,
});

export function useMediaSourceState(pipelineRef) {
  const sourceRef = useRef(createEmptySource());
  const [source, setSourceState] = useState(() => sourceRef.current);

  const setSource = useCallback((nextSource) => {
    const resolved =
      typeof nextSource === "function"
        ? nextSource(sourceRef.current)
        : nextSource;

    const normalized = { ...createEmptySource(), ...resolved };
    sourceRef.current = normalized;
    setSourceState(normalized);
  }, []);

  const clearSource = useCallback(
    (onlyKind) => {
      const current = sourceRef.current;
      if (onlyKind && current.kind !== onlyKind) return false;

      if (current.url) URL.revokeObjectURL(current.url);
      const next = createEmptySource();
      sourceRef.current = next;
      setSourceState(next);
      pipelineRef.current?.clearInputTexture();
      return true;
    },
    [pipelineRef],
  );

  const revokeObjectUrl = useCallback(() => {
    const { url } = sourceRef.current;
    if (!url) return;

    URL.revokeObjectURL(url);
    setSource((current) => ({ ...current, url: null }));
  }, [setSource]);

  const resetSourceRef = useCallback(() => {
    sourceRef.current = createEmptySource();
  }, []);

  return {
    source,
    sourceRef,
    setSource,
    clearSource,
    revokeObjectUrl,
    resetSourceRef,
  };
}
