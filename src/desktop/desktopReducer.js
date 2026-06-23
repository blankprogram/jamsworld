import { centerWindowRect, clampWindowRect } from "./windowGeometry";
import { ensureTaskbarOrders, getNextTaskbarOrder } from "./windowOrdering";

export const DESKTOP_ACTIONS = Object.freeze({
  OPEN_APP: "OPEN_APP",
  OPEN_WINDOW_INSTANCE: "OPEN_WINDOW_INSTANCE",
  CLOSE_WINDOW: "CLOSE_WINDOW",
  MINIMIZE_WINDOW: "MINIMIZE_WINDOW",
  RESTORE_WINDOW: "RESTORE_WINDOW",
  TOGGLE_MAXIMIZE_WINDOW: "TOGGLE_MAXIMIZE_WINDOW",
  FOCUS_WINDOW: "FOCUS_WINDOW",
  CLEAR_FOCUS: "CLEAR_FOCUS",
  UPDATE_WINDOW_RECT: "UPDATE_WINDOW_RECT",
  SET_SELECTED_DESKTOP_APPS: "SET_SELECTED_DESKTOP_APPS",
});

const createWindowId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const createWindowInstance = (app, index, options = {}) => {
  const defaults = {
    ...app.windowDefaults,
    ...(options.windowDefaultsOverride || {}),
  };
  const rect = options.rect
    ? clampWindowRect(options.rect, defaults.minWidth, defaults.minHeight)
    : centerWindowRect(defaults, index);

  return {
    id: options.windowId || createWindowId(),
    appId: app.id,
    taskbarOrder: Number.isFinite(options.taskbarOrder)
      ? options.taskbarOrder
      : index,
    minimized: false,
    maximized: false,
    rect,
    minWidth: defaults.minWidth,
    minHeight: defaults.minHeight,
    resizable: defaults.resizable,
    parentWindowId: options.parentWindowId || null,
    windowProps:
      options.windowProps && typeof options.windowProps === "object"
        ? options.windowProps
        : {},
    modal: !!options.modal,
    titleOverride:
      typeof options.titleOverride === "string" ? options.titleOverride : null,
    iconOverride: options.iconOverride || null,
  };
};

const collectWindowClosureSet = (windows, rootWindowId) => {
  const closureSet = new Set([rootWindowId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < windows.length; i += 1) {
      const windowItem = windows[i];
      if (!windowItem?.parentWindowId) continue;
      if (!closureSet.has(windowItem.parentWindowId)) continue;
      if (closureSet.has(windowItem.id)) continue;
      closureSet.add(windowItem.id);
      changed = true;
    }
  }
  return closureSet;
};

const moveWindowToFront = (windows, windowId) => {
  const index = windows.findIndex((windowItem) => windowItem.id === windowId);
  if (index < 0 || index === windows.length - 1) return windows;

  const nextWindows = [...windows];
  const [target] = nextWindows.splice(index, 1);
  nextWindows.push(target);
  return nextWindows;
};

const moveWindowSetToFront = (windows, windowIds) => {
  if (!(windowIds instanceof Set) || !windowIds.size) return windows;
  const front = [];
  const rest = [];
  for (let i = 0; i < windows.length; i += 1) {
    const windowItem = windows[i];
    if (windowIds.has(windowItem.id)) front.push(windowItem);
    else rest.push(windowItem);
  }
  if (!front.length || !rest.length) return windows;
  return [...rest, ...front];
};

const getWindowById = (windows, windowId) =>
  windows.find((windowItem) => windowItem.id === windowId) || null;

const getFamilyRootId = (windows, windowId) => {
  const byId = new Map(windows.map((windowItem) => [windowItem.id, windowItem]));
  let currentId = windowId;
  let current = byId.get(currentId) || null;
  while (current?.parentWindowId && byId.has(current.parentWindowId)) {
    currentId = current.parentWindowId;
    current = byId.get(currentId) || null;
  }
  return currentId;
};

const getTopVisibleModalDescendantId = (windows, rootWindowId) => {
  const closureSet = collectWindowClosureSet(windows, rootWindowId);
  for (let i = windows.length - 1; i >= 0; i -= 1) {
    const windowItem = windows[i];
    if (!closureSet.has(windowItem.id)) continue;
    if (!windowItem.modal || windowItem.minimized) continue;
    return windowItem.id;
  }
  return null;
};

const getTopVisibleWindowId = (windows) => {
  for (let i = windows.length - 1; i >= 0; i -= 1) {
    if (!windows[i].minimized) return windows[i].id;
  }
  return null;
};

export const createInitialDesktopState = (appsById, startupAppIds = []) => {
  const startupWindows = startupAppIds
    .map((appId, index) => {
      const app = appsById[appId];
      if (!app) return null;
      return createWindowInstance(app, index);
    })
    .filter(Boolean);

  return {
    windows: startupWindows,
    focusedWindowId: startupWindows[startupWindows.length - 1]?.id ?? null,
    selectedDesktopAppIds: [],
  };
};

