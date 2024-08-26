import React from 'react';
import './Taskbar.css';
import { getAppIcon } from '../../utils/getAppIcon';

const Taskbar = ({ openApps, restoreApplication, minimizeApplication, focusedApp }) => {
  const handleTaskbarClick = (appId) => {
    if (focusedApp === appId) {
      minimizeApplication(appId);
    } else {
      restoreApplication(appId);
    }
  };

  return (
    <div className="taskbar">
      <div className="start-button"></div>
      <div className="taskbar-items">
        {openApps.map(app => (
          <div
            key={app.id}
            className={`taskbar-item ${focusedApp === app.id ? 'focused-taskbar-item' : ''}`}
            onClick={() => handleTaskbarClick(app.id)}
          >
            <img src={getAppIcon(app.name)} alt={app.name} className="taskbar-icon" />
            <span>{app.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Taskbar;
