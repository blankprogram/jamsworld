import "./App.css";
import "./styles/tokens.css";
import "xp.css";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import background from "./assets/xpwallpaper.jpeg";
import startupSound from "./assets/Sounds/startup.mp3";
import Background from "./components/Background/Background";
import Clippy from "./components/Clippy/Clippy";
import LoadingScreen from "./components/LoadingScreen/LoadingScreen";
import Taskbar from "./components/Taskbar/Taskbar";
import WelcomeScreen from "./components/WelcomeScreen/WelcomeScreen";
import Window from "./components/Window/Window";
import { APP_REGISTRY, APPS_BY_ID } from "./desktop/appRegistry";
import { INTERNAL_APPS_BY_ID } from "./desktop/internalApps";
import { useDesktopSession } from "./desktop/useDesktopSession";

const SCREEN_STATE = {
  LOADING: "LOADING",
  WELCOME: "WELCOME",
  MAIN: "MAIN",
};

function App() {
  const ALL_APPS_BY_ID = useMemo(
    () => ({ ...APPS_BY_ID, ...INTERNAL_APPS_BY_ID }),
    [],
  );
  const desktopApps = useMemo(
    () => APP_REGISTRY.filter((app) => app.showOnDesktop !== false),
    [],
  );
  const [screenState, setScreenState] = useState(SCREEN_STATE.LOADING);
  const audioRef = useRef(null);

  const {
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
  } = useDesktopSession(ALL_APPS_BY_ID);

  const interactionLockedWindowIds = useMemo(() => {
    const windows = desktopState.windows || [];
    const byId = new Map(windows.map((windowItem) => [windowItem.id, windowItem]));
    const locked = new Set();

    for (let i = windows.length - 1; i >= 0; i -= 1) {
      const windowItem = windows[i];
      if (!windowItem?.modal || windowItem.minimized || !windowItem.parentWindowId) {
        continue;
      }

      let parentId = windowItem.parentWindowId;
      while (parentId && byId.has(parentId)) {
        locked.add(parentId);
        parentId = byId.get(parentId)?.parentWindowId || null;
      }
    }

    return locked;
  }, [desktopState.windows]);

  const handleLoadingScreenClick = () => {
    setScreenState(SCREEN_STATE.WELCOME);
  };

  useEffect(() => {
    if (screenState !== SCREEN_STATE.WELCOME) return undefined;
    const welcomeTimer = setTimeout(() => {
      setScreenState(SCREEN_STATE.MAIN);
    }, 3000);
    return () => clearTimeout(welcomeTimer);
  }, [screenState]);

  useEffect(() => {
    if (screenState === SCREEN_STATE.MAIN && audioRef.current) {
      audioRef.current.volume = 0.25;
      audioRef.current.play();
    }
  }, [screenState]);

  const renderApplication = useCallback(
    (windowItem) => {
      const app = ALL_APPS_BY_ID[windowItem.appId];
      if (!app) return null;
      const AppComponent = app.component;
      const withParentWindow = (options) => {
        const normalizedOptions =
          options && typeof options === "object" ? options : {};
        return {
          ...normalizedOptions,
          parentWindowId: normalizedOptions.parentWindowId ?? windowItem.id,
        };
      };
      const windowRuntime = {
        windowId: windowItem.id,
        appId: windowItem.appId,
        openWindow: (appId, options) => openWindow(appId, withParentWindow(options)),
        openDialog: (appId, options) =>
          openDialog(appId, {
            ...withParentWindow(options),
            modal: options?.modal ?? true,
          }),
        resolveDialog: (value) => resolveDialog(windowItem.id, value),
        closeWindow: () => closeApplication(windowItem.id),
        minimizeWindow: () => minimizeApplication(windowItem.id),
        focusWindow: () => focusWindow(windowItem.id),
      };
      return (
        <AppComponent
          onClose={() => closeApplication(windowItem.id)}
          onMinimize={() => minimizeApplication(windowItem.id)}
          isMinimized={windowItem.minimized}
          windowProps={windowItem.windowProps || {}}
          windowRuntime={windowRuntime}
        />
      );
    },
    [
      ALL_APPS_BY_ID,
      closeApplication,
      minimizeApplication,
      focusWindow,
      openWindow,
      openDialog,
      resolveDialog,
    ],
  );

  switch (screenState) {
    case SCREEN_STATE.LOADING:
      return (
        <div onClick={handleLoadingScreenClick}>
          <LoadingScreen />
        </div>
      );
    case SCREEN_STATE.WELCOME:
      return <WelcomeScreen />;
    case SCREEN_STATE.MAIN:
    default:
      return (
        <div
          className="App"
          style={{
            backgroundImage: `url(${background})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <audio ref={audioRef} src={startupSound} />
          <Background
            apps={desktopApps}
            openApplication={openApplication}
            selectedAppIds={desktopState.selectedDesktopAppIds}
            setSelectedAppIds={setSelectedDesktopApps}
          />
          <Taskbar
            windows={desktopState.windows}
            appsById={ALL_APPS_BY_ID}
            restoreApplication={restoreApplication}
            minimizeApplication={minimizeApplication}
            focusedWindowId={desktopState.focusedWindowId}
          />
          {desktopState.windows.map((windowItem, index) => {
            const app = ALL_APPS_BY_ID[windowItem.appId];
            if (!app) return null;
            const windowTitle = windowItem.titleOverride || app.title;
            const windowIcon = windowItem.iconOverride || app.icon;

            return (
              <Window
                key={windowItem.id}
                title={windowTitle}
                icon={windowIcon}
                onClose={() => closeApplication(windowItem.id)}
                onMinimize={() => minimizeApplication(windowItem.id)}
                onToggleMaximize={() => toggleMaximizeApplication(windowItem.id)}
                onFocus={() => focusWindow(windowItem.id)}
                onRectChange={(rect) => updateWindowRect(windowItem.id, rect)}
                maximized={windowItem.maximized}
                isFocused={desktopState.focusedWindowId === windowItem.id}
                isMinimized={windowItem.minimized}
                useStyledWindow={app.useStyledWindow}
                buttons={windowItem.modal ? ["close"] : undefined}
                rect={windowItem.rect}
                minWidth={windowItem.minWidth}
                minHeight={windowItem.minHeight}
                resizable={windowItem.resizable}
                minimizable={!windowItem.modal}
                interactionLocked={interactionLockedWindowIds.has(windowItem.id)}
                zIndex={index + 1}
              >
                {renderApplication(windowItem)}
              </Window>
            );
          })}
          <Clippy appName={focusedAppName} />
        </div>
      );
  }
}

export default App;
