import React, { useState, useRef } from 'react';
import './Background.css';
import { getAppIcon } from '../../utils/getAppIcon';

const Background = ({ apps, openApplication }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [box, setBox] = useState(null);
  const startPoint = useRef(null);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    startPoint.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const newBox = {
        left: Math.min(e.clientX, startPoint.current.x),
        top: Math.min(e.clientY, startPoint.current.y),
        width: Math.abs(e.clientX - startPoint.current.x),
        height: Math.abs(e.clientY - startPoint.current.y)
      };
      setBox(newBox);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setBox(null);
  };

  return (
    <div
      className="background"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {apps.map(app => (
        <div key={app.name} className="icon" onDoubleClick={() => openApplication(app.name)}>
          <img src={getAppIcon(app.name)} alt={app.name} className="app-icon" />
          <span>{app.name}</span>
        </div>
      ))}
      {box && <div className="selection-box" style={{
        left: `${box.left}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      }} />}
    </div>
  );
};

export default Background;
