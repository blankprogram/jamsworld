import React, { useRef, useEffect } from 'react';
import './Window.css';
import { useResizableAndDraggable } from '../../hooks/useDraggable';

const Window = ({
  title,
  children,
  onClose,
  onMinimize,
  onToggleMaximize,
  maximized,
  onFocus,
  isFocused,
  isMinimized,
  taskbarHeight = 30,
}) => {
  const { windowRef, startDrag, startResize } = useResizableAndDraggable();
  const originalStateRef = useRef(null);

  useEffect(() => {
    const element = windowRef.current;

    if (!element) return;

    if (maximized) {
      if (!originalStateRef.current) {
        originalStateRef.current = {
          width: element.style.width,
          height: element.style.height,
          top: element.style.top,
          left: element.style.left,
          position: element.style.position,
          maxWidth: element.style.maxWidth,
          maxHeight: element.style.maxHeight,
        };
      }

      element.style.position = 'fixed';
      element.style.top = '0';
      element.style.left = '0';
      element.style.width = '100vw';
      element.style.height = `calc(100vh - ${taskbarHeight}px)`;
      element.style.maxWidth = '100vw';
      element.style.maxHeight = `calc(100vh - ${taskbarHeight}px)`;
    } else if (originalStateRef.current) {
      Object.assign(element.style, originalStateRef.current);
      originalStateRef.current = null;
    }
  }, [maximized, taskbarHeight, windowRef]);

  const handleFocus = (e) => {
    if (!e.target.closest('.title-bar-controls')) {
      onFocus();
    }
  };

  const handleDoubleClick = () => {
    onToggleMaximize();
  };

  return (
    <div
      className={`window ${maximized ? 'maximized' : ''} ${isFocused ? 'focused' : 'unfocused'} ${isMinimized ? 'minimized' : ''}`}
      ref={windowRef}
      onMouseDown={handleFocus}
    >
      <div
        className={`title-bar ${isFocused ? 'focused-title-bar' : 'unfocused-title-bar'}`}
        onMouseDown={startDrag}
        onDoubleClick={handleDoubleClick}
      >
        <div className="title-bar-text">{title}</div>
        <div className="title-bar-controls">
          <button aria-label="Minimize" onClick={onMinimize}></button>
          <button aria-label="Maximize" onClick={onToggleMaximize}></button>
          <button aria-label="Close" onClick={onClose}></button>
        </div>
      </div>
      <div className="window-body">
        {React.cloneElement(children, { isFocused })}
      </div>

      <div className="resize-handle top-left" onMouseDown={(e) => startResize(e, 'top left')}></div>
      <div className="resize-handle top-right" onMouseDown={(e) => startResize(e, 'top right')}></div>
      <div className="resize-handle bottom-left" onMouseDown={(e) => startResize(e, 'bottom left')}></div>
      <div className="resize-handle bottom-right" onMouseDown={(e) => startResize(e, 'bottom right')}></div>
      <div className="resize-handle top" onMouseDown={(e) => startResize(e, 'top')}></div>
      <div className="resize-handle right" onMouseDown={(e) => startResize(e, 'right')}></div>
      <div className="resize-handle bottom" onMouseDown={(e) => startResize(e, 'bottom')}></div>
      <div className="resize-handle left" onMouseDown={(e) => startResize(e, 'left')}></div>
    </div>
  );
};

export default Window;
