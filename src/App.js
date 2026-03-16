import "./App.css";
import "./styles/tokens.css";
import "xp.css";

import React, { useCallback, useEffect, useRef, useState } from "react";

import background from "./assets/xpwallpaper.jpeg";
import startupSound from "./assets/Sounds/startup.mp3";
import Background from "./components/Background/Background";
import Clippy from "./components/Clippy/Clippy";
import LoadingScreen from "./components/LoadingScreen/LoadingScreen";
import Taskbar from "./components/Taskbar/Taskbar";
import WelcomeScreen from "./components/WelcomeScreen/WelcomeScreen";
import Window from "./components/Window/Window";
import { APP_REGISTRY, APPS_BY_ID } from "./desktop/appRegistry";
import { useDesktopSession } from "./desktop/useDesktopSession";

const SCREEN_STATE = {
  LOADING: "LOADING",
  WELCOME: "WELCOME",
  MAIN: "MAIN",
};

function App() {
  const [screenState, setScreenState] = useState(SCREEN_STATE.LOADING);
  const audioRef = useRef(null);

  const {
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
  } = useDesktopSession(APPS_BY_ID);

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
      const app = APPS_BY_ID[windowItem.appId];
      if (!app) return null;
      const AppComponent = app.component;
      return (
        <AppComponent
          onClose={() => closeApplication(windowItem.id)}
          onMinimize={() => minimizeApplication(windowItem.id)}
          isMinimized={windowItem.minimized}
        />
      );
    },
    [closeApplication, minimizeApplication],
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
            apps={APP_REGISTRY}
            openApplication={openApplication}
            selectedAppIds={desktopState.selectedDesktopAppIds}
            setSelectedAppIds={setSelectedDesktopApps}
          />
          <Taskbar
            windows={desktopState.windows}
            appsById={APPS_BY_ID}
            restoreApplication={restoreApplication}
            minimizeApplication={minimizeApplication}
            focusedWindowId={desktopState.focusedWindowId}
          />
          {desktopState.windows.map((windowItem, index) => {
            const app = APPS_BY_ID[windowItem.appId];
            if (!app) return null;

            return (
              <Window
                key={windowItem.id}
                title={app.title}
                icon={app.icon}
                onClose={() => closeApplication(windowItem.id)}
                onMinimize={() => minimizeApplication(windowItem.id)}
                onToggleMaximize={() => toggleMaximizeApplication(windowItem.id)}
                onFocus={() => focusWindow(windowItem.id)}
                onRectChange={(rect) => updateWindowRect(windowItem.id, rect)}
                maximized={windowItem.maximized}
                isFocused={desktopState.focusedWindowId === windowItem.id}
                isMinimized={windowItem.minimized}
                useStyledWindow={app.useStyledWindow}
                rect={windowItem.rect}
                minWidth={windowItem.minWidth}
                minHeight={windowItem.minHeight}
                resizable={windowItem.resizable}
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
