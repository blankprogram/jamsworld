import React, { useRef, useEffect, memo, useState } from 'react';
import { useResizableAndDraggable } from '../../hooks/useDraggable';
import { getAppIcon } from '../../utils/getAppIcon';
import {
  StyledWindow,
  StyledHeader,
  StyledWindowBody,
  ResizeHandle,
  StyledHeaderButtons,
} from './Styles';

let highestZIndex = 1;



const HeaderButtons = ({ buttons, onMaximize, onMinimize, onClose, maximized, resizable, isFocus }) => {
  const buttonElements = {
    minimize: (
      <button
        key="minimize"
        className={`header__button header__button--minimize ${!isFocus ? 'header__button--unfocused' : ''}`}
        onMouseUp={onMinimize}
      />
    ),
    maximize: (
      <button
        key="maximize"
        className={`header__button ${
          maximized ? 'header__button--maximized' : 'header__button--maximize'
        } ${!isFocus ? 'header__button--unfocused' : ''} ${resizable ? '' : 'header__button--disable'}`}
        onMouseUp={onMaximize}
      />
    ),
    close: (
      <button
        key="close"
        className={`header__button header__button--close ${!isFocus ? 'header__button--unfocused' : ''}`}
        onMouseUp={onClose}
      />
    ),
  };

  return (
    <StyledHeaderButtons isFocus={isFocus}>
      {buttons ? buttons.map(b => buttonElements[b]) : Object.values(buttonElements)}
    </StyledHeaderButtons>
  );
};

const Window = memo(({ title, children, onClose, onMinimize, onToggleMaximize, onFocus, isFocused, isMinimized, maximized, useStyledWindow = true }) => {
  const { windowRef, startDrag, startResize } = useResizableAndDraggable();
  const originalStateRef = useRef(null);
  const [initialPosition, setInitialPosition] = useState({ top: 0, left: 0 });

  
  useEffect(() => {
    const { innerWidth, innerHeight } = window;
    const windowWidth = windowRef.current?.offsetWidth || 1200;
    const windowHeight = windowRef.current?.offsetHeight || 700;

    const newPosition = {
      top: (innerHeight - windowHeight) / 2,
      left: (innerWidth - windowWidth) / 2,
    };
    setInitialPosition(newPosition);

    if (windowRef.current) {
      windowRef.current.style.top = `${newPosition.top}px`;
      windowRef.current.style.left = `${newPosition.left}px`;
    }
  }, [windowRef]);

  useEffect(() => {
    if (isFocused) {
      highestZIndex += 1;
      windowRef.current.style.zIndex = highestZIndex;
    }
  }, [isFocused, windowRef]);

  useEffect(() => {
    if (!useStyledWindow || !windowRef.current) return;

    const taskbarHeight = 30;
    const element = windowRef.current;

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

      Object.assign(element.style, {
        position: 'fixed',
        top: '0',
        left: '0',
        width: '100vw',
        height: `calc(100vh - ${taskbarHeight}px)`,
        maxWidth: '100vw',
        maxHeight: `calc(100vh - ${taskbarHeight}px)`,
      });
    } else if (originalStateRef.current) {
      Object.assign(element.style, originalStateRef.current);
      originalStateRef.current = null;
    }
  }, [maximized, useStyledWindow, windowRef]);

  const handleFocus = () => {
    if (!isFocused) {
      highestZIndex += 1;
      windowRef.current.style.zIndex = highestZIndex;
      onFocus();
    }
  };

  const handleDoubleClick = () => {
    if (onToggleMaximize) {
      onToggleMaximize();
    }
  };

  const containerProps = {
    ref: windowRef,
    onMouseDown: handleFocus,
    style: initialPosition ? { top: `${initialPosition.top}px`, left: `${initialPosition.left}px` } : {},
  };

  if (!useStyledWindow) {
    return <div {...containerProps}>{React.cloneElement(children, { isFocused, onFocus: handleFocus })}</div>;
  }

  return (
    <StyledWindow {...containerProps} isFocused={isFocused} isMinimized={isMinimized}  isMaximized={maximized}>
      <StyledHeader onMouseDown={startDrag} onDoubleClick={handleDoubleClick} isFocused={isFocused}>
        <img src={getAppIcon(title)} alt={title} className="app__header__icon" draggable={false} />
        <div className="app__header__title">{title}</div>
        <HeaderButtons onMinimize={onMinimize} onMaximize={onToggleMaximize} onClose={onClose} isFocus={isFocused} maximized={maximized} resizable={true} />
      </StyledHeader>
      <StyledWindowBody>{React.cloneElement(children, { isFocused, onFocus: handleFocus })}</StyledWindowBody>
      <ResizeHandle className="top-left" onMouseDown={(e) => startResize(e, 'top left')} />
      <ResizeHandle className="top-right" onMouseDown={(e) => startResize(e, 'top right')} />
      <ResizeHandle className="bottom-left" onMouseDown={(e) => startResize(e, 'bottom left')} />
      <ResizeHandle className="bottom-right" onMouseDown={(e) => startResize(e, 'bottom right')} />
      <ResizeHandle className="top" onMouseDown={(e) => startResize(e, 'top')} />
      <ResizeHandle className="right" onMouseDown={(e) => startResize(e, 'right')} />
      <ResizeHandle className="bottom" onMouseDown={(e) => startResize(e, 'bottom')} />
      <ResizeHandle className="left" onMouseDown={(e) => startResize(e, 'left')} />
    </StyledWindow>
  );
});

export default Window;
