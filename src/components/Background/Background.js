import React, { useState, useRef } from 'react';
import './Background.css';

const Background = ({
  apps,
  openApplication,
  selectedAppIds = [],
  setSelectedAppIds,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [box, setBox] = useState(null);
  const startPoint = useRef(null);
  const visibleApps = apps.filter((app) => app.showOnDesktop !== false);

  const handleMouseDown = (e) => {
    const icon = e.target.closest('.icon');
    const clientX = e.clientX;
    const clientY = e.clientY;

    if (icon) {
      const appId = icon.getAttribute('data-app-id');
      setSelectedAppIds(appId ? [appId] : []);
    } else {
      setSelectedAppIds([]);
      startPoint.current = { x: clientX, y: clientY };
      setIsDragging(true);
    }
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

      const selected = visibleApps
        .filter((app) => {
          const appElement = document.getElementById(`desktop-icon-${app.id}`);
          if (!appElement) return false;
          const appRect = appElement.getBoundingClientRect();
          return !(
            appRect.right < newBox.left ||
            appRect.left > newBox.left + newBox.width ||
            appRect.bottom < newBox.top ||
            appRect.top > newBox.top + newBox.height
          );
        })
        .map((app) => app.id);

      setSelectedAppIds(selected);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setBox(null);
  };

  const handleIconDoubleClick = (appId) => {
    setSelectedAppIds([]);
    openApplication(appId);
  };

  return (
    <div
      className="background"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {visibleApps.map((app) => (
        <div
          key={app.id}
          id={`desktop-icon-${app.id}`}
          data-app-id={app.id}
          className={`icon ${selectedAppIds.includes(app.id) ? 'selected' : ''}`}
          onDoubleClick={() => handleIconDoubleClick(app.id)}
        >
          <img src={app.icon} alt={app.title} className="app-icon" />
          <span>{app.title}</span>
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
