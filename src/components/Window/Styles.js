import styled from 'styled-components';

export const StyledWindow = styled.div`
  display: ${({ isMinimized }) => (isMinimized ? 'none' : 'flex')};
  position: absolute;
  padding: ${({ header }) => (header?.invisible ? 0 : 3)}px;
  background-color: ${({ isFocused }) => (isFocused ? '#0831d9' : '#6582f5')};
  flex-direction: column;
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  width: ${({ width }) => width || '1200px'};
  height: ${({ height }) => height || '700px'};
  max-width: 100vw;
  max-height: 100vh;
  overflow: hidden;
`;

export const StyledHeader = styled.header`
  display: flex;
  height: 25px;
  font-weight: 700;
  font-size: 12px;
  font-family: 'Noto Sans';
  text-shadow: 1px 1px #000;
  color: white;
  position: relative;
  padding: 0 3px;
  align-items: center;
  background: ${({ isFocused }) =>
    isFocused
      ? 'linear-gradient(to bottom,#0058ee 0%,#3593ff 4%,#288eff 6%,#127dff 8%,#036ffc 10%,#0262ee 14%,#0057e5 20%,#0054e3 24%,#0055eb 56%,#005bf5 66%,#026afe 76%,#0062ef 86%,#0052d6 92%,#0040ab 94%,#003092 100%)'
      : 'linear-gradient(to bottom, #7697e7 0%,#7e9ee3 3%,#94afe8 6%,#97b4e9 8%,#82a5e4 14%,#7c9fe2 17%,#7996de 25%,#7b99e1 56%,#82a9e9 81%,#80a5e7 89%,#7b96e1 94%,#7a93df 97%,#abbae3 100%)'};
  border-top-left-radius: 8px;
  border-top-right-radius: 8px;
  overflow: hidden;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }


  .app__header__icon {
    width: 15px;
    height: 15px;
    margin-left: 1px;
    margin-right: 3px;
  }

  .app__header__title {
    flex: 1;
    padding-right: 5px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
`;

export const StyledWindowBody = styled.div`
  flex: 1;
  position: relative;
  height: calc(100% - 25px);
  background-color: white;
  
`;

export const ResizeHandle = styled.div`
  position: absolute;
  background-color: transparent;
  z-index: 3;

  &.top-left,
  &.top-right,
  &.bottom-left,
  &.bottom-right {
    width: 15px;
    height: 15px;
  }

  &.top-left {
    top: 0;
    left: 0;
    cursor: nwse-resize;
  }

  &.top-right {
    top: 0;
    right: 0;
    cursor: nesw-resize;
  }

  &.bottom-left {
    bottom: 0;
    left: 0;
    cursor: nesw-resize;
  }

  &.bottom-right {
    bottom: 0;
    right: 0;
    cursor: nwse-resize;
  }

  &.top,
  &.bottom {
    width: calc(100% - 30px);
    height: 10px;
    left: 15px;
    cursor: ns-resize;
  }

  &.top {
    top: 0;
  }

  &.bottom {
    bottom: 0;
  }

  &.left,
  &.right {
    height: calc(100% - 30px);
    width: 10px;
    top: 15px;
    cursor: ew-resize;
  }

  &.left {
    left: 0;
  }

  &.right {
    right: 0;
  }
`;

export const StyledHeaderButtons = styled.div`
  opacity: ${({ isFocus }) => (isFocus ? 1 : 0.6)};
  height: 22px;
  display: flex;
  align-items: center;
  margin-top: -1px;
  margin-right: 1px;
  
  .header__button {
    margin-right: 1px;
    position: relative;
    width: 22px;
    height: 22px;
    border: 1px solid #fff;
    border-radius: 3px;
    min-width: 0 !important;
    min-height: 0 !important;
    padding: 0 !important;
    &:hover {
      filter: brightness(120%);
    }
    &:hover:active {
      filter: brightness(90%);
    }
  }
  
  .header__button--minimize {
    box-shadow: inset 0 -1px 2px 1px #4646ff;
    background-image: radial-gradient(
      circle at 90% 90%,
      #0054e9 0%,
      #2263d5 55%,
      #4479e4 70%,
      #a3bbec 90%,
      white 100%
    );
    &:before {
      content: '';
      position: absolute;
      left: 4px;
      top: 13px;
      height: 3px;
      width: 8px;
      background-color: white;
    }
  }
  
  .header__button--maximize {
    box-shadow: inset 0 -1px 2px 1px #4646ff;
    background-image: radial-gradient(
      circle at 90% 90%,
      #0054e9 0%,
      #2263d5 55%,
      #4479e4 70%,
      #a3bbec 90%,
      white 100%
    );
    &:before {
      content: '';
      position: absolute;
      display: block;
      left: 4px;
      top: 4px;
      box-shadow: inset 0 3px white, inset 0 0 0 1px white;
      height: 12px;
      width: 12px;
    }
  }
  
  .header__button--maximized {
    box-shadow: inset 0 -1px 2px 1px #4646ff;
    background-image: radial-gradient(
      circle at 90% 90%,
      #0054e9 0%,
      #2263d5 55%,
      #4479e4 70%,
      #a3bbec 90%,
      white 100%
    );
    &:before {
      content: '';
      position: absolute;
      display: block;
      left: 7px;
      top: 4px;
      box-shadow: inset 0 2px white, inset 0 0 0 1px white;
      height: 8px;
      width: 8px;
    }
    &:after {
      content: '';
      position: absolute;
      display: block;
      left: 4px;
      top: 7px;
      box-shadow: inset 0 2px white, inset 0 0 0 1px white, 1px -1px #136dff;
      height: 8px;
      width: 8px;
      background-color: #136dff;
    }
  }
  
  .header__button--close {
    box-shadow: inset 0 -1px 2px 1px #da4600;
    background-image: radial-gradient(
      circle at 90% 90%,
      #cc4600 0%,
      #dc6527 55%,
      #cd7546 70%,
      #ffccb2 90%,
      white 100%
    );
    &:before {
      content: '';
      position: absolute;
      left: 9px;
      top: 2px;
      transform: rotate(45deg);
      height: 16px;
      width: 2px;
      background-color: white;
    }
    &:after {
      content: '';
      position: absolute;
      left: 9px;
      top: 2px;
      transform: rotate(-45deg);
      height: 16px;
      width: 2px;
      background-color: white;
    }
  }
  
  .header__button--disable {
    outline: none;
    opacity: 0.5;
    &:hover {
      filter: brightness(100%);
    }
  }
`;
