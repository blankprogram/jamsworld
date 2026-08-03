import { useRef, useState } from "react";

import {
  createSelectionRectangle,
  isAdditiveSelection,
  rectanglesIntersect,
  SELECTION_CONTROL_SELECTOR,
  SELECTION_ITEM_SELECTOR,
} from "../utils/selection";
import { isXpContextMenuTarget } from "../utils/contextMenu";

export default function useMarqueeSelection({
  containerRef,
  onSelectionChange,
  onStart,
  selectedKeys,
}) {
  const dragStateRef = useRef(null);
  const [marquee, setMarquee] = useState(null);

  const handlePointerDown = (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (
      event.button !== 0 ||
      target?.closest(SELECTION_ITEM_SELECTOR) ||
      target?.closest(SELECTION_CONTROL_SELECTOR) ||
      isXpContextMenuTarget(target)
    ) {
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const additive = isAdditiveSelection(event);
    const baseSelection = additive ? new Set(selectedKeys) : new Set();
    const containerRect = container.getBoundingClientRect();

    event.preventDefault();
    container.focus();
    container.setPointerCapture?.(event.pointerId);
    onStart?.();
    dragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      baseSelection,
      additive,
    };
    onSelectionChange(baseSelection);
    setMarquee({
      left: event.clientX - containerRect.left + container.scrollLeft,
      top: event.clientY - containerRect.top + container.scrollTop,
      width: 0,
      height: 0,
    });
  };

  const handlePointerMove = (event) => {
    const dragState = dragStateRef.current;
    const container = containerRef.current;
    if (
      !dragState ||
      !container ||
      dragState.pointerId !== event.pointerId
    ) {
      return;
    }

    const clientBox = createSelectionRectangle(
      dragState.startClientX,
      dragState.startClientY,
      event.clientX,
      event.clientY,
    );
    const nextSelection = new Set(dragState.baseSelection);

    container.querySelectorAll(SELECTION_ITEM_SELECTOR).forEach((element) => {
      const key = element.dataset.selectionKey;
      if (
        !key ||
        !rectanglesIntersect(clientBox, element.getBoundingClientRect())
      ) {
        return;
      }

      if (dragState.additive && dragState.baseSelection.has(key)) {
        nextSelection.delete(key);
      } else {
        nextSelection.add(key);
      }
    });

    const containerRect = container.getBoundingClientRect();
    setMarquee({
      left: clientBox.left - containerRect.left + container.scrollLeft,
      top: clientBox.top - containerRect.top + container.scrollTop,
      width: clientBox.width,
      height: clientBox.height,
    });
    onSelectionChange(nextSelection);
  };

  const finishMarquee = (event) => {
    const dragState = dragStateRef.current;
    const container = containerRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    if (container?.hasPointerCapture?.(event.pointerId)) {
      container.releasePointerCapture?.(event.pointerId);
    }
    dragStateRef.current = null;
    setMarquee(null);
  };

  return {
    marquee,
    onPointerCancel: finishMarquee,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: finishMarquee,
  };
}
