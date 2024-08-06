import React from 'react';
import './Background.css';
import heartIcon from '../../assets/Icons/heart-icon.png'; // Import the heart icon

const Background = ({ openApplication }) => (
  <div className="background">
    <div className="icon" onClick={() => openApplication('AsciiApp')}>
      <span className="ascii-icon">A</span>
      <span>Asciify</span>
    </div>
    <div className="icon" onClick={() => openApplication('AnotherApp')}>
      <img src={heartIcon} alt="Pixcool" />
      <span>Pixcool</span>
    </div>
    {/* Add more icons for other applications */}
  </div>
);

export default Background;
