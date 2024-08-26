import React, { useState } from 'react';
import './App.css';
import 'xp.css';
import Background from './components/Background/Background';
import Taskbar from './components/Taskbar/Taskbar';
import Window from './components/Window/Window';
import Asciify from './applications/Asciify/Asciify';
import Pixort from './applications/Pixort/Pixort';
import Paint from './applications/Paint/Paint';
import PixelPass from './applications/PixelPass/PixelPass';

const apps = [
  { name: 'Asciify', component: Asciify },
  { name: 'Paint', component: Paint },
  { name: 'Pixort', component: Pixort },
  { name: 'PixelPass', component: PixelPass },
];

function App() {
  const [openApps, setOpenApps] = useState([]);
  const [minimizedApps, setMinimizedApps] = useState([]);
  const [focusedApp, setFocusedApp] = useState(null);

  const openApplication = (appName) => {
    const newApp = { name: appName, id: Date.now(), maximized: false };
    setOpenApps([...openApps, newApp]);
    setFocusedApp(newApp.id);
    setMinimizedApps(minimizedApps.filter(app => app !== newApp.id));
  };

  const closeApplication = (appId) => {
    setOpenApps(openApps.filter(app => app.id !== appId));
    setMinimizedApps(minimizedApps.filter(app => app !== appId));
    if (focusedApp === appId) setFocusedApp(null);
  };

  const minimizeApplication = (appId) => {
    setMinimizedApps([...minimizedApps, appId]);
    if (focusedApp === appId) setFocusedApp(null);
  };

  const restoreApplication = (appId) => {
    setMinimizedApps(minimizedApps.filter(app => app !== appId));
    setFocusedApp(appId);
  };

  const toggleMaximizeApplication = (appId) => {
    setOpenApps(openApps.map(app => app.id === appId ? { ...app, maximized: !app.maximized } : app));
    setFocusedApp(appId);
  };

  const handleFocus = (appId) => {
    setFocusedApp(appId);
  };

  const renderApplication = (appName) => {
    const app = apps.find(a => a.name === appName);
    if (!app) return null;
    const AppComponent = app.component;
    return <AppComponent />;
  };

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
        >
          {renderApplication(name)}
        </Window>
      ))}
    </div>
  );
}

export default App;
