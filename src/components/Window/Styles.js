import styled, { css } from "styled-components";

const focusedHeaderGradient =
  "var(--xp-window-header-focused-gradient, linear-gradient(to bottom,#0058ee 0%,#3593ff 4%,#288eff 6%,#127dff 8%,#036ffc 10%,#0262ee 14%,#0057e5 20%,#0054e3 24%,#0055eb 56%,#005bf5 66%,#026afe 76%,#0062ef 86%,#0052d6 92%,#0040ab 94%,#003092 100%))";

const unfocusedHeaderGradient =
  "var(--xp-window-header-unfocused-gradient, linear-gradient(to bottom, #7697e7 0%,#7e9ee3 3%,#94afe8 6%,#97b4e9 8%,#82a5e4 14%,#7c9fe2 17%,#7996de 25%,#7b99e1 56%,#82a9e9 81%,#80a5e7 89%,#7b96e1 94%,#7a93df 97%,#abbae3 100%))";

const headerGradient = ({ $isFocused }) =>
  $isFocused ? focusedHeaderGradient : unfocusedHeaderGradient;

const WINDOW_FRAME_SIZE = 3;
const WINDOW_TOP_FRAME_SIZE = WINDOW_FRAME_SIZE;

export const StyledWindow = styled.div`
  box-sizing: border-box;
  display: ${({ $isMinimized }) => ($isMinimized ? "none" : "flex")};
  position: absolute;
  padding: ${({ $isMaximized }) =>
    $isMaximized
      ? 0
      : `${WINDOW_TOP_FRAME_SIZE}px ${WINDOW_FRAME_SIZE}px ${WINDOW_FRAME_SIZE}px`};
  background-color: ${({ $isFocused }) =>
    $isFocused
      ? "var(--xp-window-frame-focused, #0831d9)"
      : "var(--xp-window-frame-unfocused, #6582f5)"};
  flex-direction: column;
  border-top-left-radius: ${({ $isMaximized }) => ($isMaximized ? 0 : 8)}px;
  border-top-right-radius: ${({ $isMaximized }) => ($isMaximized ? 0 : 8)}px;
  max-width: 100vw;
  max-height: 100vh;
  overflow: hidden;
`;

export const StyledHeader = styled.header`
  display: flex;
  height: 25px;
  font-weight: 700;
  font-size: 12px;
  font-family: "Noto Sans";
  text-shadow: 1px 1px #000;
  color: white;
  position: relative;
  padding: 0 3px;
  align-items: center;
  background: ${headerGradient};
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  overflow: visible;
  cursor: var(--xp-cursor-move), move;

  &:active {
    cursor: var(--xp-cursor-move), move;
  }
`;

export const HeaderIcon = styled.img`
  width: 15px;
  height: 15px;
  margin-right: 3px;
`;

export const HeaderTitle = styled.div`
  flex: 1;
  padding-right: 5px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

export const StyledWindowBody = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  position: relative;
  background-color: white;
  overflow: hidden;
`;

const resizeHandleEdgeStyles = ({ $edge }) => {
  switch ($edge) {
    case "topLeft":
      return css`
        top: 0;
        left: 0;
        width: 16px;
        height: 16px;
        cursor: var(--xp-cursor-resize-nwse), nwse-resize;
      `;
    case "topRight":
      return css`
        top: 0;
        right: 0;
        width: 16px;
        height: 16px;
        cursor: var(--xp-cursor-resize-nesw), nesw-resize;
      `;
    case "bottomLeft":
      return css`
        bottom: 0;
        left: 0;
        width: 16px;
        height: 16px;
        cursor: var(--xp-cursor-resize-nesw), nesw-resize;
      `;
    case "bottomRight":
      return css`
        bottom: 0;
        right: 0;
        width: 16px;
        height: 16px;
        cursor: var(--xp-cursor-resize-nwse), nwse-resize;
      `;
    case "top":
      return css`
        top: 0;
        left: 16px;
        width: calc(100% - 32px);
        height: 5px;
        cursor: var(--xp-cursor-resize-ns), ns-resize;
      `;
    case "right":
      return css`
        top: 16px;
        right: 0;
        width: 10px;
        height: calc(100% - 32px);
        cursor: var(--xp-cursor-resize-ew), ew-resize;
      `;
    case "bottom":
      return css`
        bottom: 0;
        left: 16px;
        width: calc(100% - 32px);
        height: 10px;
        cursor: var(--xp-cursor-resize-ns), ns-resize;
      `;
    case "left":
      return css`
        top: 16px;
        left: 0;
        width: 10px;
        height: calc(100% - 32px);
        cursor: var(--xp-cursor-resize-ew), ew-resize;
      `;
    default:
      return css`
        display: none;
      `;
  }
};

