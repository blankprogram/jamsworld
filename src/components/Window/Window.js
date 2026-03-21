import React, { memo } from "react";
import { useResizableAndDraggable } from "../../hooks/useDraggable";
import {
  StyledWindow,
  StyledHeader,
  StyledWindowBody,
  ResizeHandle,
  StyledHeaderButtons,
} from "./Styles";

const HeaderButtons = ({
  buttons,
  onMaximize,
  onMinimize,
  onClose,
  maximized,
  resizable,
  minimizable,
  isFocus,
}) => {
  const buttonElements = {
    minimize: (
      <button
        key="minimize"
        className={`header__button header__button--minimize ${!isFocus ? "header__button--unfocused" : ""} ${
          minimizable ? "" : "header__button--disable"
        }`}
        disabled={!minimizable}
        onMouseUp={minimizable ? onMinimize : undefined}
      />
    ),
    maximize: (
      <button
        key="maximize"
        className={`header__button ${
          maximized ? "header__button--maximized" : "header__button--maximize"
        } ${!isFocus ? "header__button--unfocused" : ""} ${
          resizable ? "" : "header__button--disable"
        }`}
        disabled={!resizable}
        onMouseUp={resizable ? onMaximize : undefined}
      />
    ),
    close: (
      <button
        key="close"
        className={`header__button header__button--close ${!isFocus ? "header__button--unfocused" : ""}`}
        onMouseUp={onClose}
      />
    ),
  };

  return (
    <StyledHeaderButtons isFocus={isFocus}>
      {buttons ? buttons.map((b) => buttonElements[b]) : Object.values(buttonElements)}
    </StyledHeaderButtons>
  );
};

const TASKBAR_HEIGHT = 30;

const Window = memo(
  ({
    title,
    icon,
    children,
    onClose,
    onMinimize,
    onToggleMaximize,
    onFocus,
    onRectChange,
    isFocused,
    isMinimized,
    maximized,
    useStyledWindow = true,
    buttons,
    rect,
    minWidth = 600,
    minHeight = 200,
    resizable = true,
    minimizable = true,
    interactionLocked = false,
    zIndex,
  }) => {
    const { windowRef, startDrag, startResize } = useResizableAndDraggable({
      rect,
      minWidth,
      minHeight,
      resizable,
      maximized,
      onRectChange,
    });

    const handleFocus = () => {
      if (!isFocused) onFocus();
    };

    const handleDoubleClick = () => {
      if (onToggleMaximize && resizable) onToggleMaximize();
    };

    const containerStyle = maximized
      ? {
          zIndex,
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: `calc(100vh - ${TASKBAR_HEIGHT}px)`,
          maxWidth: "100vw",
          maxHeight: `calc(100vh - ${TASKBAR_HEIGHT}px)`,
        }
      : {
          zIndex,
          top: `${rect?.y ?? 0}px`,
          left: `${rect?.x ?? 0}px`,
          width: `${rect?.width ?? 1200}px`,
          height: `${rect?.height ?? 700}px`,
        };

    const containerProps = {
      ref: windowRef,
      onMouseDown: handleFocus,
      style: {
        ...containerStyle,
        pointerEvents: interactionLocked ? "none" : undefined,
      },
    };

    if (!useStyledWindow) {
      return (
        <div {...containerProps}>
          {React.cloneElement(children, { isFocused, onFocus: handleFocus })}
        </div>
      );
    }

    return (
      <StyledWindow
        {...containerProps}
        isFocused={isFocused}
        isMinimized={isMinimized}
        isMaximized={maximized}
      >
        <StyledHeader
          onMouseDown={startDrag}
          onDoubleClick={handleDoubleClick}
          isFocused={isFocused}
        >
          <img
            src={icon}
            alt={title}
            className="app__header__icon"
            draggable={false}
          />
          <div className="app__header__title">{title}</div>
          <HeaderButtons
            buttons={buttons}
            onMinimize={onMinimize}
            onMaximize={onToggleMaximize}
            onClose={onClose}
            isFocus={isFocused}
            maximized={maximized}
            resizable={resizable}
            minimizable={minimizable}
          />
        </StyledHeader>
        <StyledWindowBody>
          {React.cloneElement(children, { isFocused, onFocus: handleFocus })}
        </StyledWindowBody>
        {resizable && !maximized && (
          <>
            <ResizeHandle
              className="top-left"
              onMouseDown={(e) => startResize(e, "top left")}
            />
            <ResizeHandle
              className="top-right"
              onMouseDown={(e) => startResize(e, "top right")}
            />
            <ResizeHandle
              className="bottom-left"
              onMouseDown={(e) => startResize(e, "bottom left")}
            />
            <ResizeHandle
              className="bottom-right"
              onMouseDown={(e) => startResize(e, "bottom right")}
            />
            <ResizeHandle
              className="top"
              onMouseDown={(e) => startResize(e, "top")}
            />
            <ResizeHandle
              className="right"
              onMouseDown={(e) => startResize(e, "right")}
            />
            <ResizeHandle
              className="bottom"
              onMouseDown={(e) => startResize(e, "bottom")}
            />
            <ResizeHandle
              className="left"
              onMouseDown={(e) => startResize(e, "left")}
            />
          </>
        )}
      </StyledWindow>
    );
  },
);

export default Window;
