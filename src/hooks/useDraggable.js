import { useRef } from "react";
import { clampValue, getDesktopBounds } from "../desktop/windowGeometry";

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
      const bounds = getDesktopBounds();
      const nextX = clampValue(
        startRect.x + event.clientX - startX,
        bounds.x,
        Math.max(bounds.x, bounds.x + bounds.width - startRect.width),
      );
      const nextY = clampValue(
        startRect.y + event.clientY - startY,
        bounds.y,
        Math.max(bounds.y, bounds.y + bounds.height - startRect.height),
      );
      const nextRect = { ...startRect, x: nextX, y: nextY };
      onRectChange?.(nextRect);
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
      const bounds = getDesktopBounds();
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;

      let next = {
        x: startRect.x,
        y: startRect.y,
        width: startRect.width,
        height: startRect.height,
      };

      if (direction.includes("right")) {
        next.width = clampValue(
          startRect.width + deltaX,
          minWidth,
          Math.max(minWidth, bounds.x + bounds.width - startRect.x),
        );
      }

      if (direction.includes("left")) {
        const nextX = clampValue(
          startRect.x + deltaX,
          bounds.x,
          startRect.x + startRect.width - minWidth,
        );
        next.x = nextX;
        next.width = startRect.width - (nextX - startRect.x);
      }

      if (direction.includes("bottom")) {
        next.height = clampValue(
          startRect.height + deltaY,
          minHeight,
          Math.max(minHeight, bounds.y + bounds.height - startRect.y),
        );
      }

      if (direction.includes("top")) {
        const nextY = clampValue(
          startRect.y + deltaY,
          bounds.y,
          startRect.y + startRect.height - minHeight,
        );
        next.y = nextY;
        next.height = startRect.height - (nextY - startRect.y);
      }

      next.x = clampValue(
        next.x,
        bounds.x,
        Math.max(bounds.x, bounds.x + bounds.width - next.width),
      );
      next.y = clampValue(
        next.y,
        bounds.y,
        Math.max(bounds.y, bounds.y + bounds.height - next.height),
      );

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
