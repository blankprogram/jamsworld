import React, { useState, useRef } from 'react';
import './Background.css';
import { getAppIcon } from '../../utils/getAppIcon';

const Background = ({ apps, openApplication, setFocusedApp }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [box, setBox] = useState(null);
  const startPoint = useRef(null);
  const [selectedApps, setSelectedApps] = useState([]);

  const handleMouseDown = (e) => {
    if (!e.target.closest('.icon')) {
      setSelectedApps([]);
      setFocusedApp(null);
    }
    setIsDragging(true);
    startPoint.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const newBox = {
        left: Math.min(e.clientX, startPoint.current.x),
        top: Math.min(e.clientY, startPoint.current.y),
        width: Math.abs(e.clientX - startPoint.current.x),
        height: Math.abs(e.clientY - startPoint.current.y),
      };
      setBox(newBox);
      
      const selected = apps.filter(app => {
        const appElement = document.getElementById(app.name);
        const appRect = appElement.getBoundingClientRect();
        return !(
          appRect.right < newBox.left ||
          appRect.left > newBox.left + newBox.width ||
          appRect.bottom < newBox.top ||
          appRect.top > newBox.top + newBox.height
        );
      }).map(app => app.name);

      setSelectedApps(selected);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setBox(null);
  };

  const handleIconClick = (appName) => {
    setSelectedApps([appName]);
    setFocusedApp(appName);
  };

  const handleIconDoubleClick = (appName) => {
    setSelectedApps([]);
    openApplication(appName);
  };

  return (
    <div
      className="background"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {apps.map(app => (
        <div
          key={app.name}
          id={app.name}
          className={`icon ${selectedApps.includes(app.name) ? 'selected' : ''}`}
          onClick={() => handleIconClick(app.name)}
          onDoubleClick={() => handleIconDoubleClick(app.name)}
        >
          <img src={getAppIcon(app.name)} alt={app.name} className="app-icon" />
          <span>{app.name}</span>
        </div>
      ))}
      {box && (
        <div
          className="selection-box"
          style={{
            left: `${box.left}px`,
            top: `${box.top}px`,
            width: `${box.width}px`,
            height: `${box.height}px`,
          }}
        />
      )}
    </div>
  );
};

export default Background;