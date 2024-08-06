import React from 'react';
import './Taskbar.css';

const Taskbar = ({ minimizedApps, restoreApplication }) => {
  const getAppIcon = (appName) => {
    switch (appName) {
      case 'AsciiApp':
        return '../../assets/Icons/heart-icon.png'; // fix
      case 'AnotherApp':
        return '../../assets/Icons/heart-icon.png';
      default:
        return 'path/to/default-icon.png';
    }
  };

  return (
    <div className="taskbar">
      <div className="taskbar-item start-button"></div>
      {minimizedApps.map(app => (
        <div key={app} className="taskbar-item" onClick={() => restoreApplication(app)}>
          <img src={getAppIcon(app)} alt={app} className="taskbar-icon" />
        </div>
      ))}
    </div>
  );
};

export default Taskbar;
