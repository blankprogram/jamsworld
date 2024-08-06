import { useEffect } from 'react';

const useDraggable = (ref) => {
  useEffect(() => {
    const element = ref.current;
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let offsetX = 0;
    let offsetY = 0;

    const onMouseDown = (e) => {
      if (e.target.closest('.title-bar')) {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const rect = element.getBoundingClientRect();
        offsetX = startX - rect.left;
        offsetY = startY - rect.top;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      }
    };

    const onMouseMove = (e) => {
      if (isDragging) {
        const left = e.clientX - offsetX;
        const top = e.clientY - offsetY;
        const rightBound = window.innerWidth - element.offsetWidth;
        const bottomBound = window.innerHeight - element.offsetHeight;
        element.style.left = `${Math.min(Math.max(left, 0), rightBound)}px`;
        element.style.top = `${Math.min(Math.max(top, 0), bottomBound)}px`;
      }
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    element.addEventListener('mousedown', onMouseDown);

    return () => {
      element.removeEventListener('mousedown', onMouseDown);
    };
  }, [ref]);
};

export default useDraggable;
