import React, { useState, useEffect } from 'react';
import './App.css';
import 'xp.css';
import Background from './components/Background/Background';
import Taskbar from './components/Taskbar/Taskbar';
import Window from './components/Window/Window';

function App() {
  const [openApps, setOpenApps] = useState([]);
  const [minimizedApps, setMinimizedApps] = useState([]);
  const [focusedApp, setFocusedApp] = useState(null);

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
  const openApplication = appName => {
    const newApp = { name: appName, id: Date.now(), maximized: false };
    setOpenApps([...openApps, newApp]);
    setFocusedApp(newApp.id);
    setMinimizedApps(minimizedApps.filter(app => app !== newApp.id));
  };

  const closeApplication = appId => {
    setOpenApps(openApps.filter(app => app.id !== appId));
    setMinimizedApps(minimizedApps.filter(app => app !== appId));
    if (focusedApp === appId) setFocusedApp(null);
  };

  const minimizeApplication = appId => {
    setMinimizedApps([...minimizedApps, appId]);
    if (focusedApp === appId) setFocusedApp(null);
  };

  const restoreApplication = appId => {

    setMinimizedApps(minimizedApps.filter(app => app !== appId));
    setFocusedApp(appId);

    setOpenApps(openApps.map(app =>
      app.id === appId ? { ...app, isMinimized: false } : app
    ));
  };

  const toggleMaximizeApplication = appId => {
    setOpenApps(openApps.map(app => 
      app.id === appId ? { ...app, maximized: !app.maximized } : app
    ));
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


  useEffect(() => {
    openApplication('Winamp'); // open at boot
  }, []);

  return (
    <div className="App">
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

export default App;
