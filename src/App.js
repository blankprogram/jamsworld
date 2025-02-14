import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import 'xp.css';
import Background from './components/Background/Background';
import Taskbar from './components/Taskbar/Taskbar';
import Window from './components/Window/Window';
import LoadingScreen from './components/LoadingScreen/LoadingScreen';
import WelcomeScreen from './components/WelcomeScreen/WelcomeScreen';
import startupSound from './assets/Sounds/startup.mp3';

const SCREEN_STATE = {
  LOADING: 'LOADING',
  WELCOME: 'WELCOME',
  MAIN: 'MAIN'
};

function App() {
  const [screenState, setScreenState] = useState(SCREEN_STATE.LOADING);
  const audioRef = useRef(null);

  const handleLoadingScreenClick = () => {
    setScreenState(SCREEN_STATE.WELCOME);
  };

  useEffect(() => {
    if (screenState === SCREEN_STATE.WELCOME) {
      const welcomeTimer = setTimeout(() => {
        setScreenState(SCREEN_STATE.MAIN);
      }, 3000);
      return () => clearTimeout(welcomeTimer);
    }
  }, [screenState]);

  useEffect(() => {
    if (screenState === SCREEN_STATE.MAIN && audioRef.current) {
      audioRef.current.volume = 0.25;
      console.log('Attempting to play audio...');
      audioRef.current.play().then(() => {
        console.log('Audio played successfully');
      }).catch((error) => {
        console.error('Failed to play audio:', error);
      });
    }
  }, [screenState]);

  const appsContext = require.context('./applications', true, /\.js$/);
  const apps = appsContext.keys().map(key => {
    const segments = key.split('/');
    const folderName = segments[segments.length - 2];
    const fileName = segments[segments.length - 1].replace('.js', '');

    if (fileName === folderName) {
      const component = appsContext(key).default;
      return { name: fileName, component };
    }
    return null;
  }).filter(Boolean);

  const nonStylizedApps = ['Winamp'];

  const initialOpenApps = [
    { name: 'Notepad', id: Date.now(), maximized: false },
    { name: 'Winamp', id: Date.now() + 1, maximized: false },
  ];

  const [openApps, setOpenApps] = useState(initialOpenApps);
  const [minimizedApps, setMinimizedApps] = useState([]);
  const [focusedApp, setFocusedApp] = useState(initialOpenApps[0]?.id || null);

  const openApplication = appName => {
    const newApp = { name: appName, id: Date.now(), maximized: false };
    setOpenApps(prevApps => [...prevApps, newApp]);
    setFocusedApp(newApp.id);
    setMinimizedApps(prevMinimized => prevMinimized.filter(app => app !== newApp.id));
  };

  const closeApplication = appId => {
    setOpenApps(prevApps => prevApps.filter(app => app.id !== appId));
    setMinimizedApps(prevMinimized => prevMinimized.filter(app => app !== appId));
    if (focusedApp === appId) setFocusedApp(null);
  };

  const minimizeApplication = appId => {
    setMinimizedApps(prevMinimized => [...prevMinimized, appId]);
    if (focusedApp === appId) setFocusedApp(null);
  };

  const restoreApplication = appId => {
    setMinimizedApps(prevMinimized => prevMinimized.filter(app => app !== appId));
    setFocusedApp(appId);

    setOpenApps(prevApps =>
      prevApps.map(app =>
        app.id === appId ? { ...app, isMinimized: false } : app
      )
    );
  };

  const toggleMaximizeApplication = appId => {
    setOpenApps(prevApps =>
      prevApps.map(app =>
        app.id === appId ? { ...app, maximized: !app.maximized } : app
      )
    );
    setFocusedApp(appId);
  };

  const handleFocus = appId => {
    setFocusedApp(appId);
  };

  const renderApplication = (appName, appId) => {
    const app = apps.find(a => a.name === appName);
    if (!app) return null;
    const AppComponent = app.component;
    return (
      <AppComponent
        onClose={() => closeApplication(appId)}
        onMinimize={() => minimizeApplication(appId)}
        isMinimized={minimizedApps.includes(appId)}
      />
    );
  };

  switch (screenState) {
    case SCREEN_STATE.LOADING:
      return <div onClick={handleLoadingScreenClick}><LoadingScreen /></div>;
    case SCREEN_STATE.WELCOME:
      return <WelcomeScreen />;
    case SCREEN_STATE.MAIN:
    default:
      return (
        <div className="App">
          <audio ref={audioRef} src={startupSound} />
          <Background apps={apps} openApplication={openApplication} setFocusedApp={setFocusedApp} />
          <Taskbar
            openApps={openApps}
            restoreApplication={restoreApplication}
            minimizeApplication={minimizeApplication}
            focusedApp={focusedApp}
          />
          {openApps.map(({ name, id, maximized }) => (
            <Window
              key={id}
              title={name}
              onClose={() => closeApplication(id)}
              onMinimize={() => minimizeApplication(id)}
              onToggleMaximize={() => toggleMaximizeApplication(id)}
              onFocus={() => handleFocus(id)}
              maximized={maximized}
              isFocused={focusedApp === id}
              isMinimized={minimizedApps.includes(id)}
              useStyledWindow={!nonStylizedApps.includes(name)}
            >
              {renderApplication(name, id)}
            </Window>
          ))}
        </div>
      );
  }
}

export default App;
