import React, { useState, useEffect } from "react";
import styles from "./Taskbar.module.css";
import githubIcon from "../../assets/Icons/github.png";
import linkedinIcon from "../../assets/Icons/linkedin.png";
import riskIcon from "../../assets/Icons/risk.png";
import { getWindowsInTaskbarOrder } from "../../desktop/windowOrdering";

const Taskbar = ({
  windows,
  appsById,
  restoreApplication,
  minimizeApplication,
  focusedWindowId,
}) => {
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, "0");
      const suffix = hours >= 12 ? "PM" : "AM";
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

  const taskbarWindows = getWindowsInTaskbarOrder(windows).filter((windowItem) => {
    const app = appsById[windowItem.appId];
    return app && app.showInTaskbar !== false;
  });

  return (
    <div className={styles.taskbar}>
      <div className={styles.startButton}></div>
      <div className={styles.taskbarItems}>
        {taskbarWindows.map((windowItem) => {
          const app = appsById[windowItem.appId];
          if (!app) return null;
          const title = windowItem.titleOverride || app.title;
          const icon = windowItem.iconOverride || app.icon;
          return (
            <div
              key={windowItem.id}
              className={`${styles.taskbarItem} ${focusedWindowId === windowItem.id && !windowItem.minimized ? styles.focusedTaskbarItem : ""}`}
              onClick={() => handleTaskbarClick(windowItem)}
            >
              <img src={icon} alt={title} className={styles.taskbarIcon} />
              <span className={styles.taskbarLabel}>{title}</span>
            </div>
          );
        })}
      </div>
      <div className={styles.systemTray}>
        <a href="https://github.com/blankprogram" target="_blank" rel="noopener noreferrer">
          <img src={githubIcon} alt="Github" className={styles.systemTrayIcon} />
        </a>
        <a href="https://www.linkedin.com/in/jamal-elmir-485ab1261/" target="_blank" rel="noopener noreferrer">
          <img src={linkedinIcon} alt="LinkedIn" className={styles.systemTrayIcon} />
        </a>
        <img src={riskIcon} alt="Risk" className={styles.systemTrayIcon} />
        <div className={styles.systemTrayTime}>{time}</div>
      </div>
    </div>
  );
};

export default Taskbar;
