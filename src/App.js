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
    if (!openApps.some(app => app.name === appName)) {
      setOpenApps([...openApps, { name: appName, id: Date.now(), maximized: false }]);
    }
    setFocusedApp(appName);
  };

  const closeApplication = (appName) => {
    setOpenApps(openApps.filter(app => app.name !== appName));
    setMinimizedApps(minimizedApps.filter(app => app !== appName));
    if (focusedApp === appName) setFocusedApp(null);
  };

  const minimizeApplication = (appName) => {
    setMinimizedApps([...minimizedApps, appName]);
  };

  const restoreApplication = (appName) => {
    setMinimizedApps(minimizedApps.filter(app => app !== appName));
    setFocusedApp(appName);
  };

  const toggleMaximizeApplication = (appName) => {
    setOpenApps(openApps.map(app => app.name === appName ? { ...app, maximized: !app.maximized } : app));
    setFocusedApp(appName);
  };

  const handleFocus = (appName) => {
    setFocusedApp(appName);
  };

  const renderApplication = (appName) => {
    const app = apps.find(a => a.name === appName);
    if (!app) return null;
    const AppComponent = app.component;
    return <AppComponent onClose={() => closeApplication(appName)} />;
  };

  return (
    <div className="App">
      <Background apps={apps} openApplication={openApplication} />
      <Taskbar 
        openApps={openApps.map(app => app.name)} 
        restoreApplication={restoreApplication}
        focusedApp={focusedApp}
      />
      {openApps.map(({ name, id, maximized }) => (
        !minimizedApps.includes(name) && (
          <Window 
            key={id} 
            title={name} 
            onClose={() => closeApplication(name)}
            onMinimize={() => minimizeApplication(name)}
            onToggleMaximize={() => toggleMaximizeApplication(name)}
            onFocus={() => handleFocus(name)}
            maximized={maximized}
            isFocused={focusedApp === name}
          >
            {renderApplication(name)}
          </Window>
        )
      ))}
    </div>
  );
}

export default App;
