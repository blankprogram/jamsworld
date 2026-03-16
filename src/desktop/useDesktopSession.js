import { useCallback, useMemo, useReducer } from "react";
import {
  createInitialDesktopState,
  DESKTOP_ACTIONS,
  desktopReducer,
} from "./desktopReducer";

const STARTUP_APP_IDS = ["notepad", "winamp"];

export function useDesktopSession(appsById) {
  const [desktopState, dispatch] = useReducer(
    desktopReducer,
    undefined,
    () => createInitialDesktopState(appsById, STARTUP_APP_IDS),
  );

  const openApplication = useCallback(
    (appId) => {
      const app = appsById[appId];
      if (!app) return;
      dispatch({
        type: DESKTOP_ACTIONS.OPEN_APP,
        payload: { app },
      });
    },
    [appsById],
  );

  const closeApplication = useCallback((windowId) => {
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

  return {
    desktopState,
    focusedAppName,
    openApplication,
    closeApplication,
    minimizeApplication,
    restoreApplication,
    toggleMaximizeApplication,
    focusWindow,
    updateWindowRect,
    setSelectedDesktopApps,
  };
}
