import React, { useRef, useEffect, useState } from 'react';
import './Window.css';
import useDraggable from '../../hooks/useDraggable';

const Window = ({ title, children, onClose, onMinimize, onToggleMaximize, maximized, onFocus, isFocused }) => {
  const windowRef = useRef(null);
  const [originalState, setOriginalState] = useState({});

  useDraggable(windowRef);

  useEffect(() => {
    const element = windowRef.current;

    if (maximized) {
      const { width, height, top, left, maxWidth, maxHeight, position } = element.style;
      setOriginalState({ width, height, top, left, maxWidth, maxHeight, position });

      element.classList.add('maximized');
      Object.assign(element.style, {
        width: '100vw',
        height: 'calc(100vh - 30px)',
        top: '0',
        left: '0',
        maxWidth: '100vw',
        maxHeight: 'calc(100vh - 30px)',
        position: 'fixed',
      });
    } else if (Object.keys(originalState).length) {
      element.classList.remove('maximized');
      Object.assign(element.style, originalState);
    }
    
    (() => element.offsetHeight)();
  }, [maximized]);

  const handleFocus = (e) => {
    if (!e.target.closest('.title-bar-controls')) {
      onFocus();
    }
  };

  return (
    <div
      className={`window ${maximized ? 'maximized' : ''} ${isFocused ? 'focused' : 'unfocused'}`}
      ref={windowRef}
      onMouseDown={handleFocus}
    >
      <div className={`title-bar ${isFocused ? 'focused-title-bar' : 'unfocused-title-bar'}`}>
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
    </div>
  );
};

export default Window;
