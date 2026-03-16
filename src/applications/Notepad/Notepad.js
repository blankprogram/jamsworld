import React, { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import fileContent from './info.md';
import { createAppManifest } from "../createAppManifest";
import notepadIcon from "../../assets/Icons/notepad.png";

import styles from "./Notepad.module.css";

export const appManifest = createAppManifest({
  id: "notepad",
  title: "Notepad",
  icon: notepadIcon,
});

const Notepad = () => {
  const [markdown, setMarkdown] = useState('');

  useEffect(() => {
    fetch(fileContent)
      .then(response => response.text())
      .then(mdText => setMarkdown(mdText))
      .catch(error => console.error('Error loading md file:', error));
  }, []);

  return (
    <div className={styles.notepadXp}>
      <div className={styles.notepadMenuBar}>
        <span>File</span>
        <span>Edit</span>
        <span>Format</span>
        <span>View</span>
        <span>Help</span>
      </div>
      
      <div className={styles.notepadTextarea}>
        <ReactMarkdown rehypePlugins={[rehypeRaw]}>
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default Notepad;
