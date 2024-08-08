import React from 'react';
import './Taskbar.css';
import { getAppIcon } from '../../utils/getAppIcon';

const Taskbar = ({ openApps, restoreApplication, focusedApp }) => (
  <div className="taskbar">
    <div className="start-button"></div>
    <div className="taskbar-items">
      {openApps.map(app => (
        <div
          key={app}
          className={`taskbar-item ${focusedApp === app ? 'focused-taskbar-item' : ''}`}
          onClick={() => restoreApplication(app)}
        >
          <img src={getAppIcon(app)} alt={app} className="taskbar-icon" />
          <span>{app}</span>
        </div>
      ))}
    </div>
  </div>
);

export default Taskbar;
