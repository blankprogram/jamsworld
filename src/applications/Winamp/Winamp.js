import React, { useEffect, useRef } from "react";
import Webamp from "webamp";
import { initialTracks } from "./Music";
import "./Winamp.module.css";
import { createAppManifest } from "../createAppManifest";
import winampIcon from "../../assets/Icons/winamp.png";

const getWebampElement = () => document.querySelector("#webamp");

const attachWebampElementToHost = (host) => {
  const webampElement = getWebampElement();
  if (!host || !webampElement) return null;

  if (webampElement.parentElement !== host) {
    host.appendChild(webampElement);
  }

  const hostRect = host.getBoundingClientRect();
  Object.assign(webampElement.style, {
    position: "absolute",
    top: "0px",
    left: "0px",
    zIndex: "0",
    transform: `translate(${-hostRect.left}px, ${-hostRect.top}px)`,
  });

  return webampElement;
};

const restoreWebampElementToBody = (webampElement) => {
  if (webampElement && webampElement.parentElement !== document.body) {
    webampElement.style.transform = "";
    document.body.appendChild(webampElement);
  }
};

export const appManifest = createAppManifest({
  id: "winamp",
  title: "Winamp",
  icon: winampIcon,
  useStyledWindow: false,
  clickThroughWindow: true,
  windowDefaults: {
    width: 350,
    height: 240,
    resizable: false,
  },
});

function Winamp({ onClose, onMinimize, isMinimized, onFocus }) {
  const ref = useRef(null);
  const webamp = useRef(null);
  const webampElementRef = useRef(null);
  const isMinimizedRef = useRef(isMinimized);
  const onFocusRef = useRef(onFocus);

  useEffect(() => {
    isMinimizedRef.current = isMinimized;
    const webampElement = webampElementRef.current || getWebampElement();
    if (webampElement) {
      webampElement.style.display = isMinimized ? "none" : "block";
    }
  }, [isMinimized]);

  useEffect(() => {
    onFocusRef.current = onFocus;
  }, [onFocus]);

  useEffect(() => {
    const target = ref.current;
    if (!target) return;

    let didDispose = false;
    const handlePointerDown = () => onFocusRef.current?.();
    webamp.current = new Webamp({ initialTracks, zIndex: 0 });

    webamp.current
      .renderWhenReady(target)
      .then(() => {
        if (didDispose) return;
        const webampElement = attachWebampElementToHost(target);
        if (!webampElement) return;

        webampElementRef.current = webampElement;
        webampElement.style.display = isMinimizedRef.current ? "none" : "block";
        webampElement.addEventListener("pointerdown", handlePointerDown, true);
      })
      .catch((error) => {
        console.error("Error rendering Webamp:", error);
      });

    return () => {
      didDispose = true;
      const webampElement = webampElementRef.current;
      if (webampElement) {
        webampElement.removeEventListener(
          "pointerdown",
          handlePointerDown,
          true,
        );
        restoreWebampElementToBody(webampElement);
        webampElementRef.current = null;
      }

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
          if (onMinimize) onMinimize();
        });
      } catch (error) {
        console.error("Error setting Webamp event handlers:", error);
      }
    }
  }, [onClose, onMinimize]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "visible",
      }}
      ref={ref}
    />
  );
}

export default Winamp;
