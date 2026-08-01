export const SELECTION_ITEM_SELECTOR = '[data-selection-item="true"]';
export const SELECTION_CONTROL_SELECTOR = '[data-selection-control="true"]';

export const isAdditiveSelection = (event) => event.ctrlKey || event.metaKey;

export const selectionSetsEqual = (left, right) =>
  left.size === right.size && [...left].every((value) => right.has(value));

export const updateSelection = (selection, key, additive = false) => {
  if (!additive) {
    return selection.size === 1 && selection.has(key)
      ? selection
      : new Set([key]);
  }

  const nextSelection = new Set(selection);
  if (nextSelection.has(key)) nextSelection.delete(key);
  else nextSelection.add(key);
  return nextSelection;
};

export const createSelectionRectangle = (startX, startY, endX, endY) => {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const right = Math.max(startX, endX);
  const bottom = Math.max(startY, endY);

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
};

export const rectanglesIntersect = (left, right) =>
  !(
    left.right < right.left ||
    left.left > right.right ||
    left.bottom < right.top ||
    left.top > right.bottom
  );
