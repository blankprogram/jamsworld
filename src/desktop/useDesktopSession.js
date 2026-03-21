import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import {
  createInitialDesktopState,
  DESKTOP_ACTIONS,
  desktopReducer,
} from "./desktopReducer";

const STARTUP_APP_IDS = ["notepad", "winamp"];
const createWindowId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export function useDesktopSession(appsById) {
  const dialogResolversRef = useRef(new Map());
  const [desktopState, dispatch] = useReducer(
    desktopReducer,
    undefined,
    () => createInitialDesktopState(appsById, STARTUP_APP_IDS),
  );

  const openWindow = useCallback(
    (appId, options = {}) => {
      const app = appsById[appId];
      if (!app) return null;
      const normalizedOptions =
        options && typeof options === "object" ? options : {};
      const windowId = normalizedOptions.windowId || createWindowId();
      dispatch({
        type: DESKTOP_ACTIONS.OPEN_WINDOW_INSTANCE,
        payload: {
          app,
          options: {
            ...normalizedOptions,
            windowId,
          },
        },
      });
      return windowId;
    },
    [appsById],
  );

  const openApplication = useCallback((appId) => openWindow(appId), [openWindow]);

  const closeApplication = useCallback((windowId) => {
    dispatch({
      type: DESKTOP_ACTIONS.CLOSE_WINDOW,
      payload: { windowId },
    });
  }, []);

  const openDialog = useCallback(
    (appId, options = {}) => {
      const app = appsById[appId];
      if (!app) return Promise.resolve(null);

      const normalizedOptions =
        options && typeof options === "object" ? options : {};
      const windowId = normalizedOptions.windowId || createWindowId();
      return new Promise((resolve) => {
        dialogResolversRef.current.set(windowId, resolve);
        dispatch({
          type: DESKTOP_ACTIONS.OPEN_WINDOW_INSTANCE,
          payload: {
            app,
            options: {
              ...normalizedOptions,
              windowId,
              modal: normalizedOptions.modal ?? true,
            },
          },
        });
      });
    },
    [appsById],
  );

  const resolveDialog = useCallback((windowId, value = null) => {
    const resolve = dialogResolversRef.current.get(windowId);
    if (resolve) {
      dialogResolversRef.current.delete(windowId);
      resolve(value);
    }
    dispatch({
      type: DESKTOP_ACTIONS.CLOSE_WINDOW,
      payload: { windowId },
    });
  }, []);

  const minimizeApplication = useCallback((windowId) => {
    dispatch({
      type: DESKTOP_ACTIONS.MINIMIZE_WINDOW,
      payload: { windowId },
    });
  }, []);

  const restoreApplication = useCallback((windowId) => {
    dispatch({
      type: DESKTOP_ACTIONS.RESTORE_WINDOW,
      payload: { windowId },
    });
  }, []);

  const toggleMaximizeApplication = useCallback((windowId) => {
    dispatch({
      type: DESKTOP_ACTIONS.TOGGLE_MAXIMIZE_WINDOW,
      payload: { windowId },
    });
  }, []);

  const focusWindow = useCallback((windowId) => {
    dispatch({
      type: DESKTOP_ACTIONS.FOCUS_WINDOW,
      payload: { windowId },
    });
  }, []);

  const updateWindowRect = useCallback((windowId, rect) => {
    dispatch({
      type: DESKTOP_ACTIONS.UPDATE_WINDOW_RECT,
      payload: { windowId, rect },
    });
  }, []);

  const setSelectedDesktopApps = useCallback((appIds) => {
    dispatch({
      type: DESKTOP_ACTIONS.SET_SELECTED_DESKTOP_APPS,
      payload: { appIds },
    });
  }, []);

  const focusedAppName = useMemo(() => {
    const focusedWindow = desktopState.windows.find(
      (windowItem) => windowItem.id === desktopState.focusedWindowId,
    );
    return appsById[focusedWindow?.appId]?.title || "";
  }, [appsById, desktopState.focusedWindowId, desktopState.windows]);

  useEffect(() => {
    const openWindowIds = new Set(desktopState.windows.map((windowItem) => windowItem.id));
    for (const [windowId, resolve] of dialogResolversRef.current.entries()) {
      if (openWindowIds.has(windowId)) continue;
      dialogResolversRef.current.delete(windowId);
      resolve(null);
    }
  }, [desktopState.windows]);

  useEffect(
    () => () => {
      for (const resolve of dialogResolversRef.current.values()) {
        resolve(null);
      }
      dialogResolversRef.current.clear();
    },
    [],
  );

  return {
    desktopState,
    focusedAppName,
    openApplication,
    openWindow,
    openDialog,
    resolveDialog,
    closeApplication,
    minimizeApplication,
    restoreApplication,
    toggleMaximizeApplication,
    focusWindow,
    updateWindowRect,
    setSelectedDesktopApps,
  };
}