export const desktopReducer = (state, action) => {
  const orderedWindows = ensureTaskbarOrders(state.windows);
  const currentState =
    orderedWindows === state.windows ? state : { ...state, windows: orderedWindows };

  switch (action.type) {
    case DESKTOP_ACTIONS.OPEN_APP: {
      const { app } = action.payload;
      if (!app) return currentState;

      const windowItem = createWindowInstance(app, currentState.windows.length, {
        taskbarOrder: getNextTaskbarOrder(currentState.windows),
      });
      return {
        ...currentState,
        windows: [...currentState.windows, windowItem],
        focusedWindowId: windowItem.id,
        selectedDesktopAppIds: [],
      };
    }

    case DESKTOP_ACTIONS.OPEN_WINDOW_INSTANCE: {
      const { app, options } = action.payload;
      if (!app) return currentState;

      const windowItem = createWindowInstance(
        app,
        currentState.windows.length,
        {
          ...(options || {}),
          taskbarOrder: Number.isFinite(options?.taskbarOrder)
            ? options.taskbarOrder
            : getNextTaskbarOrder(currentState.windows),
        },
      );
      return {
        ...currentState,
        windows: [...currentState.windows, windowItem],
        focusedWindowId: windowItem.id,
        selectedDesktopAppIds: [],
      };
    }

    case DESKTOP_ACTIONS.CLOSE_WINDOW: {
      const { windowId } = action.payload;
      const closureSet = collectWindowClosureSet(currentState.windows, windowId);
      const nextWindows = currentState.windows.filter(
        (windowItem) => !closureSet.has(windowItem.id),
      );
      const focusedWindowId =
        closureSet.has(currentState.focusedWindowId)
          ? getTopVisibleWindowId(nextWindows)
          : currentState.focusedWindowId;
      return { ...currentState, windows: nextWindows, focusedWindowId };
    }

    case DESKTOP_ACTIONS.MINIMIZE_WINDOW: {
      const { windowId } = action.payload;
      const closureSet = collectWindowClosureSet(currentState.windows, windowId);
      const nextWindows = currentState.windows.map((windowItem) =>
        closureSet.has(windowItem.id)
          ? { ...windowItem, minimized: true }
          : windowItem,
      );
      const focusedWindowId =
        closureSet.has(currentState.focusedWindowId)
          ? getTopVisibleWindowId(nextWindows)
          : currentState.focusedWindowId;
      return { ...currentState, windows: nextWindows, focusedWindowId };
    }

    case DESKTOP_ACTIONS.RESTORE_WINDOW: {
      const { windowId } = action.payload;
      const closureSet = collectWindowClosureSet(currentState.windows, windowId);
      const restoredWindows = currentState.windows.map((windowItem) =>
        closureSet.has(windowItem.id)
          ? { ...windowItem, minimized: false }
          : windowItem,
      );
      const nextWindows = moveWindowSetToFront(restoredWindows, closureSet);
      const focusedWindowId =
        getTopVisibleModalDescendantId(nextWindows, windowId) || windowId;
      return {
        ...currentState,
        windows: nextWindows,
        focusedWindowId,
      };
    }

    case DESKTOP_ACTIONS.TOGGLE_MAXIMIZE_WINDOW: {
      const { windowId } = action.payload;
      const targetWindow = currentState.windows.find(
        (windowItem) => windowItem.id === windowId,
      );
      if (!targetWindow || !targetWindow.resizable) return currentState;
      const toggledWindows = currentState.windows.map((windowItem) =>
        windowItem.id === windowId
          ? {
              ...windowItem,
              maximized: !windowItem.maximized,
              minimized: false,
            }
          : windowItem,
      );
      const nextWindows = moveWindowToFront(toggledWindows, windowId);
      return {
        ...currentState,
        windows: nextWindows,
        focusedWindowId: windowId,
      };
    }

    case DESKTOP_ACTIONS.FOCUS_WINDOW: {
      const { windowId } = action.payload;
      const targetWindow = currentState.windows.find(
        (windowItem) => windowItem.id === windowId,
      );
      if (!targetWindow || targetWindow.minimized) return currentState;

      const familyRootId = getFamilyRootId(currentState.windows, windowId);
      const familySet = collectWindowClosureSet(currentState.windows, familyRootId);
      const blockingModalId =
        getTopVisibleModalDescendantId(currentState.windows, familyRootId);
      const focusTargetId = blockingModalId || windowId;
      const focusTarget = getWindowById(currentState.windows, focusTargetId);
      if (!focusTarget || focusTarget.minimized) return currentState;

      return {
        ...currentState,
        windows: moveWindowSetToFront(currentState.windows, familySet),
        focusedWindowId: focusTargetId,
      };
    }

    case DESKTOP_ACTIONS.CLEAR_FOCUS:
      return {
        ...currentState,
        focusedWindowId: null,
      };

    case DESKTOP_ACTIONS.UPDATE_WINDOW_RECT: {
      const { windowId, rect } = action.payload;
      const nextWindows = currentState.windows.map((windowItem) => {
        if (windowItem.id !== windowId || windowItem.maximized || !rect) {
          return windowItem;
        }

        return {
          ...windowItem,
          rect: clampWindowRect(
            {
              x: Number.isFinite(rect.x) ? rect.x : windowItem.rect.x,
              y: Number.isFinite(rect.y) ? rect.y : windowItem.rect.y,
              width: Number.isFinite(rect.width)
                ? rect.width
                : windowItem.rect.width,
              height: Number.isFinite(rect.height)
                ? rect.height
                : windowItem.rect.height,
            },
            windowItem.minWidth,
            windowItem.minHeight,
          ),
        };
      });

      return { ...currentState, windows: nextWindows };
    }

    case DESKTOP_ACTIONS.SET_SELECTED_DESKTOP_APPS: {
      const appIds = Array.isArray(action.payload.appIds)
        ? action.payload.appIds
        : [];
      return {
        ...currentState,
        selectedDesktopAppIds: appIds,
      };
    }

    default:
      throw new Error(`Unknown desktop action: ${action.type}`);
  }
};
