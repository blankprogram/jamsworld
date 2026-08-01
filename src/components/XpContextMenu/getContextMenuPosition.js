const clamp = (value, minimum, maximum) =>
  Math.min(Math.max(value, minimum), maximum);

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
