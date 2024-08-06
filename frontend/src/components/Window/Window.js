import React, { useRef, useEffect, useState } from 'react';
import './Window.css';
import useDraggable from '../../hooks/useDraggable';

const Window = ({ title, children, onClose, onMinimize, onToggleMaximize, maximized }) => {
  const windowRef = useRef(null);
  const [originalState, setOriginalState] = useState(null);

  useDraggable(windowRef);

  useEffect(() => {
    const element = windowRef.current;

    if (maximized) {
      if (!originalState) {
        setOriginalState({
          width: element.style.width,
          height: element.style.height,
          top: element.style.top,
          left: element.style.left,
          maxWidth: element.style.maxWidth,
          maxHeight: element.style.maxHeight,
          position: element.style.position,
          transition: element.style.transition,
        });
      }

      element.classList.add('maximized');
      element.style.width = '100vw';
      element.style.height = '100vh';
      element.style.top = '0';
      element.style.left = '0';
      element.style.maxWidth = '100vw';
      element.style.maxHeight = '100vh';
      element.style.position = 'fixed';
      element.style.transition = 'all 0.3s ease';
    } else if (originalState) {
      element.classList.remove('maximized');
      element.style.width = originalState.width;
      element.style.height = originalState.height;
      element.style.top = originalState.top;
      element.style.left = originalState.left;
      element.style.maxWidth = originalState.maxWidth;
      element.style.maxHeight = originalState.maxHeight;
      element.style.position = originalState.position;
      element.style.transition = originalState.transition;
    }

    (() => element.offsetHeight)();
  }, [maximized, originalState]);

  return (
    <div className={`window ${maximized ? 'maximized' : ''}`} ref={windowRef}>
      <div className="title-bar">
        <div className="title-bar-text">{title}</div>
        <div className="title-bar-controls">
          <button aria-label="Minimize" onClick={onMinimize}></button>
          <button aria-label="Maximize" onClick={onToggleMaximize}></button>
          <button aria-label="Close" onClick={onClose}></button>
        </div>
      </div>
      <div className="window-body">
        {children}
      </div>
    </div>
  );
};

export default Window;
