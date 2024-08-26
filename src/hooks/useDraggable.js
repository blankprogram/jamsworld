import { useRef } from 'react';

export const useResizableAndDraggable = () => {
  const windowRef = useRef(null);
  const minSize = { width: 200, height: 150 };

  const addEventListeners = (moveHandler, stopHandler) => {
    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', stopHandler);
  };

  const removeEventListeners = (moveHandler, stopHandler) => {
    window.removeEventListener('mousemove', moveHandler);
    window.removeEventListener('mouseup', stopHandler);
  };

  const startDrag = (e) => {
    e.preventDefault();
    if (!windowRef.current) return;

    const { clientX: startX, clientY: startY } = e;
    const { offsetLeft: startLeft, offsetTop: startTop } = windowRef.current;

    const handleDrag = (event) => {
      if (!windowRef.current) return;

      const newLeft = Math.max(0, Math.min(window.innerWidth - windowRef.current.offsetWidth, startLeft + event.clientX - startX));
      const newTop = Math.max(0, Math.min(window.innerHeight - windowRef.current.offsetHeight, startTop + event.clientY - startY));

      windowRef.current.style.left = `${newLeft}px`;
      windowRef.current.style.top = `${newTop}px`;
    };

    addEventListeners(handleDrag, () => removeEventListeners(handleDrag, handleDrag));
  };

  const handleResize = (e, direction) => {
    e.preventDefault();
    if (!windowRef.current) return;

    const element = windowRef.current;
    const { clientX: startX, clientY: startY } = e;
    const { offsetWidth: startWidth, offsetHeight: startHeight, offsetLeft: startLeft, offsetTop: startTop } = element;

    let newWidth = startWidth;
    let newHeight = startHeight;
    let newLeft = startLeft;
    let newTop = startTop;

    const updateSizeAndPosition = (event) => {
      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;

      const maxDeltaX = startWidth - minSize.width;
      const maxDeltaY = startHeight - minSize.height;

      if (direction.includes('right')) {
        newWidth = Math.max(minSize.width, startWidth + deltaX);
      }

      if (direction.includes('left')) {
        if (deltaX <= maxDeltaX && startLeft + deltaX >= 0) {
          newWidth = startWidth - deltaX;
          newLeft = startLeft + deltaX;
        } else if (deltaX > maxDeltaX) {
          newWidth = minSize.width;
          newLeft = startLeft + maxDeltaX;
        } else {
          newLeft = 0;
          newWidth = startLeft + startWidth;
        }
      }

      if (direction.includes('bottom')) {
        newHeight = Math.max(minSize.height, startHeight + deltaY);
      }

      if (direction.includes('top')) {
        if (deltaY <= maxDeltaY && startTop + deltaY >= 0) {
          newHeight = startHeight - deltaY;
          newTop = startTop + deltaY;
        } else if (deltaY > maxDeltaY) {
          newHeight = minSize.height;
          newTop = startTop + maxDeltaY;
        } else {
          newTop = 0;
          newHeight = startTop + startHeight;
        }
      }

      newWidth = Math.min(newWidth, window.innerWidth - newLeft);
      newHeight = Math.min(newHeight, window.innerHeight - newTop);

      element.style.width = `${newWidth}px`;
      element.style.height = `${newHeight}px`;

      if (direction.includes('left')) {
        element.style.left = `${newLeft}px`;
      }

      if (direction.includes('top')) {
        element.style.top = `${newTop}px`;
      }
    };

    addEventListeners(updateSizeAndPosition, () => removeEventListeners(updateSizeAndPosition, updateSizeAndPosition));
  };

  return {
    windowRef,
    startDrag,
    startResize: handleResize,
  };
};
