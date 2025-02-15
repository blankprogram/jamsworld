import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import fileContent from './info.md';

import './Notepad.css';

const Notepad = () => {
  const [markdown, setMarkdown] = useState('');

  useEffect(() => {
    fetch(fileContent)
      .then(response => response.text())
      .then(mdText => setMarkdown(mdText))
      .catch(error => console.error('Error loading md file:', error));
  }, []);

  return (
    <div className="notepad-xp">
      <div className="notepad-menu-bar">
        <span>File</span>
        <span>Edit</span>
        <span>Format</span>
        <span>View</span>
        <span>Help</span>
      </div>
      
      <div className="notepad-textarea">
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default Notepad;