export const ResizeHandle = styled.div`
  position: absolute;
  background-color: transparent;
  z-index: 3;
  ${resizeHandleEdgeStyles}
`;

export const HeaderButtonGroup = styled.div`
  position: relative;
  z-index: 4;
  opacity: ${({ $isFocused }) => ($isFocused ? 1 : 0.6)};
  height: 22px;
  display: flex;
  align-items: center;
  margin-top: -1px;
  margin-right: 1px;
`;

const primaryHeaderButtonStyles = css`
  box-shadow: inset 0 -1px 2px 1px
    var(--xp-window-button-primary-shadow, #4646ff);
  background-image: var(
    --xp-window-button-primary-gradient,
    radial-gradient(
      circle at 90% 90%,
      #0054e9 0%,
      #2263d5 55%,
      #4479e4 70%,
      #a3bbec 90%,
      white 100%
    )
  );
`;

const headerButtonVariantStyles = ({ $variant }) => {
  switch ($variant) {
    case "minimize":
      return css`
        ${primaryHeaderButtonStyles}

        &:before {
          content: "";
          position: absolute;
          left: 4px;
          top: 13px;
          height: 3px;
          width: 8px;
          background-color: white;
        }
      `;
    case "maximize":
      return css`
        ${primaryHeaderButtonStyles}

        &:before {
          content: "";
          position: absolute;
          display: block;
          left: 4px;
          top: 4px;
          box-shadow:
            inset 0 3px white,
            inset 0 0 0 1px white;
          height: 12px;
          width: 12px;
        }
      `;
    case "restore":
      return css`
        ${primaryHeaderButtonStyles}

        &:before {
          content: "";
          position: absolute;
          display: block;
          left: 7px;
          top: 4px;
          box-shadow:
            inset 0 2px white,
            inset 0 0 0 1px white;
          height: 8px;
          width: 8px;
        }

        &:after {
          content: "";
          position: absolute;
          display: block;
          left: 4px;
          top: 7px;
          box-shadow:
            inset 0 2px white,
            inset 0 0 0 1px white,
            1px -1px var(--xp-window-button-maximized-bg, #136dff);
          height: 8px;
          width: 8px;
          background-color: var(--xp-window-button-maximized-bg, #136dff);
        }
      `;
    case "close":
      return css`
        box-shadow: inset 0 -1px 2px 1px
          var(--xp-window-button-close-shadow, #da4600);
        background-image: var(
          --xp-window-button-close-gradient,
          radial-gradient(
            circle at 90% 90%,
            #cc4600 0%,
            #dc6527 55%,
            #cd7546 70%,
            #ffccb2 90%,
            white 100%
          )
        );

        &:before,
        &:after {
          content: "";
          position: absolute;
          left: 9px;
          top: 2px;
          height: 16px;
          width: 2px;
          background-color: white;
        }

        &:before {
          transform: rotate(45deg);
        }

        &:after {
          transform: rotate(-45deg);
        }
      `;
    default:
      return primaryHeaderButtonStyles;
  }
};

export const HeaderButton = styled.button`
  margin-right: 1px;
  position: relative;
  width: 22px;
  height: 22px;
  border: 1px solid var(--xp-color-white, #fff);
  border-radius: 3px;
  min-width: 0 !important;
  min-height: 0 !important;
  padding: 0 !important;
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
  ${headerButtonVariantStyles}

  &:hover {
    filter: ${({ disabled }) =>
      disabled ? "brightness(100%)" : "brightness(120%)"};
  }

  &:hover:active {
    filter: ${({ disabled }) =>
      disabled ? "brightness(100%)" : "brightness(90%)"};
  }
`;
