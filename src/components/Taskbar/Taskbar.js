import React, { useState, useEffect } from 'react';
import './Taskbar.css';
import githubIcon from '../../assets/Icons/github.png';
import linkedinIcon from '../../assets/Icons/linkedin.png';
import riskIcon from '../../assets/Icons/risk.png';

const Taskbar = ({
  windows,
  appsById,
  restoreApplication,
  minimizeApplication,
  focusedWindowId,
}) => {
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

  const handleTaskbarClick = (windowItem) => {
    if (focusedWindowId === windowItem.id && !windowItem.minimized) {
      minimizeApplication(windowItem.id);
    } else {
      restoreApplication(windowItem.id);
    }
  };

  return (
    <div className="taskbar">
      <div className="start-button"></div>
      <div className="taskbar-items">
        {windows.map((windowItem) => {
          const app = appsById[windowItem.appId];
          if (!app) return null;
          return (
          <div
            key={windowItem.id}
            className={`taskbar-item ${focusedWindowId === windowItem.id && !windowItem.minimized ? 'focused-taskbar-item' : ''}`}
            onClick={() => handleTaskbarClick(windowItem)}
          >
            <img src={app.icon} alt={app.title} className="taskbar-icon" />
            <span>{app.title}</span>
          </div>
          );
        })}
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
