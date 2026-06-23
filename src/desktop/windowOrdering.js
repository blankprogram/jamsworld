const getTaskbarOrder = (windowItem, fallbackIndex) =>
  Number.isFinite(windowItem?.taskbarOrder)
    ? windowItem.taskbarOrder
    : fallbackIndex;

export const getWindowsInTaskbarOrder = (windows = []) =>
  windows
    .map((windowItem, index) => ({ windowItem, index }))
    .sort((a, b) => {
      const orderDelta =
        getTaskbarOrder(a.windowItem, a.index) -
        getTaskbarOrder(b.windowItem, b.index);
      return orderDelta || a.index - b.index;
    })
    .map(({ windowItem }) => windowItem);

export const createWindowZIndexMap = (windows = []) => {
  const zIndexes = new Map();
  windows.forEach((windowItem, index) => {
    zIndexes.set(windowItem.id, index + 1);
  });
  return zIndexes;
};

export const getNextTaskbarOrder = (windows = []) =>
  windows.reduce(
    (nextOrder, windowItem, index) =>
      Math.max(nextOrder, getTaskbarOrder(windowItem, index) + 1),
    0,
  );

export const ensureTaskbarOrders = (windows = []) => {
  let nextOrder = getNextTaskbarOrder(windows);
  let changed = false;

  const orderedWindows = windows.map((windowItem) => {
    if (Number.isFinite(windowItem.taskbarOrder)) return windowItem;
    changed = true;
    const taskbarOrder = nextOrder;
    nextOrder += 1;
    return { ...windowItem, taskbarOrder };
  });

  return changed ? orderedWindows : windows;
};
