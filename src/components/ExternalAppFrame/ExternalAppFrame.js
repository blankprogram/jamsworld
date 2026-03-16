import React from "react";

function ExternalAppFrame({ src, title, isFocused }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
      }}
    >
      <iframe
        src={src}
        title={title}
        style={{
          width: "100%",
          height: "100%",
          pointerEvents: isFocused ? "auto" : "none",
          margin: 0,
          padding: 0,
          border: "none",
        }}
      />
    </div>
  );
}

export default ExternalAppFrame;
