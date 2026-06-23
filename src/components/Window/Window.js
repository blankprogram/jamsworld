import React, { memo } from "react";
import { useResizableAndDraggable } from "../../hooks/useDraggable";
import {
  StyledWindow,
  StyledHeader,
  HeaderButton,
  HeaderButtonGroup,
  HeaderIcon,
  HeaderTitle,
  StyledWindowBody,
  ResizeHandle,
} from "./Styles";

const HEADER_CONTROL_SELECTOR = "[data-window-header-control]";
const MAXIMIZED_HEIGHT = "calc(100vh - var(--xp-taskbar-height))";

const HeaderButtons = ({
  buttons,
  onMaximize,
  onMinimize,
  onClose,
  maximized,
  resizable,
  minimizable,
  isFocused,
}) => {
  const buttonElements = {
    minimize: (
      <HeaderButton
        key="minimize"
        type="button"
        aria-label="Minimize"
        data-window-header-control="true"
        $variant="minimize"
        disabled={!minimizable}
        onMouseUp={minimizable ? onMinimize : undefined}
      />
    ),
    maximize: (
      <HeaderButton
        key="maximize"
        type="button"
        aria-label={maximized ? "Restore" : "Maximize"}
        data-window-header-control="true"
        $variant={maximized ? "restore" : "maximize"}
        disabled={!resizable}
        onMouseUp={resizable ? onMaximize : undefined}
      />
    ),
    close: (
      <HeaderButton
        key="close"
        type="button"
        aria-label="Close"
        data-window-header-control="true"
        $variant="close"
        onMouseUp={onClose}
      />
    ),
  };

  return (
    <HeaderButtonGroup $isFocused={isFocused}>
      {buttons ? buttons.map((b) => buttonElements[b]) : Object.values(buttonElements)}
    </HeaderButtonGroup>
  );
};

const RESIZE_HANDLES = [
  ["topLeft", "top left"],
  ["topRight", "top right"],
  ["bottomLeft", "bottom left"],
  ["bottomRight", "bottom right"],
  ["top", "top"],
  ["right", "right"],
  ["bottom", "bottom"],
  ["left", "left"],
];

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
    clickThroughWindow = false,
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

    const isHeaderControlEvent = (event) =>
      event.target instanceof Element &&
      event.target.closest(HEADER_CONTROL_SELECTOR);

    const handleHeaderMouseDown = (event) => {
      if (isHeaderControlEvent(event)) return;
      startDrag(event);
    };

    const handleDoubleClick = (event) => {
      if (isHeaderControlEvent(event)) return;
      if (onToggleMaximize && resizable) onToggleMaximize();
    };

    const containerStyle = maximized
      ? {
          zIndex,
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: MAXIMIZED_HEIGHT,
          maxWidth: "100vw",
          maxHeight: MAXIMIZED_HEIGHT,
          transform: "none",
        }
      : useStyledWindow
        ? {
            zIndex,
            top: `${rect?.y ?? 0}px`,
            left: `${rect?.x ?? 0}px`,
            width: `${rect?.width ?? 1200}px`,
            height: `${rect?.height ?? 700}px`,
          }
        : {
            zIndex,
            position: "absolute",
            top: `${rect?.y ?? 0}px`,
            left: `${rect?.x ?? 0}px`,
            width: `${rect?.width ?? 1200}px`,
            height: `${rect?.height ?? 700}px`,
          };

    const containerProps = {
      ref: windowRef,
      "data-window-root": "true",
      onMouseDown: handleFocus,
      style: {
        ...containerStyle,
        pointerEvents:
          interactionLocked || clickThroughWindow ? "none" : undefined,
      },
    };

    if (!useStyledWindow) {
      return (
        <div {...containerProps}>
          {React.cloneElement(children, {
            isFocused,
            onFocus: handleFocus,
          })}
        </div>
      );
    }

    return (
      <StyledWindow
        {...containerProps}
        $isFocused={isFocused}
        $isMinimized={isMinimized}
        $isMaximized={maximized}
      >
        <StyledHeader
          onMouseDown={handleHeaderMouseDown}
          onDoubleClick={handleDoubleClick}
          $isFocused={isFocused}
        >
          <HeaderIcon
            src={icon}
            alt={title}
            draggable={false}
          />
          <HeaderTitle>{title}</HeaderTitle>
          <HeaderButtons
            buttons={buttons}
            onMinimize={onMinimize}
            onMaximize={onToggleMaximize}
            onClose={onClose}
            isFocused={isFocused}
            maximized={maximized}
            resizable={resizable}
            minimizable={minimizable}
          />
        </StyledHeader>
        <StyledWindowBody>
          {React.cloneElement(children, {
            isFocused,
            onFocus: handleFocus,
          })}
        </StyledWindowBody>
        {resizable && !maximized && (
          <>
            {RESIZE_HANDLES.map(([edge, direction]) => (
              <ResizeHandle
                key={edge}
                $edge={edge}
                onMouseDown={(e) => startResize(e, direction)}
              />
            ))}
          </>
        )}
      </StyledWindow>
    );
  },
);

export default Window;
