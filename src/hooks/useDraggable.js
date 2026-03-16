import { useRef } from "react";

const getViewport = () => {
  if (typeof window === "undefined") return { width: 1440, height: 900 };
  return {
    width: window.innerWidth || 1440,
    height: window.innerHeight || 900,
  };
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const useResizableAndDraggable = ({
  rect,
  minWidth = 600,
  minHeight = 200,
  resizable = true,
  maximized = false,
  onRectChange,
} = {}) => {
  const windowRef = useRef(null);

  const addEventListeners = (moveHandler, stopHandler) => {
    window.addEventListener("mousemove", moveHandler);
    window.addEventListener("mouseup", stopHandler);
  };

  const removeEventListeners = (moveHandler, stopHandler) => {
    window.removeEventListener("mousemove", moveHandler);
    window.removeEventListener("mouseup", stopHandler);
  };

  const disableIframePointerEvents = () => {
    if (!windowRef.current) return () => {};
    const iframe = windowRef.current.querySelector("iframe");
    if (!iframe) return () => {};
    const previousPointerEvents = iframe.style.pointerEvents;
    iframe.style.pointerEvents = "none";
    return () => {
      iframe.style.pointerEvents = previousPointerEvents;
    };
  };

  const startDrag = (e) => {
    e.preventDefault();
    if (!rect || maximized) return;

    const restorePointerEvents = disableIframePointerEvents();
    const startX = e.clientX;
    const startY = e.clientY;
    const startRect = { ...rect };

    const handleDrag = (event) => {
      const viewport = getViewport();
      const nextX = clamp(
        startRect.x + event.clientX - startX,
        0,
        Math.max(0, viewport.width - startRect.width),
      );
      const nextY = clamp(
        startRect.y + event.clientY - startY,
        0,
        Math.max(0, viewport.height - startRect.height),
      );
      onRectChange?.({ ...startRect, x: nextX, y: nextY });
    };

    const stopDrag = () => {
      removeEventListeners(handleDrag, stopDrag);
      restorePointerEvents();
    };

    addEventListeners(handleDrag, stopDrag);
  };

  const startResize = (e, direction) => {
    e.preventDefault();
    if (!rect || !resizable || maximized) return;

    const restorePointerEvents = disableIframePointerEvents();
    const startX = e.clientX;
    const startY = e.clientY;
    const startRect = { ...rect };

    const updateSizeAndPosition = (event) => {
      const viewport = getViewport();
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      const maxHeight = viewport.height;

      let next = {
        x: startRect.x,
        y: startRect.y,
        width: startRect.width,
        height: startRect.height,
      };

      if (direction.includes("right")) {
        next.width = clamp(
          startRect.width + deltaX,
          minWidth,
          Math.max(minWidth, viewport.width - startRect.x),
        );
      }

      if (direction.includes("left")) {
        const nextX = clamp(
          startRect.x + deltaX,
          0,
          startRect.x + startRect.width - minWidth,
        );
        next.x = nextX;
        next.width = startRect.width - (nextX - startRect.x);
      }

      if (direction.includes("bottom")) {
        next.height = clamp(
          startRect.height + deltaY,
          minHeight,
          Math.max(minHeight, maxHeight - startRect.y),
        );
      }

      if (direction.includes("top")) {
        const nextY = clamp(
          startRect.y + deltaY,
          0,
          startRect.y + startRect.height - minHeight,
        );
        next.y = nextY;
        next.height = startRect.height - (nextY - startRect.y);
      }

      next.x = clamp(next.x, 0, Math.max(0, viewport.width - next.width));
      next.y = clamp(next.y, 0, Math.max(0, maxHeight - next.height));

      onRectChange?.(next);
    };

    const stopResize = () => {
      removeEventListeners(updateSizeAndPosition, stopResize);
      restorePointerEvents();
    };

    addEventListeners(updateSizeAndPosition, stopResize);
  };

  return {
    windowRef,
    startDrag,
    startResize,
  };
};
