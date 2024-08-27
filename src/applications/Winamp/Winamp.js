import React, { useEffect, useRef } from 'react';
import Webamp from 'webamp';
import { initialTracks } from './Music';

function Winamp({ onClose, onMinimize, isMinimized }) {
  const ref = useRef(null);
  const webamp = useRef(null);

  useEffect(() => {
    const target = ref.current;
    if (!target) return;

    webamp.current = new Webamp({ initialTracks });

    webamp.current.renderWhenReady(target).then(() => {
      try {
        const webampElement = document.querySelector('#webamp');
        if (webampElement && !target.contains(webampElement)) {
          target.appendChild(webampElement);
        }
      } catch (error) {
        console.error("Error during Webamp render:", error);
      }
    }).catch(error => {
      console.error("Error rendering Webamp:", error);
    });

    return () => {
      if (webamp.current) {
        try {
          webamp.current.dispose();
        } catch (error) {
          console.error("Error disposing Webamp:", error);
        }
        webamp.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (webamp.current) {
      try {
        webamp.current.onClose(onClose);
        webamp.current.onMinimize(() => {
          console.log("Minimizing Winamp");
          if (onMinimize) onMinimize();
        });
      } catch (error) {
        console.error("Error setting Webamp event handlers:", error);
      }
    }
  }, [onClose, onMinimize]);

  useEffect(() => {
    const webampElement = document.querySelector('#webamp');
    if (webampElement) {
      webampElement.style.display = isMinimized ? 'none' : 'block';
    }
  }, [isMinimized]);

  return (
    <div
      style={{ left: 0, top: 0, right: 0, bottom: 0 }}
      ref={ref}
    />
  );
}

export default Winamp;
