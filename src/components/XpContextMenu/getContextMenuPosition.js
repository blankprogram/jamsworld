const clamp = (value, minimum, maximum) =>
  Math.min(Math.max(value, minimum), maximum);

const VIEWPORT_PADDING = 2;
const SUBMENU_OVERLAP = 2;

const positionAxis = ({
  anchor,
  menuSize,
  viewportSize,
  viewportPadding,
}) => {
  const maximum = viewportSize - menuSize - viewportPadding;
  if (maximum < viewportPadding) return viewportPadding;

  const overflowsEnd = anchor + menuSize > viewportSize - viewportPadding;
  const preferred = overflowsEnd ? anchor - menuSize : anchor;

  return clamp(preferred, viewportPadding, maximum);
};

export default function getContextMenuPosition({
  anchorX,
  anchorY,
  menuHeight,
  menuWidth,
  viewportHeight,
  viewportPadding = 2,
  viewportWidth,
}) {
  return {
    left: positionAxis({
      anchor: anchorX,
      menuSize: menuWidth,
      viewportSize: viewportWidth,
      viewportPadding,
    }),
    top: positionAxis({
      anchor: anchorY,
      menuSize: menuHeight,
      viewportSize: viewportHeight,
      viewportPadding,
    }),
  };
}

export function getSubmenuPosition({
  triggerRect,
  submenuWidth,
  submenuHeight,
  viewportHeight,
  viewportWidth,
}) {
  const rightPosition = triggerRect.right - SUBMENU_OVERLAP;
  const leftPosition =
    triggerRect.left + SUBMENU_OVERLAP - submenuWidth;
  const fitsRight =
    rightPosition + submenuWidth <= viewportWidth - VIEWPORT_PADDING;
  const preferredLeft = fitsRight ? rightPosition : leftPosition;

  return {
    left: clamp(
      preferredLeft,
      VIEWPORT_PADDING,
      viewportWidth - submenuWidth - VIEWPORT_PADDING,
    ),
    top: clamp(
      triggerRect.top - 3,
      VIEWPORT_PADDING,
      viewportHeight - submenuHeight - VIEWPORT_PADDING,
    ),
  };
}
