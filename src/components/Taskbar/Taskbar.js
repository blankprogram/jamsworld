import React, { useState, useEffect } from 'react';
import './Taskbar.css';
import { getAppIcon } from '../../utils/getAppIcon';
import githubIcon from '../../assets/Icons/github.png';
import linkedinIcon from '../../assets/Icons/linkedin.png';
import riskIcon from '../../assets/Icons/risk.png';

const Taskbar = ({ openApps, restoreApplication, minimizeApplication, focusedApp }) => {
  const [time, setTime] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const suffix = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      setTime(`${hours}:${minutes} ${suffix}`);
    };

    updateTime();
    const intervalId = setInterval(updateTime, 1000);

    return () => clearInterval(intervalId);
  }, []);

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
      <div className="system-tray">
        <a href="https://github.com/blankprogram" target="_blank" rel="noopener noreferrer">
          <img src={githubIcon} alt="Github" className="system-tray-icon" />
        </a>
        <a href="https://www.linkedin.com/in/jamal-elmir-485ab1261/" target="_blank" rel="noopener noreferrer">
          <img src={linkedinIcon} alt="LinkedIn" className="system-tray-icon" />
        </a>
        <img src={riskIcon} alt="Risk" className="system-tray-icon" />
        <div className="system-tray-time">{time}</div>
      </div>
    </div>
  );
};

export default Taskbar;
