import React, { useState } from 'react';
import './App.css';
import 'xp.css/dist/XP.css';
import Background from './components/Background/Background';
import Taskbar from './components/Taskbar/Taskbar';
import Window from './components/Window/Window';
import AsciiApp from './applications/AsciiApp/AsciiApp';

function App() {
  const [openApps, setOpenApps] = useState([]);
  const [minimizedApps, setMinimizedApps] = useState([]);
  const [maximizedApp, setMaximizedApp] = useState(null);

  const openApplication = (appName) => {
    if (!openApps.includes(appName)) {
      setOpenApps([...openApps, appName]);
    }
  };

  const closeApplication = (appName) => {
    setOpenApps(openApps.filter(app => app !== appName));
    setMinimizedApps(minimizedApps.filter(app => app !== appName));
    if (maximizedApp === appName) {
      setMaximizedApp(null);
    }
  };

  const minimizeApplication = (appName) => {
    setMinimizedApps([...minimizedApps, appName]);
  };

  const restoreApplication = (appName) => {
    setMinimizedApps(minimizedApps.filter(app => app !== appName));
  };

  const toggleMaximizeApplication = (appName) => {
    setMaximizedApp(prevMaximizedApp => (prevMaximizedApp === appName ? null : appName));
  };

  const renderApplication = (appName) => {
    switch (appName) {
      case 'AsciiApp':
        return <AsciiApp onClose={() => closeApplication(appName)} />;
      default:
        return null;
    }
  };

  return (
    <div className="App">
      <Background openApplication={openApplication} />
      <Taskbar 
        minimizedApps={minimizedApps}
        restoreApplication={restoreApplication}
      />
      {openApps.map((app, index) => (
        !minimizedApps.includes(app) && (
          <Window 
            key={index} 
            title={app} 
            onClose={() => closeApplication(app)}
            onMinimize={() => minimizeApplication(app)}
            onToggleMaximize={() => toggleMaximizeApplication(app)}
            maximized={maximizedApp === app}
          >
            {renderApplication(app)}
          </Window>
        )
      ))}
    </div>
  );
}

export default App;
